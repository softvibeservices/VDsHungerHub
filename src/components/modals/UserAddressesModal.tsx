// src\components\modals\UserAddressesModal.tsx

"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";
import { MapPin, Plus, Pencil, Trash2, Home, Briefcase, Check, Loader2, Star } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

interface Address {
  id: string;
  type: "WORK" | "HOME";
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  isDefault: boolean;
}

interface User {
  id: string;
  name: string;
  number: string;
  workAddress?: string | null;
  homeAddress?: string | null;
}

interface UserAddressesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User | null;
}

function formatAddress(a: Address): string {
  return [a.line1, a.line2, a.landmark].filter(Boolean).join(", ");
}

export default function UserAddressesModal({
  isOpen,
  onClose,
  onSuccess,
  user,
}: UserAddressesModalProps) {
  const toast = useToast();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states (Add or Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingAddr, setEditingAddr] = useState<Address | null>(null);
  const [formType, setFormType] = useState<"WORK" | "HOME">("WORK");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  // Delete confirm state
  const [deleteAddrId, setDeleteAddrId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAddresses = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/addresses`);
      const data = await res.json();
      if (res.ok) {
        setAddresses(data.addresses ?? []);
      }
    } catch {
      toast.error("Failed to load user addresses.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && user) {
      setShowForm(false);
      setEditingAddr(null);
      fetchAddresses();
    }
  }, [isOpen, user]);

  const openAddForm = () => {
    setEditingAddr(null);
    setFormType("WORK");
    setLine1("");
    setLine2("");
    setLandmark("");
    setError("");
    setShowForm(true);
  };

  const openEditForm = (addr: Address) => {
    setEditingAddr(addr);
    setFormType(addr.type);
    setLine1(addr.line1);
    setLine2(addr.line2 ?? "");
    setLandmark(addr.landmark ?? "");
    setError("");
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (line1.trim().length < 5) {
      setError("Address line 1 must be at least 5 characters");
      return;
    }

    setIsSaving(true);
    setError("");
    try {
      const url = editingAddr
        ? `/api/admin/users/${user.id}/addresses/${editingAddr.id}`
        : `/api/admin/users/${user.id}/addresses`;
      const method = editingAddr ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          line1: line1.trim(),
          line2: line2.trim() || null,
          landmark: landmark.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save address");
        return;
      }

      toast.success(editingAddr ? "Address updated!" : "Address added!");
      setShowForm(false);
      setEditingAddr(null);
      fetchAddresses();
      onSuccess();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteAddrId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/addresses/${deleteAddrId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Address deleted");
        setDeleteAddrId(null);
        fetchAddresses();
        onSuccess();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetDefault = async (addr: Address) => {
    if (!user || addr.isDefault) return;
    try {
      const res = await fetch(`/api/admin/users/${user.id}/addresses/${addr.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line1: addr.line1,
          line2: addr.line2,
          landmark: addr.landmark,
          isDefault: true,
        }),
      });
      if (res.ok) {
        toast.success("Default address updated!");
        fetchAddresses();
        onSuccess();
      }
    } catch {
      toast.error("Failed to update default address");
    }
  };

  if (!user) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Saved Addresses: ${user.name}`}
        size="md"
        footer={
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {/* Header toolbar */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-orange-500" />
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Addresses ({addresses.length})
              </span>
            </div>
            {!showForm && (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={openAddForm}
              >
                Add Address
              </Button>
            )}
          </div>

          {/* Form to Add / Edit */}
          {showForm ? (
            <form onSubmit={handleSave} className="bg-orange-50/70 border border-orange-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-gray-900 text-xs uppercase tracking-wider">
                  {editingAddr ? "Edit Address" : "Add Address for Customer"}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-xs text-gray-400 hover:text-gray-600 font-bold"
                >
                  Cancel
                </button>
              </div>

              {/* Type toggle */}
              <div className="grid grid-cols-2 gap-2">
                {(["WORK", "HOME"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormType(t)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      formType === t
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {t === "WORK" ? <Briefcase size={13} /> : <Home size={13} />}
                    <span>{t === "WORK" ? "Work" : "Home"}</span>
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>
              )}

              <Input
                placeholder="Address line 1 *"
                value={line1}
                onChange={(e) => setLine1(e.target.value)}
                required
              />
              <Input
                placeholder="Floor / Building (optional)"
                value={line2}
                onChange={(e) => setLine2(e.target.value)}
              />
              <Input
                placeholder="Landmark (optional)"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
              />

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isSaving}
                  disabled={line1.trim().length < 5}
                  className="flex-1"
                >
                  {editingAddr ? "Save Changes" : "Save Address"}
                </Button>
              </div>
            </form>
          ) : (
            /* Address List */
            <div className="space-y-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={22} className="animate-spin text-orange-500" />
                </div>
              ) : addresses.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-xs text-gray-400 font-medium">No saved addresses found for this customer.</p>
                  <Button variant="secondary" size="sm" onClick={openAddForm}>
                    Add First Address
                  </Button>
                </div>
              ) : (
                addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-3.5 border border-gray-200 rounded-2xl bg-white hover:border-gray-300 transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
                          {addr.type === "WORK" ? <Briefcase size={14} /> : <Home size={14} />}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                          {addr.type}
                        </span>
                        {addr.isDefault && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md">
                            Default
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {!addr.isDefault && (
                          <button
                            type="button"
                            onClick={() => handleSetDefault(addr)}
                            className="text-[11px] font-bold text-gray-400 hover:text-orange-600 px-2 py-1 rounded hover:bg-orange-50 transition-colors cursor-pointer"
                            title="Set as Default"
                          >
                            Set Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditForm(addr)}
                          className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                          title="Edit Address"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteAddrId(addr.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Address"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-medium text-gray-800 leading-relaxed pl-8">
                      {formatAddress(addr)}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Confirm Delete Dialog */}
      {deleteAddrId && (
        <ConfirmDialog
          isOpen={!!deleteAddrId}
          onClose={() => setDeleteAddrId(null)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          title="Delete Customer Address"
          message="Are you sure you want to delete this saved address?"
          confirmLabel="Delete"
        />
      )}
    </>
  );
}
