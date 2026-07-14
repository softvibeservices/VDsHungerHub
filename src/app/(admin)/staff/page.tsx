"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Loader2, Shield, UserCheck, UserMinus, Edit2, Check, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

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
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

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
  }, [statusFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStaff();
  };

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

  const toggleStaffStatus = async (staff: StaffUser) => {
    const nextStatus = staff.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const confirmMsg = `Are you sure you want to ${nextStatus === "ACTIVE" ? "activate" : "deactivate"} ${staff.name}?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/staff/${staff.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (res.ok) {
        toast.success(`Staff status updated to ${nextStatus.toLowerCase()}`);
        fetchStaff();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update staff status.");
      }
    } catch {
      toast.error("Network error. Could not update status.");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manage Staff</h2>
          <p className="text-xs text-gray-500 mt-1">
            Create, moderate, and manage permissions of TiffinOS staff members
          </p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow flex items-center gap-1.5 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus size={15} />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        
        {/* Status filters */}
        <div className="flex border border-gray-250 rounded-xl overflow-hidden self-stretch md:self-auto">
          {["ALL", "ACTIVE", "INACTIVE"].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                statusFilter === status
                  ? "bg-orange-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {status.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:max-w-md self-stretch">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search by name or mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-205 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 active:bg-black text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Staff Grid/List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2">
          <Loader2 className="animate-spin text-orange-500" size={28} />
          <p className="text-xs text-gray-500 font-semibold">Loading staff records...</p>
        </div>
      ) : staffList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <p className="text-sm text-gray-500 font-medium">No staff members found matching criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((staff) => (
            <div
              key={staff.id}
              className={`bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4 relative overflow-hidden transition-all hover:shadow-md ${
                staff.status === "INACTIVE" ? "opacity-70 border-dashed" : ""
              }`}
            >
              
              {/* Role badge */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm leading-snug">{staff.name}</h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">+91 {staff.mobile}</p>
                </div>
                <span
                  className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${
                    staff.role === "ADMIN"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-orange-50 text-orange-700 border-orange-200"
                  }`}
                >
                  {staff.role}
                </span>
              </div>

              {/* Status flag */}
              <div className="flex items-center gap-1.5 text-xs">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    staff.status === "ACTIVE" ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                  }`}
                />
                <span className="font-semibold text-gray-600">
                  {staff.status === "ACTIVE" ? "Active" : "Inactive / Deactivated"}
                </span>
              </div>

              {/* Permissions list */}
              <div className="space-y-1 bg-gray-50/80 p-3 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Permissions
                </p>
                {staff.role === "ADMIN" ? (
                  <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                    <Shield size={12} /> Full Administrative Override
                  </p>
                ) : staff.permissions.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No special access granted</p>
                ) : (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {staff.permissions.map((p) => (
                      <span key={p} className="text-[9px] bg-white border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Last login info */}
              <p className="text-[10px] text-gray-400">
                Last Login:{" "}
                <span className="font-semibold text-gray-650">
                  {staff.lastLoginAt ? new Date(staff.lastLoginAt).toLocaleString("en-IN") : "Never logged in"}
                </span>
              </p>

              {/* Actions */}
              <div className="flex gap-2 border-t border-gray-100 pt-3.5">
                {staff.role !== "ADMIN" && (
                  <>
                    <button
                      onClick={() => handleOpenEdit(staff)}
                      className="flex-1 py-1.5 border border-gray-200 hover:border-orange-300 hover:bg-orange-50/30 text-gray-600 hover:text-orange-600 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                    <button
                      onClick={() => toggleStaffStatus(staff)}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 border ${
                        staff.status === "ACTIVE"
                          ? "border-red-100 hover:bg-red-50 text-red-600"
                          : "border-emerald-100 hover:bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {staff.status === "ACTIVE" ? (
                        <>
                          <UserMinus size={11} /> Deactivate
                        </>
                      ) : (
                        <>
                          <UserCheck size={11} /> Activate
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>

            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl border border-gray-200 p-6 shadow-xl space-y-4">
            
            <h3 className="font-bold text-gray-900 text-base">
              {modalMode === "add" ? "Add New Staff Member" : "Edit Staff Permissions"}
            </h3>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs font-medium text-red-650 flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                  required
                />
              </div>

              {modalMode === "add" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                    Mobile Number
                  </label>
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
                      className="flex-1 px-3.5 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Permissions list check */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                  Permissions Allowed
                </label>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {PERMISSION_OPTIONS.map((opt) => {
                    const isChecked = selectedPermissions.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => togglePermission(opt.value)}
                        className={`w-full p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
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

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-150 hover:bg-gray-200 active:bg-gray-250 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  {submitting && <Loader2 size={13} className="animate-spin" />}
                  <span>{modalMode === "add" ? "Save Member" : "Save Changes"}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
