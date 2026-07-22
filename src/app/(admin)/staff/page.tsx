"use client";

import { useState, useEffect } from "react";
import { Plus, Shield, UserCheck, UserMinus, Pencil, Check, AlertTriangle } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/hooks/useToast";
import { formatMobileNumber } from "@/lib/utils";
import { formatDateTimeIST } from "@/lib/time";

interface StaffUser {
  id: string;
  name: string;
  mobile: string;
  role: "ADMIN" | "STAFF";
  permissions: string[];
  status: "ACTIVE" | "INACTIVE";
  lastLoginAt: string | null;
  createdAt: string;
}

const PERMISSION_OPTIONS = [
  { value: "users:moderate", label: "Moderate Customers", desc: "Block or unblock customer accounts" },
  { value: "menu:manage", label: "Manage Menu", desc: "Edit daily menus, pricing, and catalog" },
  { value: "orders:update-status", label: "Update Orders", desc: "Change status of active orders" },
  { value: "companies:moderate", label: "Moderate Companies", desc: "Verify or flag companies as fake" },
];

export default function ManageStaffPage() {
  const toast = useToast();
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Status toggle confirmation dialog
  const [toggleConfirmStaff, setToggleConfirmStaff] = useState<StaffUser | null>(null);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/admin/staff", window.location.origin);
      if (statusFilter !== "ALL") {
        url.searchParams.set("status", statusFilter);
      }
      if (searchQuery.trim()) {
        url.searchParams.set("search", searchQuery.trim());
      }

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setStaffList(data.staff ?? []);
      } else {
        toast.error("Failed to load staff list.");
      }
    } catch {
      toast.error("Network error loading staff.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, [statusFilter, searchQuery]);

  const handleOpenAdd = () => {
    setModalMode("add");
    setSelectedStaffId(null);
    setName("");
    setMobile("");
    setSelectedPermissions([]);
    setFormError("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (staff: StaffUser) => {
    setModalMode("edit");
    setSelectedStaffId(staff.id);
    setName(staff.name);
    setMobile(staff.mobile);
    setSelectedPermissions(staff.permissions);
    setFormError("");
    setIsModalOpen(true);
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }
    if (modalMode === "add" && (!mobile.trim() || mobile.length !== 10)) {
      setFormError("Valid 10-digit mobile number is required");
      return;
    }

    setSubmitting(true);
    try {
      const url = modalMode === "add" ? "/api/admin/staff" : `/api/admin/staff/${selectedStaffId}`;
      const method = modalMode === "add" ? "POST" : "PATCH";
      const body: any = {
        name: name.trim(),
        permissions: selectedPermissions,
      };
      if (modalMode === "add") {
        body.mobile = mobile.trim();
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Operation failed.");
      } else {
        toast.success(modalMode === "add" ? "Staff member added successfully!" : "Staff updated successfully!");
        setIsModalOpen(false);
        fetchStaff();
      }
    } catch {
      setFormError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!toggleConfirmStaff) return;
    const nextStatus = toggleConfirmStaff.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    setTogglingStatus(true);
    try {
      const res = await fetch(`/api/admin/staff/${toggleConfirmStaff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        toast.success(`Staff status updated to ${nextStatus.toLowerCase()}`);
        setToggleConfirmStaff(null);
        fetchStaff();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update staff status.");
      }
    } catch {
      toast.error("Network error. Could not update status.");
    } finally {
      setTogglingStatus(false);
    }
  };

  const columns: Column<StaffUser>[] = [
    {
      key: "name",
      header: "Name",
      render: (row) => <span className="font-bold text-gray-900">{row.name}</span>,
    },
    {
      key: "mobile",
      header: "Mobile",
      render: (row) => (
        <span className="text-gray-600 font-mono text-xs">{formatMobileNumber(row.mobile)}</span>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (row) => (
        <Badge
          variant={row.role === "ADMIN" ? "warning" : "neutral"}
          label={row.role === "ADMIN" ? "Admin" : "Staff"}
        />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge
          variant={row.status === "ACTIVE" ? "success" : "inactive"}
          label={row.status === "ACTIVE" ? "Active" : "Inactive"}
        />
      ),
    },
    {
      key: "permissions",
      header: "Permissions",
      render: (row) => (
        <div>
          {row.role === "ADMIN" ? (
            <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
              <Shield size={12} /> Full Admin
            </span>
          ) : row.permissions.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No permissions</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {row.permissions.map((p) => (
                <span key={p} className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-medium">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "lastLoginAt",
      header: "Last Login",
      render: (row) => (
        <span className="text-xs text-gray-500">
          {row.lastLoginAt ? formatDateTimeIST(row.lastLoginAt) : "Never"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      width: "w-36",
      render: (row) => (
        <div className="flex items-center gap-1">
          {row.role !== "ADMIN" && (
            <>
              <button
                onClick={() => handleOpenEdit(row)}
                className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                title="Edit staff member"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => setToggleConfirmStaff(row)}
                className={`p-1 rounded-lg transition-colors ${
                  row.status === "ACTIVE"
                    ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
                    : "text-gray-400 hover:text-emerald-600 hover:bg-emerald-50"
                }`}
                title={row.status === "ACTIVE" ? "Deactivate staff" : "Activate staff"}
              >
                {row.status === "ACTIVE" ? <UserMinus size={14} /> : <UserCheck size={14} />}
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manage Staff</h2>
          <p className="text-xs text-gray-500 mt-1">
            Create, moderate, and manage permissions of staff members
          </p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={15} />} onClick={handleOpenAdd}>
          Add Staff Member
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search staff by name or mobile..."
          className="w-full md:max-w-md"
        />

        <div className="w-full md:w-48">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "ALL", label: "All Statuses" },
              { value: "ACTIVE", label: "Active Only" },
              { value: "INACTIVE", label: "Inactive Only" },
            ]}
          />
        </div>
      </div>

      {/* Staff Table */}
      <Table<StaffUser>
        columns={columns}
        data={staffList}
        isLoading={loading}
        emptyMessage="No staff members found matching criteria."
        emptySubMessage="Add your first staff member to get started."
      />

      {/* Add/Edit Modal using Shared Modal Component */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === "add" ? "Add New Staff Member" : "Edit Staff Permissions"}
        footer={
          <div className="flex gap-2 justify-end w-full">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={submitting} onClick={handleSubmit as any}>
              {modalMode === "add" ? "Save Member" : "Save Changes"}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-medium text-red-650 flex items-center gap-1.5">
              <AlertTriangle size={14} className="shrink-0 text-red-500" />
              <span>{formError}</span>
            </div>
          )}

          <Input
            label="Full Name"
            type="text"
            placeholder="Enter full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          {modalMode === "add" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700 block">Mobile Number</label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-500 font-semibold select-none">
                  +91
                </span>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="10-digit number"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Permissions selection */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-700 block">Permissions Allowed</label>
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {PERMISSION_OPTIONS.map((opt) => {
                const isChecked = selectedPermissions.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => togglePermission(opt.value)}
                    className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                      isChecked ? "border-orange-400 bg-orange-50/40" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`w-4.5 h-4.5 rounded border flex items-center justify-center shrink-0 mt-0.5 ${
                        isChecked ? "bg-orange-500 border-orange-500" : "border-gray-300 bg-white"
                      }`}
                    >
                      {isChecked && <Check size={12} className="text-white font-extrabold" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-800">{opt.label}</p>
                      <p className="text-[10px] text-gray-500 font-medium mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Modal>

      {/* Deactivate/Activate Status Confirm Dialog */}
      <ConfirmDialog
        isOpen={toggleConfirmStaff !== null}
        onClose={() => setToggleConfirmStaff(null)}
        onConfirm={handleConfirmToggleStatus}
        title={`${toggleConfirmStaff?.status === "ACTIVE" ? "Deactivate" : "Activate"} Staff Member`}
        message={`Are you sure you want to ${
          toggleConfirmStaff?.status === "ACTIVE" ? "deactivate" : "activate"
        } ${toggleConfirmStaff?.name}?`}
        confirmLabel={toggleConfirmStaff?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        isLoading={togglingStatus}
      />
    </div>
  );
}
