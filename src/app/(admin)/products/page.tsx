"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import { ActiveBadge } from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ProductModal from "@/components/modals/ProductModal";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency } from "@/lib/utils";

interface Product { id: string; name: string; quantity: string; price: number; isActive: boolean; }

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [modalOpen, setModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  useEffect(() => { fetchProducts(); }, [debouncedSearch, activeFilter]);

  const handleToggle = async (product: Product) => {
    setTogglingId(product.id);
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, isActive: !product.isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(product.isActive ? "Product deactivated" : "Product activated");
      fetchProducts();
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
    { key: "name", header: "Item Name", render: (row) => <span className="font-medium text-gray-900">{row.name}</span> },
    { key: "quantity", header: "Quantity", render: (row) => <span className="text-gray-600">{row.quantity}</span> },
    { key: "price", header: "Price", render: (row) => <span className="font-semibold text-gray-900">{formatCurrency(row.price)}</span> },
    { key: "status", header: "Status", render: (row) => <ActiveBadge isActive={row.isActive} /> },
    { key: "actions", header: "Actions", width: "w-28", render: (row) => (
      <div className="flex gap-1">
        <button onClick={() => handleToggle(row)} disabled={togglingId === row.id}
          className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors">
          {row.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
        </button>
        <button onClick={() => { setEditProduct(row); setModalOpen(true); }}
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

  const statusOptions = [
    { value: "", label: "All Products" },
    { value: "true", label: "Active Only" },
    { value: "false", label: "Inactive Only" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Products</h2>
          <p className="text-sm text-gray-500 mt-0.5">Sabji items used to build thalis</p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />}
          onClick={() => { setEditProduct(null); setModalOpen(true); }}>
          Add Product
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search products..." className="w-64" />
        <Select options={statusOptions} value={activeFilter} onChange={(e) => setActiveFilter(e.target.value)} className="w-40" />
      </div>

      <Table columns={columns} data={products} isLoading={isLoading}
        emptyMessage="No products found" emptySubMessage="Add sabji items to use in thali creation" />

      <ProductModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditProduct(null); }}
        onSuccess={fetchProducts} product={editProduct} />
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        isLoading={isDeleting} message="Delete this product? It cannot be removed if used in a daily menu." />
    </div>
  );
}
