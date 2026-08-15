// src\app\(admin)\catalog\_ProductsTab.tsx

"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Upload } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import { ActiveBadge } from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ProductModal from "@/components/modals/ProductModal";
import BulkProductModal from "@/components/modals/BulkProductModal";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { hasPermission } from "@/lib/rbac-client";

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  quantity: string;
  price: number;
  isActive: boolean;
  isAddOnAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function ProductsTab() {
  const toast = useToast();
  const currentUser = useCurrentUser();
  const canManageMenu = hasPermission(currentUser, "menu:manage");

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ search: debouncedSearch });
      if (activeFilter !== "") params.set("isActive", activeFilter);
      const res = await fetch(`/api/products?${params}`);
      const json = await res.json();
      setProducts(json.products ?? []);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, activeFilter]);

  const handleToggle = async (product: Product) => {
    if (!canManageMenu) return;
    // Optimistic UI update
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, isActive: !p.isActive } : p))
    );
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !product.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(product.isActive ? "Deactivated" : "Activated");
    } catch (err: unknown) {
      // Revert state on failure
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: product.isActive } : p))
      );
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const handleInlinePriceSave = async (id: string, newPrice: number) => {
    if (!canManageMenu) return;
    setEditingPriceId(null);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error("Please enter a valid price");
      return;
    }

    const product = products.find((p) => p.id === id);
    if (!product || product.price === newPrice) return;

    // Optimistically update local state
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, price: newPrice } : p))
    );

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: newPrice }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Price updated");
    } catch (err: unknown) {
      // Revert on error
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, price: product.price } : p))
      );
      toast.error(err instanceof Error ? err.message : "Failed to update price");
    }
  };

  const handleDelete = async () => {
    if (!deleteId || !canManageMenu) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Product deleted");
      setDeleteId(null);
      fetchProducts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: "name",
      header: "Item Name",
      render: (row) => (
        <div>
          <span className="font-medium text-gray-900 block">{row.name}</span>
          {row.nameGu && <span className="text-xs text-gray-400 font-normal">{row.nameGu}</span>}
        </div>
      ),
    },
    {
      key: "quantity",
      header: "Quantity",
      render: (row) => <span className="text-gray-600">{row.quantity}</span>,
    },
    {
      key: "price",
      header: "Price",
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          {canManageMenu && editingPriceId === row.id ? (
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
              className={`font-semibold text-gray-900 px-1 py-0.5 rounded transition-colors ${
                canManageMenu ? "cursor-pointer hover:text-orange-600 hover:underline" : ""
              }`}
              onClick={canManageMenu ? () => setEditingPriceId(row.id) : undefined}
              title={canManageMenu ? "Click to edit price" : undefined}
            >
              {formatCurrency(row.price)}
            </span>
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
          {canManageMenu && (
            <>
              <button
                onClick={() => handleToggle(row)}
                className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                title={row.isActive ? "Deactivate" : "Activate"}
              >
                {row.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
              </button>
              <button
                onClick={() => {
                  setEditProduct(row);
                  setModalOpen(true);
                }}
                className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                title="Edit"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => setDeleteId(row.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  const statusOptions = [
    { value: "", label: "All Products" },
    { value: "true", label: "Active Only" },
    { value: "false", label: "Inactive Only" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Products</h3>
          <p className="text-xs text-gray-500 mt-0.5">Sabji items used to build thalis</p>
        </div>
        {canManageMenu && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<Upload size={16} />}
              onClick={() => setBulkModalOpen(true)}
            >
              Bulk Upload
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={() => {
                setEditProduct(null);
                setModalOpen(true);
              }}
            >
              Add Product
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products..." className="w-full sm:w-64" />
        <Select options={statusOptions} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="w-full sm:w-40" />
      </div>

      <Table
        columns={columns}
        data={products}
        isLoading={isLoading}
        emptyMessage="No products found"
        emptySubMessage="Add sabji items to use in thali creation"
        mobileCardRender={(row) => (
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div>
                <h4 className="font-bold text-gray-900 text-sm">{row.name}</h4>
                {row.nameGu && <p className="text-xs text-gray-400 font-normal">{row.nameGu}</p>}
              </div>
              <ActiveBadge isActive={row.isActive} />
            </div>
            <div className="flex justify-between items-center text-xs text-gray-600">
              <span>Qty: <strong>{row.quantity}</strong></span>
              <span className="font-bold text-gray-900 text-sm">{formatCurrency(row.price)}</span>
            </div>
            {canManageMenu && (
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={() => handleToggle(row)}
                  className="flex-1 py-1.5 px-3 text-xs font-semibold bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {row.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                  <span>{row.isActive ? "Deactivate" : "Activate"}</span>
                </button>
                <button
                  onClick={() => {
                    setEditProduct(row);
                    setModalOpen(true);
                  }}
                  className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg cursor-pointer"
                  title="Edit"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => setDeleteId(row.id)}
                  className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      />

      {modalOpen && canManageMenu && (
        <ProductModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditProduct(null);
          }}
          onSuccess={fetchProducts}
          product={editProduct}
        />
      )}

      {bulkModalOpen && canManageMenu && (
        <BulkProductModal
          isOpen={bulkModalOpen}
          onClose={() => setBulkModalOpen(false)}
          onSuccess={fetchProducts}
        />
      )}

      {deleteId && canManageMenu && (
        <ConfirmDialog
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          message="Delete this product? It cannot be removed if used in a daily menu."
        />
      )}
    </div>
  );
}
