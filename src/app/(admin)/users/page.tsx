"use client";

import { useEffect, useState } from "react";
import { Plus, Upload, Pencil, Trash2, ShieldCheck, ShieldOff, MapPin, Lock, CheckCircle, History } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import UserModal from "@/components/modals/UserModal";
import BulkUserModal from "@/components/modals/BulkUserModal";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatMobileNumber } from "@/lib/utils";
import { formatDateTimeIST } from "@/lib/time";

interface Company { id: string; name: string }
interface BanHistoryEntry {
  id: string;
  action: string;
  reason?: string | null;
  actedByStaffId: string;
  createdAt: string;
}
interface User {
  id: string;
  name: string;
  number: string;
  isActive: boolean;
  companyId: string;
  company: Company;
  isVerified: boolean;
  verifiedAt?: string | null;
  workAddress?: string | null;
  homeAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  status: "ACTIVE" | "BLOCKED" | "BANNED";
  statusReason?: string | null;
  statusChangedAt?: string | null;
  _count?: { deviceFingerprints: number };
}

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState(""); // "" | "verified" | "unverified"
  const [statusFilter, setStatusFilter] = useState(""); // "" | "ACTIVE" | "BLOCKED" | "BANNED"
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const debouncedSearch = useDebounce(search, 300);

  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for block/ban action modals
  const [actionUser, setActionUser] = useState<User | null>(null);
  const [actionType, setActionType] = useState<"BLOCK" | "BAN" | "UNBLOCK" | "UNBAN" | null>(null);
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Ban history viewer
  const [banHistoryUser, setBanHistoryUser] = useState<User | null>(null);
  const [banHistory, setBanHistory] = useState<BanHistoryEntry[]>([]);
  const [banHistoryLoading, setBanHistoryLoading] = useState(false);

  const fetchBanHistory = async (userId: string) => {
    setBanHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/ban-history`);
      if (res.ok) {
        const json = await res.json();
        setBanHistory(json.history ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setBanHistoryLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const json = await res.json();
        setCurrentUser(json.user);
      }
    } catch {}
  };

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
      if (verifiedFilter) params.set("isVerified", verifiedFilter === "verified" ? "true" : "false");
      if (statusFilter) params.set("status", statusFilter);
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

  useEffect(() => {
    fetchCompanies();
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, companyFilter, verifiedFilter, statusFilter]);

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

  const handleUserAction = async () => {
    if (!actionUser || !actionType) return;
    setActionLoading(true);
    try {
      const endpoint = `/api/admin/users/${actionUser.id}/${actionType.toLowerCase()}`;
      const payload = (actionType === "BLOCK" || actionType === "BAN") ? { reason: reason.trim() } : {};
      
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      
      toast.success(`User ${actionType.toLowerCase()}ed successfully`);
      setActionUser(null);
      setActionType(null);
      setReason("");
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setActionLoading(false);
    }
  };

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: "number",
      header: "Mobile",
      render: (row) => (
        <span className="text-gray-600 font-mono text-xs">{formatMobileNumber(row.number)}</span>
      ),
    },
    {
      key: "company",
      header: "Company",
      render: (row) => <span className="text-gray-600">{row.company?.name ?? "—"}</span>,
    },
    {
      key: "workAddress",
      header: "Work Address",
      render: (row) => (
        <div className="flex items-start gap-1 max-w-[200px]">
          {row.workAddress ? (
            <>
              {(row.latitude || row.longitude) && (
                <MapPin size={11} className="text-orange-400 flex-shrink-0 mt-0.5" aria-label="GPS coordinates set" />
              )}
              <span className="text-xs text-gray-500 line-clamp-2">{row.workAddress}</span>
            </>
          ) : (
            <span className="text-xs text-gray-300 italic">Not set</span>
          )}
        </div>
      ),
    },
    {
      key: "verified",
      header: "Verified",
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          {row.isVerified ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 font-medium">
              <ShieldCheck size={11} /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 font-medium">
              <ShieldOff size={11} /> Pending
            </span>
          )}
          {row.verifiedAt && (
            <span className="text-[10px] text-gray-400">{formatDateTimeIST(row.verifiedAt)}</span>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        if (row.status === "BANNED") {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-100 rounded-full px-2 py-0.5 font-medium" title={row.statusReason || ""}>
              Banned
            </span>
          );
        }
        if (row.status === "BLOCKED") {
          return (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5 font-medium" title={row.statusReason || ""}>
              Blocked
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-100 rounded-full px-2 py-0.5 font-medium">
            Active
          </span>
        );
      },
    },
    {
      key: "devices",
      header: "Devices",
      render: (row) => (
        <span className="text-xs text-gray-500 font-medium">
          {row._count?.deviceFingerprints ?? 0}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-28",
      render: (row) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setEditUser(row); setModalOpen(true); }}
            className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
            title="Edit user"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setDeleteId(row.id)}
            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete user"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => { setBanHistoryUser(row); fetchBanHistory(row.id); }}
            className="p-1 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
            title="View Ban History"
          >
            <History size={14} />
          </button>
          {row.status === "ACTIVE" && (
            <>
              <button
                onClick={() => { setActionUser(row); setActionType("BLOCK"); setReason(""); }}
                className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                title="Block User"
              >
                <ShieldOff size={14} />
              </button>
              {currentUser?.role === "ADMIN" && (
                <button
                  onClick={() => { setActionUser(row); setActionType("BAN"); setReason(""); }}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Ban User"
                >
                  <Lock size={14} />
                </button>
              )}
            </>
          )}
          {row.status === "BLOCKED" && (
            <>
              <button
                onClick={() => { setActionUser(row); setActionType("UNBLOCK"); }}
                className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                title="Unblock User"
              >
                <ShieldCheck size={14} />
              </button>
              {currentUser?.role === "ADMIN" && (
                <button
                  onClick={() => { setActionUser(row); setActionType("BAN"); setReason(""); }}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Ban User"
                >
                  <Lock size={14} />
                </button>
              )}
            </>
          )}
          {row.status === "BANNED" && currentUser?.role === "ADMIN" && (
            <button
              onClick={() => { setActionUser(row); setActionType("UNBAN"); }}
              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Unban User"
            >
              <CheckCircle size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const companyOptions = [
    { value: "", label: "All Companies" },
    ...companies.map((c) => ({ value: c.id, label: c.name })),
  ];

  const verifiedOptions = [
    { value: "", label: "All Verifications" },
    { value: "verified", label: "Verified Only" },
    { value: "unverified", label: "Unverified Only" },
  ];

  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: "ACTIVE", label: "Active Only" },
    { value: "BLOCKED", label: "Blocked Only" },
    { value: "BANNED", label: "Banned Only" },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage tiffin subscribers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Upload size={15} />} onClick={() => setBulkOpen(true)}>
            Bulk Import
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => { setEditUser(null); setModalOpen(true); }}
          >
            Add User
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or number..." className="w-64" />
        <Select options={companyOptions} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-52" />
        <Select options={verifiedOptions} value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value)} className="w-48" />
        <Select options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44" />
      </div>

      <Table
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="No users found"
        emptySubMessage={search ? "Try a different search" : "Add users or bulk import via CSV"}
      />

      {!isLoading && total > 0 && (
        <p className="text-xs text-gray-400">Showing {users.length} of {total} users</p>
      )}

      <UserModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditUser(null); }}
        onSuccess={fetchUsers}
        user={editUser}
        companies={companies}
      />
      <BulkUserModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} onSuccess={fetchUsers} />
      
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        message="Delete this user? This cannot be undone."
      />

      {/* Block/Ban Action Modal */}
      {actionUser && actionType && (
        <Modal
          isOpen={true}
          onClose={() => { setActionUser(null); setActionType(null); }}
          title={`${actionType === "BLOCK" ? "Block" : actionType === "BAN" ? "Ban" : actionType === "UNBLOCK" ? "Unblock" : "Unban"} User: ${actionUser.name}`}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => { setActionUser(null); setActionType(null); }}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                variant={actionType === "BLOCK" || actionType === "BAN" ? "danger" : "primary"}
                onClick={handleUserAction}
                isLoading={actionLoading}
              >
                Confirm
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Are you sure you want to {actionType.toLowerCase()} this user?
              {actionType === "BLOCK" && " This will suspend their ordering access and restrict their unique device."}
              {actionType === "BAN" && " This will permanently suspend their access and lock their unique device."}
              {actionType === "UNBLOCK" && " This will restore their active status."}
              {actionType === "UNBAN" && " This will restore their active status."}
            </p>

            {(actionType === "BLOCK" || actionType === "BAN") && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">Reason for {actionType.toLowerCase()}</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Provide a reason..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-gray-300 text-gray-700"
                  required
                />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Ban History Modal */}
      {banHistoryUser && (
        <Modal
          isOpen={true}
          onClose={() => { setBanHistoryUser(null); setBanHistory([]); }}
          title={`Ban History: ${banHistoryUser.name}`}
          size="md"
        >
          {banHistoryLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : banHistory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No ban/block history found for this user.</p>
          ) : (
            <div className="space-y-3">
              {banHistory.map((entry) => (
                <div key={entry.id} className="border border-gray-100 rounded-xl p-3 flex gap-3">
                  <span className={`inline-flex items-center text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                    entry.action === "BANNED" ? "bg-red-50 text-red-700" :
                    entry.action === "BLOCKED" ? "bg-amber-50 text-amber-700" :
                    "bg-green-50 text-green-700"
                  }`}>
                    {entry.action}
                  </span>
                  <div className="flex-1 min-w-0">
                    {entry.reason && (
                      <p className="text-xs text-gray-600 mb-1">{entry.reason}</p>
                    )}
                    <p className="text-[10px] text-gray-400">
                      {formatDateTimeIST(entry.createdAt)} · Staff: {entry.actedByStaffId.slice(0, 8)}…
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
