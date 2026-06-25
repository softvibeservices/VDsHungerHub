"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import { ActiveBadge } from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import StaffModal from "@/components/modals/StaffModal";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatMobileNumber } from "@/lib/utils";

interface Staff { id: string; name: string; number: string; isActive: boolean; }

export default function StaffPage() {
  const toast = useToast();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [modalOpen, setModalOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<Staff | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ search: debouncedSearch });
      const res = await fetch(`/api/staff?${params}`);
      const json = await res.json();
      setStaff(json.staff ?? []);
    } catch {
      toast.error("Failed to load staff");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchStaff(); }, [debouncedSearch]);

  const handleToggle = async (member: Staff) => {
    setTogglingId(member.id);
    try {
      const res = await fetch(`/api/staff/${member.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...member, isActive: !member.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(member.isActive ? "Staff deactivated" : "Staff activated");
      fetchStaff();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/staff/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Staff member removed");
      setDeleteId(null);
      fetchStaff();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Staff>[] = [
    { key: "name", header: "Name", render: (row) => <span className="font-medium text-gray-900">{row.name}</span> },
    { key: "number", header: "Mobile", render: (row) => <span className="text-gray-600 font-mono text-xs">{formatMobileNumber(row.number)}</span> },
    { key: "status", header: "Status", render: (row) => <ActiveBadge isActive={row.isActive} /> },
    { key: "actions", header: "Actions", width: "w-28", render: (row) => (
      <div className="flex gap-1">
        <button onClick={() => handleToggle(row)} disabled={togglingId === row.id}
          className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
          {row.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
        </button>
        <button onClick={() => { setEditStaff(row); setModalOpen(true); }}
          className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
          <Pencil size={15} />
        </button>
        <button onClick={() => setDeleteId(row.id)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
          <Trash2 size={15} />
        </button>
      </div>
    )},
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Staff</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kitchen and delivery personnel</p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />}
          onClick={() => { setEditStaff(null); setModalOpen(true); }}>
          Add Staff
        </Button>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search staff..." className="max-w-xs" />

      <Table columns={columns} data={staff} isLoading={isLoading}
        emptyMessage="No staff members found" />

      <StaffModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditStaff(null); }}
        onSuccess={fetchStaff} staff={editStaff} />
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        isLoading={isDeleting} message="Remove this staff member? This cannot be undone." />
    </div>
  );
}
