"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import { ActiveBadge } from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CategoryModal from "@/components/modals/CategoryModal";
import { useToast } from "@/hooks/useToast";

interface CategoryThali {
  id: string;
  name: string;
  nameGu?: string | null;
  sabjiCount: number;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  nameGu?: string | null;
  isActive: boolean;
  thalis: CategoryThali[];
}

export default function CategoriesTab() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/thali-categories");
      const json = await res.json();
      setCategories(json.categories ?? []);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (cat: Category) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, isActive: !c.isActive } : c))
    );
    try {
      const res = await fetch(`/api/thali-categories/${cat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success(cat.isActive ? "Deactivated" : "Activated");
    } catch (err: unknown) {
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, isActive: cat.isActive } : c))
      );
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/thali-categories/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success("Category deleted — its thalis are now uncategorized");
      setDeleteId(null);
      fetchCategories();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Category>[] = [
    {
      key: "name",
      header: "Category Name",
      render: (row) => (
        <div>
          <span className="font-medium text-gray-900 block">{row.name}</span>
          {row.nameGu && <span className="text-xs text-gray-400 font-normal">{row.nameGu}</span>}
        </div>
      ),
    },
    {
      key: "thalis",
      header: "Assigned Thalis",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.thalis.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No thalis assigned</span>
          ) : (
            row.thalis.map((t) => (
              <span
                key={t.id}
                className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-150"
              >
                {t.name}
              </span>
            ))
          )}
        </div>
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
            className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg cursor-pointer animate-none"
          >
            {row.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
          </button>
          <button
            onClick={() => {
              setEditCategory(row);
              setModalOpen(true);
            }}
            className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg cursor-pointer"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => setDeleteId(row.id)}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer"
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
          <h3 className="text-lg font-bold text-gray-900">Thali Categories</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Group thalis that share the same sabji choices (e.g. Small / Medium / Full Gujarati Thali)
          </p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => {
            setEditCategory(null);
            setModalOpen(true);
          }}
        >
          Add Category
        </Button>
      </div>

      <Table
        columns={columns}
        data={categories}
        isLoading={isLoading}
        emptyMessage="No categories found"
        emptySubMessage="Create a category to group thalis with shared sabji options"
      />

      {modalOpen && (
        <CategoryModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditCategory(null);
          }}
          onSuccess={fetchCategories}
          category={editCategory}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          message="Delete this category? Thalis assigned to it will become uncategorized (not deleted)."
        />
      )}
    </div>
  );
}
