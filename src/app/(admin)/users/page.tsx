"use client";

import { useEffect, useState } from "react";
import { Plus, Upload, Pencil, Trash2 } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import { ActiveBadge } from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import UserModal from "@/components/modals/UserModal";
import BulkUserModal from "@/components/modals/BulkUserModal";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatMobileNumber } from "@/lib/utils";

interface Company { id: string; name: string }
interface User {
  id: string; name: string; number: string; isActive: boolean; companyId: string;
  company: Company;
}

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCompanies = async () => {
    const res = await fetch("/api/companies?limit=500");
    const json = await res.json();
    setCompanies(json.companies ?? []);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ search: debouncedSearch });
      if (companyFilter) params.set("companyId", companyFilter);
      const res = await fetch(`/api/users?${params}`);
      const json = await res.json();
      setUsers(json.users ?? []);
      setTotal(json.total ?? 0);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCompanies(); }, []);
  useEffect(() => { fetchUsers(); }, [debouncedSearch, companyFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("User deleted");
      setDeleteId(null);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<User>[] = [
    { key: "name", header: "Name", render: (row) => <span className="font-medium text-gray-900">{row.name}</span> },
    { key: "number", header: "Mobile", render: (row) => <span className="text-gray-600 font-mono text-xs">{formatMobileNumber(row.number)}</span> },
    { key: "company", header: "Company", render: (row) => <span className="text-gray-600">{row.company?.name ?? "—"}</span> },
    { key: "status", header: "Status", render: (row) => <ActiveBadge isActive={row.isActive} /> },
    { key: "actions", header: "Actions", width: "w-24", render: (row) => (
      <div className="flex gap-1">
        <button onClick={() => { setEditUser(row); setModalOpen(true); }}
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

  const companyOptions = [
    { value: "", label: "All Companies" },
    ...companies.map((c) => ({ value: c.id, label: c.name })),
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage tiffin subscribers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Upload size={15} />} onClick={() => setBulkOpen(true)}>
            Bulk Import
          </Button>
          <Button variant="primary" leftIcon={<Plus size={16} />}
            onClick={() => { setEditUser(null); setModalOpen(true); }}>
            Add User
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or number..." className="w-64" />
        <Select options={companyOptions} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-52" />
      </div>

      <Table columns={columns} data={users} isLoading={isLoading}
        emptyMessage="No users found"
        emptySubMessage={search ? "Try a different search" : "Add users or bulk import via CSV"} />

      {!isLoading && total > 0 && (
        <p className="text-xs text-gray-400">Showing {users.length} of {total} users</p>
      )}

      <UserModal isOpen={modalOpen} onClose={() => { setModalOpen(false); setEditUser(null); }}
        onSuccess={fetchUsers} user={editUser} companies={companies} />
      <BulkUserModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} onSuccess={fetchUsers} />
      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete}
        isLoading={isDeleting} message="Delete this user? This cannot be undone." />
    </div>
  );
}
