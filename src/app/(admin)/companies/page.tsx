"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import { ActiveBadge } from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CompanyModal from "@/components/modals/CompanyModal";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";

interface Company {
  id: string; name: string; location?: string | null; isActive: boolean;
  _count: { users: number };
}

export default function CompaniesPage() {
  const toast = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [modalOpen, setModalOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ search: debouncedSearch });
      const res = await fetch(`/api/companies?${params}`);
      const json = await res.json();
      setCompanies(json.companies ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Failed to load companies");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, [debouncedSearch]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/companies/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Company deleted");
      setDeleteId(null);
      fetchCompanies();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Company>[] = [
    { key: "name", header: "Company Name", render: (row) => (
      <span className="font-medium text-gray-900">{row.name}</span>
    )},
    { key: "location", header: "Location", render: (row) => (
      <span className="text-gray-500">{row.location || "—"}</span>
    )},
    { key: "users", header: "Users", render: (row) => (
      <span className="text-gray-600">{row._count.users}</span>
    )},
    { key: "status", header: "Status", render: (row) => <ActiveBadge isActive={row.isActive} /> },
    { key: "actions", header: "Actions", width: "w-24", render: (row) => (
      <div className="flex items-center gap-1">
        <button onClick={() => { setEditCompany(row); setModalOpen(true); }}
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Companies</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage tiffin client companies</p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />}
          onClick={() => { setEditCompany(null); setModalOpen(true); }}>
          Add Company
        </Button>
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={setSearch} placeholder="Search companies..." className="max-w-xs" />

      {/* Table */}
      <Table columns={columns} data={companies} isLoading={isLoading}
        emptyMessage="No companies found"
        emptySubMessage={search ? "Try a different search term" : "Add your first company to get started"} />

      {/* Footer */}
      {!isLoading && total > 0 && (
        <p className="text-xs text-gray-400">Showing {companies.length} of {total} companies</p>
      )}

      {/* Modals */}
      <CompanyModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditCompany(null); }}
        onSuccess={fetchCompanies} company={editCompany} />
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        isLoading={isDeleting}
        message="Are you sure you want to delete this company? This cannot be undone." />
    </div>
  );
}
