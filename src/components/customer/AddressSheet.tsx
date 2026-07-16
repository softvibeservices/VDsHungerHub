"use client";

import { useState, useEffect } from "react";
import { MapPin, Plus, Home, Briefcase, X, Loader2, Check } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  type: "WORK" | "HOME";
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city?: string | null;
  pincode?: string | null;
  isDefault: boolean;
}

interface Props {
  /** Called when user confirms an address — passes the selected address id and text */
  onConfirm: (addressId: string, addressText: string) => void;
  onClose: () => void;
}

// ── Helper: address label ─────────────────────────────────────────────────────

function formatAddress(a: Address) {
  const parts = [a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean);
  return parts.join(", ");
}

// ── Add Address mini-form ─────────────────────────────────────────────────────

interface AddFormProps {
  defaultType?: "WORK" | "HOME";
  onSaved: (address: Address) => void;
  onCancel: () => void;
}

function AddAddressForm({ defaultType = "HOME", onSaved, onCancel }: AddFormProps) {
  const [type, setType] = useState<"WORK" | "HOME">(defaultType);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (line1.trim().length < 5) {
      setError("Address line 1 must be at least 5 characters");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customer/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, line1: line1.trim(), line2: line2.trim() || null, landmark: landmark.trim() || null, city: city.trim() || null, pincode: pincode.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save address");
        return;
      }
      onSaved(data.address);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const inputCls = "w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all bg-white";

  return (
    <form onSubmit={handleSave} className="space-y-3">
      <h4 className="font-semibold text-gray-800 text-sm">Add New Address</h4>

      {/* Type toggle */}
      <div className="flex gap-2">
        {(["WORK", "HOME"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex items-center gap-1.5 flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
              type === t
                ? "border-orange-400 bg-orange-50 text-orange-700"
                : "border-gray-200 text-gray-500 hover:border-gray-300"
            }`}
          >
            {t === "WORK" ? <Briefcase size={14} /> : <Home size={14} />}
            {t === "WORK" ? "Work" : "Home"}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
          {error}
        </div>
      )}

      <input id="addr-line1" type="text" value={line1} onChange={e => setLine1(e.target.value)} placeholder="Address line 1 *" className={inputCls} required />
      <input id="addr-line2" type="text" value={line2} onChange={e => setLine2(e.target.value)} placeholder="Floor / Building (optional)" className={inputCls} />
      <input id="addr-landmark" type="text" value={landmark} onChange={e => setLandmark(e.target.value)} placeholder="Landmark (optional)" className={inputCls} />
      <div className="flex gap-2">
        <input id="addr-city" type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="City" className={`${inputCls} flex-1`} />
        <input id="addr-pincode" type="text" inputMode="numeric" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="Pincode" className={`${inputCls} w-28`} />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 font-medium hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          id="addr-save"
          type="submit"
          disabled={saving || line1.trim().length < 5}
          className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Save Address
        </button>
      </div>
    </form>
  );
}

// ── AddressSheet ──────────────────────────────────────────────────────────────

export default function AddressSheet({ onConfirm, onClose }: Props) {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFormType, setAddFormType] = useState<"WORK" | "HOME">("HOME");

  useEffect(() => {
    fetch("/api/customer/addresses")
      .then(r => r.json())
      .then(d => {
        const addrs: Address[] = d.addresses ?? [];
        setAddresses(addrs);
        // Pre-select the default address (or first one)
        const def = addrs.find(a => a.isDefault) ?? addrs[0];
        if (def) setSelected(def.id);
        // If no addresses exist yet, show the add form immediately
        if (addrs.length === 0) setShowAddForm(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAddressSaved = (newAddr: Address) => {
    setAddresses(prev => [...prev, newAddr]);
    setSelected(newAddr.id);
    setShowAddForm(false);
  };

  const hasHome = addresses.some(a => a.type === "HOME");

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Select delivery address"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full bg-white rounded-t-3xl md:rounded-3xl md:max-w-md md:m-4 shadow-2xl max-h-[85dvh] overflow-y-auto" style={{ WebkitOverflowScrolling: "touch" }}>
        {/* Handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <MapPin size={18} className="text-orange-500" />
            <h2 className="font-bold text-gray-900 text-base">Delivery Address</h2>
          </div>
          <button
            id="address-sheet-close"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-orange-400" />
            </div>
          ) : showAddForm ? (
            <AddAddressForm
              defaultType={addFormType}
              onSaved={handleAddressSaved}
              onCancel={() => addresses.length > 0 && setShowAddForm(false)}
            />
          ) : (
            <>
              {/* Address cards */}
              <div className="space-y-3">
                {addresses.map(addr => (
                  <button
                    key={addr.id}
                    id={`addr-card-${addr.id}`}
                    type="button"
                    onClick={() => setSelected(addr.id)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                      selected === addr.id
                        ? "border-orange-400 bg-orange-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 p-1.5 rounded-lg ${selected === addr.id ? "bg-orange-100" : "bg-gray-100"}`}>
                        {addr.type === "WORK" ? (
                          <Briefcase size={14} className={selected === addr.id ? "text-orange-600" : "text-gray-500"} />
                        ) : (
                          <Home size={14} className={selected === addr.id ? "text-orange-600" : "text-gray-500"} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold uppercase tracking-wide ${selected === addr.id ? "text-orange-700" : "text-gray-500"}`}>
                            {addr.type === "WORK" ? "Work" : "Home"}
                          </span>
                          {addr.isDefault && (
                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md font-medium">Default</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 mt-0.5 truncate">{formatAddress(addr)}</p>
                      </div>
                      {selected === addr.id && (
                        <div className="mt-0.5 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                          <Check size={11} className="text-white" />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Add home address button (if no home address) */}
              {!hasHome && (
                <button
                  id="add-home-address"
                  type="button"
                  onClick={() => { setAddFormType("HOME"); setShowAddForm(true); }}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-all"
                >
                  <Plus size={16} />
                  Add Home Address
                </button>
              )}

              {/* Add new address */}
              <button
                id="add-new-address"
                type="button"
                onClick={() => { setAddFormType("HOME"); setShowAddForm(true); }}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-500 hover:border-orange-300 hover:text-orange-600 transition-all"
              >
                <Plus size={16} />
                Add Another Address
              </button>

              {/* Confirm CTA */}
              <button
                id="confirm-address"
                type="button"
                disabled={!selected}
                onClick={() => {
                  if (selected) {
                    const addr = addresses.find((a) => a.id === selected);
                    const addrText = addr ? formatAddress(addr) : "";
                    onConfirm(selected, addrText);
                  }
                }}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all shadow-md shadow-orange-500/25"
              >
                Deliver Here
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
