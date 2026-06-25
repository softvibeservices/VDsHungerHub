"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import { ActiveBadge } from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ThaliModal from "@/components/modals/ThaliModal";
import { useToast } from "@/hooks/useToast";
import { formatCurrency } from "@/lib/utils";

interface ThaliItem { id: string; itemName: string; sortOrder: number }
interface Thali {
  id: string; name: string; price: number; description?: string | null;
  maxSabjiCount: number; isActive: boolean; items: ThaliItem[];
}

export default function ThalisPage() {
  const toast = useToast();
  const [thalis, setThalis] = useState<Thali[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editThali, setEditThali] = useState<Thali | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchThalis = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/thalis");
      const json = await res.json();
      setThalis(json.thalis ?? []);
    } catch {
      toast.error("Failed to load thalis");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchThalis(); }, []);

  const handleToggle = async (thali: Thali) => {
    setTogglingId(thali.id);
    try {
      const res = await fetch(`/api/thalis/${thali.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...thali,
          items: thali.items.map((i) => i.itemName),
          isActive: !thali.isActive,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(thali.isActive ? "Thali deactivated" : "Thali activated");
      fetchThalis();
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
      const res = await fetch(`/api/thalis/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Thali deleted");
      setDeleteId(null);
      fetchThalis();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const sabjiLabel = (count: number) =>
    count === 0 ? "Fixed only" : count === 1 ? "Pick 1 sabji" : `Pick ${count} sabji`;

  const columns: Column<Thali>[] = [
    { key: "name", header: "Thali Name", render: (row) => (
      <div>
        <p className="font-medium text-gray-900">{row.name}</p>
        {row.description && <p className="text-xs text-gray-400 mt-0.5">{row.description}</p>}
      </div>
    )},
    { key: "price", header: "Price", render: (row) => (
      <span className="font-semibold text-gray-900">{formatCurrency(row.price)}</span>
    )},
    { key: "sabji", header: "Sabji", render: (row) => (
      <span className={`text-xs px-2 py-0.5 rounded-full ${row.maxSabjiCount > 0 ? "bg-orange-50 text-orange-600 border border-orange-200" : "bg-gray-100 text-gray-500"}`}>
        {sabjiLabel(row.maxSabjiCount)}
      </span>
    )},
    { key: "items", header: "Fixed Items", render: (row) => (
      <span className="text-xs text-gray-500">
        {row.items.map((i) => i.itemName).join(", ") || "—"}
      </span>
    )},
    { key: "status", header: "Status", render: (row) => <ActiveBadge isActive={row.isActive} /> },
    { key: "actions", header: "Actions", width: "w-28", render: (row) => (
      <div className="flex gap-1">
        <button onClick={() => handleToggle(row)} disabled={togglingId === row.id}
          className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
          {row.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
        </button>
        <button onClick={() => { setEditThali(row); setModalOpen(true); }}
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
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Thalis</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage meal combinations</p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />}
          onClick={() => { setEditThali(null); setModalOpen(true); }}>
          Add Thali
        </Button>
      </div>

      <Table columns={columns} data={thalis} isLoading={isLoading}
        emptyMessage="No thalis found" emptySubMessage="Create your first meal combination" />

      <ThaliModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditThali(null); }}
        onSuccess={fetchThalis} thali={editThali} />
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        isLoading={isDeleting} message="Delete this thali? It cannot be removed if currently used in a daily menu." />
    </div>
  );
}
