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
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
  description?: string | null;
  sabjiCount: number;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  isActive: boolean;
  items: ThaliItem[];
  sabjiPool?: { productId: string; product: { name: string } }[];
}

export default function ThalisTab() {
  const toast = useToast();
  const [thalis, setThalis] = useState<Thali[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editThali, setEditThali] = useState<Thali | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);

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

  useEffect(() => {
    fetchThalis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (thali: Thali) => {
    // Optimistic UI update
    setThalis((prev) =>
      prev.map((t) => (t.id === thali.id ? { ...t, isActive: !t.isActive } : t))
    );
    try {
      const res = await fetch(`/api/thalis/${thali.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !thali.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(thali.isActive ? "Deactivated" : "Activated");
    } catch (err: unknown) {
      // Revert state on failure
      setThalis((prev) =>
        prev.map((t) => (t.id === thali.id ? { ...t, isActive: thali.isActive } : t))
      );
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const handleInlinePriceSave = async (id: string, newPrice: number) => {
    setEditingPriceId(null);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    const thali = thalis.find((t) => t.id === id);
    if (!thali || thali.price === newPrice) return;

    // Optimistically update local state
    setThalis((prev) =>
      prev.map((t) => (t.id === id ? { ...t, price: newPrice } : t))
    );

    try {
      const res = await fetch(`/api/thalis/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: newPrice }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Price updated");
    } catch (err: unknown) {
      // Revert on error
      setThalis((prev) =>
        prev.map((t) => (t.id === id ? { ...t, price: thali.price } : t))
      );
      toast.error(err instanceof Error ? err.message : "Failed to update price");
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
    {
      key: "name",
      header: "Thali Name",
      render: (row) => (
        <div>
          <span className="font-medium text-gray-900 block">{row.name}</span>
          {row.nameGu && <span className="text-xs text-gray-400 font-normal">{row.nameGu}</span>}
          {row.description && <p className="text-xs text-gray-400 mt-0.5">{row.description}</p>}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) => row.category ? (
        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-150">
          {row.category.name}
        </span>
      ) : (
        <span className="text-xs text-gray-400 italic">Uncategorized</span>
      ),
    },
    {
      key: "price",
      header: "Price",
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          {editingPriceId === row.id ? (
            <input
              autoFocus
              type="number"
              defaultValue={row.price}
              onBlur={(e) => handleInlinePriceSave(row.id, Number(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleInlinePriceSave(row.id, Number(e.currentTarget.value));
                } else if (e.key === "Escape") {
                  setEditingPriceId(null);
                }
              }}
              className="w-20 px-1.5 py-0.5 text-sm border border-orange-400 rounded-lg focus:ring-2 focus:ring-orange-500/30 font-semibold text-gray-900"
            />
          ) : (
            <span
              className="font-semibold text-gray-900 cursor-pointer hover:text-orange-600 hover:underline px-1 py-0.5 rounded transition-colors"
              onClick={() => setEditingPriceId(row.id)}
              title="Click to edit price"
            >
              {formatCurrency(row.price)}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "sabji",
      header: "Sabji Count",
      render: (row) => {
        const allowedCount = row.sabjiPool?.length ?? 0;
        return (
          <div>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                row.sabjiCount > 0
                  ? "bg-orange-50 text-orange-600 border border-orange-200"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {sabjiLabel(row.sabjiCount)}
            </span>
            {row.sabjiCount > 0 && (
              <p className="text-[10px] text-gray-400 mt-1 font-medium">{allowedCount} pool options</p>
            )}
          </div>
        );
      },
    },
    {
      key: "items",
      header: "Fixed Items",
      render: (row) => (
        <span className="text-xs text-gray-500">
          {row.items.map((i) => i.itemName).join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => <ActiveBadge isActive={row.isActive} />,
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-28",
      render: (row) => (
        <div className="flex gap-1">
          <button
            onClick={() => handleToggle(row)}
            className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
          >
            {row.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
          </button>
          <button
            onClick={() => {
              setEditThali(row);
              setModalOpen(true);
            }}
            className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setDeleteId(row.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Thalis</h3>
          <p className="text-xs text-gray-500 mt-0.5">Manage meal combinations</p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => {
            setEditThali(null);
            setModalOpen(true);
          }}
        >
          Add Thali
        </Button>
      </div>

      <Table
        columns={columns}
        data={thalis}
        isLoading={isLoading}
        emptyMessage="No thalis found"
        emptySubMessage="Create your first meal combination"
      />

      {modalOpen && (
        <ThaliModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditThali(null);
          }}
          onSuccess={fetchThalis}
          thali={editThali}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          message="Delete this thali? It cannot be removed if currently used in a daily menu."
        />
      )}
    </div>
  );
}
