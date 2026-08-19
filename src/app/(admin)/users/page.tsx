// src\app\(admin)\users\page.tsx

"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  Upload,
  Pencil,
  Trash2,
  ShieldCheck,
  ShieldOff,
  MapPin,
  Lock,
  CheckCircle,
  History,
  ChevronLeft,
  ChevronRight,
  IndianRupee,
  CheckSquare,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import PageToolbar from "@/components/ui/PageToolbar";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Badge from "@/components/ui/Badge";
import UserModal from "@/components/modals/UserModal";
import BulkUserModal from "@/components/modals/BulkUserModal";
import UserAddressesModal from "@/components/modals/UserAddressesModal";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatMobileNumber } from "@/lib/utils";
import { formatDateTimeIST } from "@/lib/time";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { hasPermission } from "@/lib/rbac-client";

interface Company {
  id: string;
  name: string;
}

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
  pendingDue?: number;
  _count?: { deviceFingerprints: number; addresses?: number };
}

export default function UsersPage() {
  const toast = useToast();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const canModerateUsers = hasPermission(currentUser, "users:moderate");

  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState(""); // "" | "verified" | "unverified"
  const [statusFilter, setStatusFilter] = useState(""); // "" | "ACTIVE" | "BLOCKED" | "BANNED"
  const debouncedSearch = useDebounce(search, 300);

  // Pagination & Sorting states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [dueSort, setDueSort] = useState<"" | "asc" | "desc">(""); // "" | "asc" | "desc"

  const handlePendingDueSortClick = () => {
    setDueSort((prev) => {
      if (prev === "") return "asc";
      if (prev === "asc") return "desc";
      return "";
    });
  };

  // Selection & Bulk actions states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionType, setBulkActionType] = useState<"DELETE" | "BLOCK" | "UNBLOCK" | "BAN" | "UNBAN" | null>(null);
  const [bulkReason, setBulkReason] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [addressModalUser, setAddressModalUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for single block/ban action modal
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

  const fetchCompanies = async () => {
    try {
      const res = await fetch("/api/companies?limit=500");
      const json = await res.json();
      setCompanies(json.companies ?? []);
    } catch {
      // silently fail
    }
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        page: String(page),
        limit: String(limit),
      });
      if (companyFilter) params.set("companyId", companyFilter);
      if (verifiedFilter) params.set("isVerified", verifiedFilter === "verified" ? "true" : "false");
      if (statusFilter) params.set("status", statusFilter);
      if (dueSort) params.set("sortBy", dueSort === "asc" ? "due_asc" : "due_desc");

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
  }, []);

  // Reset page to 1 whenever search, filters, limit or sort change
  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [debouncedSearch, companyFilter, verifiedFilter, statusFilter, limit, dueSort]);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, companyFilter, verifiedFilter, statusFilter, page, limit, dueSort]);

  const handleDelete = async () => {
    if (!deleteId || !isAdmin) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("User deleted");
      setDeleteId(null);
      setSelectedIds((prev) => prev.filter((id) => id !== deleteId));
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUserAction = async () => {
    if (!actionUser || !actionType) return;
    if ((actionType === "BAN" || actionType === "UNBAN") && !isAdmin) {
      toast.error("Ban actions require ADMIN role");
      return;
    }
    if ((actionType === "BLOCK" || actionType === "UNBLOCK") && !canModerateUsers) {
      toast.error("Block actions require users:moderate permission");
      return;
    }
    setActionLoading(true);
    try {
      const endpoint = `/api/admin/users/${actionUser.id}/${actionType.toLowerCase()}`;
      const payload = actionType === "BLOCK" || actionType === "BAN" ? { reason: reason.trim() } : {};

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

  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || !bulkActionType) return;
    setBulkLoading(true);
    try {
      const res = await fetch("/api/admin/users/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selectedIds,
          action: bulkActionType,
          reason: bulkReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bulk action failed");

      toast.success(`Bulk ${bulkActionType.toLowerCase()} executed on ${data.count ?? selectedIds.length} users`);
      setBulkActionType(null);
      setBulkReason("");
      setSelectedIds([]);
      fetchUsers();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Bulk operation failed");
    } finally {
      setBulkLoading(false);
    }
  };

  const isAllPageSelected = users.length > 0 && users.every((u) => selectedIds.includes(u.id));

  const toggleSelectAllPage = () => {
    if (isAllPageSelected) {
      const pageIds = new Set(users.map((u) => u.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const pageIds = users.map((u) => u.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectRow = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const totalPages = Math.ceil(total / limit) || 1;

  const columns: Column<User>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={isAllPageSelected}
          onChange={toggleSelectAllPage}
          className="rounded border-gray-300 text-orange-600 focus:ring-orange-400 cursor-pointer"
          title="Select/Deselect all on this page"
        />
      ),
      width: "w-10",
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleSelectRow(row.id)}
          className="rounded border-gray-300 text-orange-600 focus:ring-orange-400 cursor-pointer"
        />
      ),
    },
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
      key: "pendingDue",
      header: (
        <button
          type="button"
          onClick={handlePendingDueSortClick}
          className="flex items-center gap-1 hover:text-gray-900 transition-colors cursor-pointer group select-none"
          title="Click to toggle sorting: Low-to-High (ASC) -> High-to-Low (DESC) -> Normal"
        >
          <span>Pending Due</span>
          {dueSort === "asc" && <ArrowUp size={13} className="text-orange-600 font-bold" />}
          {dueSort === "desc" && <ArrowDown size={13} className="text-orange-600 font-bold" />}
          {dueSort === "" && <ArrowUpDown size={12} className="text-gray-400 group-hover:text-gray-600 opacity-60" />}
        </button>
      ),
      render: (row) => {
        const due = row.pendingDue ?? 0;
        if (due > 0) {
          return (
            <span className="inline-flex items-center font-bold text-red-700 bg-red-50 border border-red-200/80 px-2.5 py-1 rounded-full text-xs shadow-2xs">
              ₹{due.toFixed(2)}
            </span>
          );
        }
        return <span className="text-gray-400 text-xs font-mono font-medium">₹0.00</span>;
      },
    },
    {
      key: "workAddress",
      header: "Work Address",
      render: (row) => (
        <div className="space-y-1 max-w-[200px]">
          <div className="flex items-start gap-1">
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
          <button
            type="button"
            onClick={() => setAddressModalUser(row)}
            className="text-[11px] font-bold text-orange-600 hover:text-orange-700 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <MapPin size={11} className="text-orange-500 shrink-0" />
            <span>{row._count?.addresses ? `Addresses (${row._count.addresses})` : "Manage Addresses"}</span>
          </button>
        </div>
      ),
    },
    {
      key: "verified",
      header: "Verified",
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          {row.isVerified ? (
            <Badge variant="success" icon={ShieldCheck} label="Verified" />
          ) : (
            <Badge variant="warning" icon={ShieldOff} label="Pending" />
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
          return <Badge variant="danger" label="Banned" className="cursor-help" />;
        }
        if (row.status === "BLOCKED") {
          return <Badge variant="warning" label="Blocked" className="cursor-help" />;
        }
        return <Badge variant="success" label="Active" />;
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
          {isAdmin && (
            <>
              <button
                onClick={() => {
                  setEditUser(row);
                  setModalOpen(true);
                }}
                className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                title="Edit user"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setDeleteId(row.id)}
                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete user"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}

          <button
            onClick={() => {
              setBanHistoryUser(row);
              fetchBanHistory(row.id);
            }}
            className="p-1 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
            title="View Ban History"
          >
            <History size={14} />
          </button>

          {row.status === "ACTIVE" && (
            <>
              {canModerateUsers && (
                <button
                  onClick={() => {
                    setActionUser(row);
                    setActionType("BLOCK");
                    setReason("");
                  }}
                  className="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                  title="Block User"
                >
                  <ShieldOff size={14} />
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => {
                    setActionUser(row);
                    setActionType("BAN");
                    setReason("");
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Ban User"
                >
                  <Lock size={14} />
                </button>
              )}
            </>
          )}

          {row.status === "BLOCKED" && (
            <>
              {canModerateUsers && (
                <button
                  onClick={() => {
                    setActionUser(row);
                    setActionType("UNBLOCK");
                  }}
                  className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
                  title="Unblock User"
                >
                  <ShieldCheck size={14} />
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => {
                    setActionUser(row);
                    setActionType("BAN");
                    setReason("");
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Ban User"
                >
                  <Lock size={14} />
                </button>
              )}
            </>
          )}

          {row.status === "BANNED" && isAdmin && (
            <button
              onClick={() => {
                setActionUser(row);
                setActionType("UNBAN");
              }}
              className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors cursor-pointer"
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
    <div className="space-y-6">
      <PageToolbar
        filters={
          <>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search by name or number..."
              className="w-64"
            />
            <Select
              options={companyOptions}
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-52"
            />
            <Select
              options={verifiedOptions}
              value={verifiedFilter}
              onChange={(e) => setVerifiedFilter(e.target.value)}
              className="w-48"
            />
            <Select
              options={statusOptions}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-44"
            />
          </>
        }
        actions={
          isAdmin ? (
            <>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Upload size={15} />}
                onClick={() => setBulkOpen(true)}
              >
                Bulk Import
              </Button>
              <Button
                variant="primary"
                leftIcon={<Plus size={16} />}
                onClick={() => {
                  setEditUser(null);
                  setModalOpen(true);
                }}
              >
                Add User
              </Button>
            </>
          ) : undefined
        }
      />

      {/* ── Bulk Actions Floating Toolbar ───────────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="bg-[#0F1E3D] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between flex-wrap gap-3 animate-fadeIn border border-[#C9A84C]/30">
          <div className="flex items-center gap-2">
            <CheckSquare size={18} className="text-[#C9A84C]" />
            <span className="text-xs font-bold">
              {selectedIds.length} user{selectedIds.length > 1 ? "s" : ""} selected
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {canModerateUsers && (
              <>
                <button
                  onClick={() => setBulkActionType("BLOCK")}
                  className="px-3 py-1.5 text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded-xl transition-all border border-amber-500/30 cursor-pointer"
                >
                  Bulk Block
                </button>
                <button
                  onClick={() => setBulkActionType("UNBLOCK")}
                  className="px-3 py-1.5 text-xs font-bold bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-xl transition-all border border-green-500/30 cursor-pointer"
                >
                  Bulk Unblock
                </button>
              </>
            )}
            {isAdmin && (
              <>
                <button
                  onClick={() => setBulkActionType("BAN")}
                  className="px-3 py-1.5 text-xs font-bold bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-all border border-red-500/30 cursor-pointer"
                >
                  Bulk Ban
                </button>
                <button
                  onClick={() => setBulkActionType("UNBAN")}
                  className="px-3 py-1.5 text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl transition-all border border-emerald-500/30 cursor-pointer"
                >
                  Bulk Unban
                </button>
                <button
                  onClick={() => setBulkActionType("DELETE")}
                  className="px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Bulk Delete
                </button>
              </>
            )}
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* ── Main Users Table ────────────────────────────────────────────────── */}
      <Table
        columns={columns}
        data={users}
        isLoading={isLoading}
        emptyMessage="No users found"
        emptySubMessage={search ? "Try a different search" : "Add users or bulk import via CSV"}
        mobileCardRender={(row) => (
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-start gap-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(row.id)}
                  onChange={() => toggleSelectRow(row.id)}
                  className="mt-1 rounded border-gray-300 text-orange-600 focus:ring-orange-400 cursor-pointer"
                />
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">{row.name}</h4>
                  <p className="text-xs text-gray-500 font-mono">{formatMobileNumber(row.number)}</p>
                  {row.company && (
                    <span className="inline-block text-[10px] px-2 py-0.5 mt-1 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                      {row.company.name}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {row.status === "BANNED" ? (
                  <Badge variant="danger" label="Banned" />
                ) : row.status === "BLOCKED" ? (
                  <Badge variant="warning" label="Blocked" />
                ) : (
                  <Badge variant="success" label="Active" />
                )}
                {row.pendingDue !== undefined && row.pendingDue > 0 && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                    Due: ₹{row.pendingDue.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
            {row.workAddress && (
              <p className="text-xs text-gray-500 line-clamp-2">
                <strong>Address:</strong> {row.workAddress}
              </p>
            )}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100 flex-wrap">
              <button
                onClick={() => setAddressModalUser(row)}
                className="px-2.5 py-1 text-xs font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 rounded-lg flex items-center gap-1 cursor-pointer"
                title="Manage Addresses"
              >
                <MapPin size={13} className="text-orange-500" />
                <span>{row._count?.addresses ? `Addresses (${row._count.addresses})` : "Addresses"}</span>
              </button>
              <button
                onClick={() => {
                  setBanHistoryUser(row);
                  fetchBanHistory(row.id);
                }}
                className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer"
                title="Ban History"
              >
                <History size={16} />
              </button>
              {canModerateUsers && row.status === "ACTIVE" && (
                <button
                  onClick={() => {
                    setActionUser(row);
                    setActionType("BLOCK");
                    setReason("");
                  }}
                  className="px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-md cursor-pointer"
                >
                  Block
                </button>
              )}
              {canModerateUsers && row.status === "BLOCKED" && (
                <button
                  onClick={() => {
                    setActionUser(row);
                    setActionType("UNBLOCK");
                  }}
                  className="px-2 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-md cursor-pointer"
                >
                  Unblock
                </button>
              )}
              {isAdmin && (row.status === "ACTIVE" || row.status === "BLOCKED") && (
                <button
                  onClick={() => {
                    setActionUser(row);
                    setActionType("BAN");
                    setReason("");
                  }}
                  className="px-2 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer"
                >
                  Ban
                </button>
              )}
              {isAdmin && row.status === "BANNED" && (
                <button
                  onClick={() => {
                    setActionUser(row);
                    setActionType("UNBAN");
                  }}
                  className="px-2 py-1 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 rounded-md cursor-pointer"
                >
                  Unban
                </button>
              )}
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setEditUser(row);
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
                </>
              )}
            </div>
          </div>
        )}
      />

      {/* ── Proper Pagination Controls ───────────────────────────────────────── */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-1 text-xs text-gray-500 bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="text-gray-900">{(page - 1) * limit + 1}</strong> to{" "}
              <strong className="text-gray-900">{Math.min(page * limit, total)}</strong> of{" "}
              <strong className="text-gray-900">{total}</strong> users
            </span>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-gray-400">Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="px-2 py-1 border border-gray-200 rounded-lg text-xs font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-700 cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | string)[]>((acc, p, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) {
                  acc.push("...");
                }
                acc.push(p);
                return acc;
              }, [])
              .map((item, index) =>
                typeof item === "number" ? (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`min-w-[28px] h-7 px-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      page === item
                        ? "bg-orange-500 text-white shadow-xs"
                        : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {item}
                  </button>
                ) : (
                  <span key={`ellipsis-${index}`} className="px-1 text-gray-400">
                    ...
                  </span>
                )
              )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 border border-gray-200 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-600 transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}

      {isAdmin && modalOpen && (
        <UserModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditUser(null);
          }}
          onSuccess={fetchUsers}
          user={editUser}
          companies={companies}
        />
      )}

      {isAdmin && bulkOpen && (
        <BulkUserModal isOpen={bulkOpen} onClose={() => setBulkOpen(false)} onSuccess={fetchUsers} />
      )}

      {addressModalUser && (
        <UserAddressesModal
          isOpen={!!addressModalUser}
          onClose={() => setAddressModalUser(null)}
          onSuccess={fetchUsers}
          user={addressModalUser}
        />
      )}

      {isAdmin && deleteId && (
        <ConfirmDialog
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          message="Delete this user? This cannot be undone."
        />
      )}

      {/* ── Single Block/Ban Action Modal ────────────────────────────────────── */}
      {actionUser && actionType && (
        <Modal
          isOpen={true}
          onClose={() => {
            setActionUser(null);
            setActionType(null);
          }}
          title={`${
            actionType === "BLOCK"
              ? "Block"
              : actionType === "BAN"
              ? "Ban"
              : actionType === "UNBLOCK"
              ? "Unblock"
              : "Unban"
          } User: ${actionUser.name}`}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setActionUser(null);
                  setActionType(null);
                }}
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
                <label className="text-xs font-semibold text-gray-500">
                  Reason for {actionType.toLowerCase()}
                </label>
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

      {/* ── Bulk Action Modal (Reason prompt for Bulk Block / Ban / Delete) ──── */}
      {bulkActionType && (
        <Modal
          isOpen={true}
          onClose={() => {
            setBulkActionType(null);
            setBulkReason("");
          }}
          title={`Bulk ${bulkActionType} (${selectedIds.length} users)`}
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setBulkActionType(null);
                  setBulkReason("");
                }}
                disabled={bulkLoading}
              >
                Cancel
              </Button>
              <Button
                variant={bulkActionType === "DELETE" || bulkActionType === "BAN" || bulkActionType === "BLOCK" ? "danger" : "primary"}
                onClick={handleBulkAction}
                isLoading={bulkLoading}
              >
                Execute Bulk {bulkActionType}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              Are you sure you want to execute <strong>Bulk {bulkActionType}</strong> on{" "}
              <strong>{selectedIds.length} selected user(s)</strong>?
              {bulkActionType === "DELETE" && " This action is permanent and cannot be undone."}
            </p>

            {(bulkActionType === "BLOCK" || bulkActionType === "BAN") && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500">
                  Reason for bulk {bulkActionType.toLowerCase()}
                </label>
                <textarea
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                  placeholder="Provide a reason for this bulk action..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 placeholder-gray-300 text-gray-700"
                  required
                />
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Ban History Modal ────────────────────────────────────────────────── */}
      {banHistoryUser && (
        <Modal
          isOpen={true}
          onClose={() => {
            setBanHistoryUser(null);
            setBanHistory([]);
          }}
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
                  <span
                    className={`inline-flex items-center text-xs font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                      entry.action === "BANNED"
                        ? "bg-red-50 text-red-700"
                        : entry.action === "BLOCKED"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {entry.action}
                  </span>
                  <div className="flex-1 min-w-0">
                    {entry.reason && <p className="text-xs text-gray-600 mb-1">{entry.reason}</p>}
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
