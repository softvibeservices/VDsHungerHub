// src\app\(admin)\profile\credit-limits\page.tsx

"use client";

import { useState, useEffect } from "react";
import {
  Wallet,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  X,
} from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import Table, { Column } from "@/components/ui/Table";
import Select from "@/components/ui/Select";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/hooks/useToast";
import { useDebounce } from "@/hooks/useDebounce";
import { formatCurrency, formatMobileNumber } from "@/lib/utils";

interface CreditRow {
  id: string;
  name: string;
  number: string;
  balance: number;
  creditLimit: number;
  hasCreditLimitOverride: boolean;
}

export default function ProfileCreditLimitsPage() {
  const toast = useToast();

  // Global default
  const [globalLimit, setGlobalLimit] = useState<string>("");
  const [globalLoading, setGlobalLoading] = useState(true);
  const [globalSaving, setGlobalSaving] = useState(false);

  // Per-customer search + override + pagination
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [rows, setRows] = useState<CreditRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Editing state
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [overrideInput, setOverrideInput] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  // Revert / Reset confirmation dialog state
  const [resetConfirmRow, setResetConfirmRow] = useState<CreditRow | null>(null);

  useEffect(() => {
    (async () => {
      setGlobalLoading(true);
      try {
        const res = await fetch("/api/admin/settings/credit-limit");
        if (res.ok) {
          const data = await res.json();
          setGlobalLimit(String(data.limit));
        }
      } finally {
        setGlobalLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setRowsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("balanceFilter", "all");
        if (debouncedSearch.trim()) {
          params.set("search", debouncedSearch.trim());
        }

        const res = await fetch(`/api/admin/credit?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setRows(data.rows ?? []);
        }
      } catch {
        toast.error("Failed to load customer credit limits.");
      } finally {
        setRowsLoading(false);
      }
    })();

    // Reset pagination to page 1 on new search
    setCurrentPage(1);
  }, [debouncedSearch]);

  const handleSaveGlobal = async () => {
    const num = parseFloat(globalLimit);
    if (!Number.isFinite(num) || num <= 0) {
      toast.error("Enter a valid positive number.");
      return;
    }
    setGlobalSaving(true);
    try {
      const res = await fetch("/api/admin/settings/credit-limit", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: num }),
      });
      if (res.ok) {
        toast.success("Global credit limit updated.");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to update.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setGlobalSaving(false);
    }
  };

  const openOverrideEditor = (row: CreditRow) => {
    setEditingRowId(row.id);
    setOverrideInput(row.hasCreditLimitOverride ? String(row.creditLimit) : "");
  };

  const saveOverride = async (userId: string, value: number | null) => {
    setSavingOverride(true);
    try {
      const res = await fetch(`/api/admin/credit/${userId}/limit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to update limit.");
        return;
      }
      toast.success(value === null ? "Reset to global default." : "Customer limit updated.");
      setEditingRowId(null);
      setRows((prev) =>
        prev.map((r) =>
          r.id === userId ? { ...r, creditLimit: data.limit, hasCreditLimitOverride: data.isOverride } : r
        )
      );
    } catch {
      toast.error("Network error.");
    } finally {
      setSavingOverride(false);
    }
  };

  const handleConfirmReset = async () => {
    if (!resetConfirmRow) return;
    await saveOverride(resetConfirmRow.id, null);
    setResetConfirmRow(null);
  };

  // Pagination calculations
  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCount);
  const paginatedRows = rows.slice(startIndex, endIndex);

  const columns: Column<CreditRow>[] = [
    {
      key: "name",
      header: "Customer",
      render: (r) => (
        <div>
          <p className="font-bold text-gray-900">{r.name}</p>
          <p className="text-xs text-gray-400 font-mono">{formatMobileNumber(r.number)}</p>
        </div>
      ),
    },
    {
      key: "number",
      header: "Mobile",
      render: (r) => <span className="font-mono text-xs text-gray-600">{formatMobileNumber(r.number)}</span>,
    },
    {
      key: "balance",
      header: "Current Due",
      render: (r) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
            r.balance > r.creditLimit
              ? "bg-red-50 text-red-700 border border-red-200"
              : r.balance > 0
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          {formatCurrency(r.balance)}
        </span>
      ),
    },
    {
      key: "creditLimit",
      header: "Credit Limit",
      render: (r) => (
        editingRowId === r.id ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Input
              type="number"
              min="1"
              step="any"
              value={overrideInput}
              onChange={(e) => setOverrideInput(e.target.value)}
              placeholder="Custom limit"
              className="w-28 text-xs py-1"
            />
            <Button
              size="sm"
              variant="primary"
              isLoading={savingOverride}
              onClick={() => saveOverride(r.id, overrideInput ? parseFloat(overrideInput) : null)}
            >
              <CheckCircle2 size={13} />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingRowId(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900">{formatCurrency(r.creditLimit)}</span>
            {r.hasCreditLimitOverride ? (
              <span className="text-[10px] bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-bold border border-orange-200">
                Custom
              </span>
            ) : (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-semibold">
                Default
              </span>
            )}
            <button
              onClick={() => openOverrideEditor(r)}
              className="text-xs text-orange-600 font-bold hover:underline cursor-pointer flex items-center gap-1 ml-1"
            >
              <Pencil size={12} /> Edit
            </button>
            {r.hasCreditLimitOverride && (
              <button
                onClick={() => setResetConfirmRow(r)}
                className="p-1 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition-colors cursor-pointer"
                title="Reset to global default"
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        )
      ),
    },
  ];

  // Mobile Stacked Card View
  const mobileCardRender = (r: CreditRow) => (
    <div className="space-y-3 p-1">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-gray-900 text-sm leading-tight">{r.name}</p>
          <p className="font-mono text-xs text-gray-500 mt-0.5">{formatMobileNumber(r.number)}</p>
        </div>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
            r.balance > r.creditLimit
              ? "bg-red-50 text-red-700 border border-red-200"
              : r.balance > 0
              ? "bg-amber-50 text-amber-800 border border-amber-200"
              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
          }`}
        >
          Due: {formatCurrency(r.balance)}
        </span>
      </div>

      <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 font-medium">Limit:</span>
          <span className="font-bold text-gray-900 text-xs">{formatCurrency(r.creditLimit)}</span>
          {r.hasCreditLimitOverride ? (
            <span className="text-[9px] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full font-bold border border-orange-200">
              Custom
            </span>
          ) : (
            <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-semibold">
              Default
            </span>
          )}
        </div>

        <div>
          {editingRowId === r.id ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="1"
                step="any"
                value={overrideInput}
                onChange={(e) => setOverrideInput(e.target.value)}
                placeholder="Limit"
                className="w-20 text-xs py-1"
              />
              <Button
                size="sm"
                variant="primary"
                isLoading={savingOverride}
                onClick={() => saveOverride(r.id, overrideInput ? parseFloat(overrideInput) : null)}
              >
                <CheckCircle2 size={12} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingRowId(null)}>
                <X size={12} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openOverrideEditor(r)}
                className="text-xs text-orange-600 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Pencil size={11} /> Edit Limit
              </button>
              {r.hasCreditLimitOverride && (
                <button
                  onClick={() => setResetConfirmRow(r)}
                  className="p-1 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition-colors cursor-pointer"
                  title="Reset to global default"
                >
                  <RotateCcw size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Global Default Credit Limit Card */}
      <div className="max-w-2xl bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
            <Wallet size={20} className="text-orange-500" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Global Default Credit Limit</h2>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              Applies to every customer who does not have a custom credit limit configured below.
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 max-w-md">
          <div className="flex-1">
            <Input
              label="Maximum Allowed Due Amount (₹)"
              type="number"
              min="1"
              step="any"
              value={globalLimit}
              onChange={(e) => setGlobalLimit(e.target.value)}
              disabled={globalLoading}
            />
          </div>
          <Button
            variant="primary"
            isLoading={globalSaving}
            onClick={handleSaveGlobal}
            className="sm:w-auto w-full"
          >
            Save Default
          </Button>
        </div>
        <p className="text-[11px] text-gray-400 mt-3 flex items-start gap-1.5 leading-tight">
          <AlertTriangle size={13} className="shrink-0 text-amber-500 mt-0.5" />
          <span>
            Orders are automatically blocked for customers whose outstanding balance would exceed their effective credit limit.
          </span>
        </p>
      </div>

      {/* Customer Specific Limits Section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Customer Credit Limits</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Set custom limits or reset individuals back to the global default.
            </p>
          </div>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or mobile..."
            className="w-full sm:max-w-xs"
          />
        </div>

        {/* Data Table with Mobile Stacked Cards */}
        <Table<CreditRow>
          columns={columns}
          data={paginatedRows}
          isLoading={rowsLoading}
          emptyMessage={debouncedSearch.trim() ? `No customers matching "${debouncedSearch}"` : "No customers found."}
          mobileCardRender={mobileCardRender}
        />

        {/* Pagination Bar */}
        {!rowsLoading && totalCount > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-gray-100 text-xs">
            <div className="flex items-center gap-3 text-gray-500 font-medium">
              <span>
                Showing <strong className="text-gray-900">{startIndex + 1}</strong> to{" "}
                <strong className="text-gray-900">{endIndex}</strong> of{" "}
                <strong className="text-gray-900">{totalCount}</strong> customers
              </span>
              <div className="flex items-center gap-1.5 ml-2">
                <span className="text-[11px] text-gray-400">Show:</span>
                <Select
                  value={String(pageSize)}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  options={[
                    { value: "10", label: "10" },
                    { value: "20", label: "20" },
                    { value: "50", label: "50" },
                  ]}
                  className="py-1 px-2 text-xs w-16"
                />
              </div>
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                disabled={validPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2 py-1"
                title="Previous page"
              >
                <ChevronLeft size={14} />
              </Button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - validPage) <= 1)
                  .map((p, idx, arr) => {
                    const prevP = arr[idx - 1];
                    const showEllipsis = prevP && p - prevP > 1;
                    return (
                      <div key={p} className="flex items-center gap-1">
                        {showEllipsis && <span className="text-gray-400 px-1">...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                            p === validPage
                              ? "bg-orange-500 text-white shadow-sm"
                              : "text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {p}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <Button
                variant="secondary"
                size="sm"
                disabled={validPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2 py-1"
                title="Next page"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Resetting Override to Default */}
      <ConfirmDialog
        isOpen={resetConfirmRow !== null}
        onClose={() => setResetConfirmRow(null)}
        onConfirm={handleConfirmReset}
        title="Reset Custom Credit Limit"
        message={`Are you sure you want to reset the custom credit limit for ${resetConfirmRow?.name}? Their limit will revert back to the global default limit of ${formatCurrency(parseFloat(globalLimit) || 4000)}.`}
        confirmLabel="Reset to Default"
        isLoading={savingOverride}
      />
    </div>
  );
}
