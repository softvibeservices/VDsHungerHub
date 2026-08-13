"use client";

import { useEffect, useState, useCallback } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { UserLedgerDetail } from "@/types";
import { formatCurrency, formatMobileNumber } from "@/lib/utils";
import { formatDateTimeIST } from "@/lib/time";
import { generateUserBillPdf } from "@/lib/pdf-bill";
import { Trash2, Plus, Download, ArrowDownRight, ArrowUpRight, Calendar, FilterX } from "lucide-react";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onOpenRecordPayment: () => void;
  onRefreshParent: () => void;
  initialStartDate?: string;
  initialEndDate?: string;
}

export default function HistoryModal({
  isOpen,
  onClose,
  userId,
  onOpenRecordPayment,
  onRefreshParent,
  initialStartDate = "",
  initialEndDate = "",
}: HistoryModalProps) {
  const [detail, setDetail] = useState<UserLedgerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Date Range state
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const fetchDetail = useCallback(async (id: string, sDate?: string, eDate?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (sDate) params.set("startDate", sDate);
      if (eDate) params.set("endDate", eDate);

      const res = await fetch(`/api/admin/credit/${id}?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to load history");
      }
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading history");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && userId) {
      setStartDate(initialStartDate);
      setEndDate(initialEndDate);
      fetchDetail(userId, initialStartDate, initialEndDate);
    } else {
      setDetail(null);
    }
  }, [isOpen, userId, initialStartDate, initialEndDate, fetchDetail]);

  const handleApplyDateRange = (s: string, e: string) => {
    setStartDate(s);
    setEndDate(e);
    if (userId) {
      fetchDetail(userId, s, e);
    }
  };

  // Quick Preset Handlers
  const handlePreset1to15 = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    handleApplyDateRange(`${year}-${month}-01`, `${year}-${month}-15`);
  };

  const handlePreset16toEnd = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    handleApplyDateRange(`${year}-${month}-16`, `${year}-${month}-${lastDay}`);
  };

  const handlePresetThisMonth = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    handleApplyDateRange(`${year}-${month}-01`, `${year}-${month}-${lastDay}`);
  };

  const handleClearDateRange = () => {
    handleApplyDateRange("", "");
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentId || !userId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/credit/${userId}/payments/${deletePaymentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to delete payment");
      }
      onRefreshParent();
      fetchDetail(userId, startDate, endDate);
      setDeletePaymentId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting payment");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={detail ? `Ledger Statement — ${detail.user.name}` : "Ledger Statement"}
        size="lg"
      >
        {isLoading && !detail ? (
          <div className="py-12 flex justify-center">
            <Loader />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{error}</div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Header info & Export */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{detail.user.name}</h3>
                <p className="text-xs text-gray-500">
                  {formatMobileNumber(detail.user.number)}
                  {detail.user.company ? ` • ${detail.user.company.name}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => generateUserBillPdf(detail)}
                  className="gap-1.5 font-bold"
                >
                  <Download className="w-4 h-4" /> Export Statement (PDF)
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onOpenRecordPayment}
                  className="gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 border-0"
                >
                  <Plus className="w-4 h-4" /> Record Payment
                </Button>
              </div>
            </div>

            {/* Date Range Selector Toolbar */}
            <div className="bg-gradient-to-r from-navy-900 to-indigo-900 bg-[#0F1E3D] p-4 rounded-xl text-white space-y-3 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#C9A84C] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Statement Date Range Selector
                </p>

                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={handlePreset1to15}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                  >
                    1st – 15th
                  </button>
                  <button
                    onClick={handlePreset16toEnd}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                  >
                    16th – End
                  </button>
                  <button
                    onClick={handlePresetThisMonth}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                  >
                    This Month
                  </button>
                  {(startDate || endDate) && (
                    <button
                      onClick={handleClearDateRange}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors flex items-center gap-1"
                    >
                      <FilterX className="w-3 h-3" /> All Time
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-300 mb-1">From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleApplyDateRange(e.target.value, endDate)}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-white text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-300 mb-1">To Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleApplyDateRange(startDate, e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-white text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  />
                </div>
              </div>
            </div>

            {/* Summary metrics for current date range */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                <p className="text-xs text-gray-500 font-semibold uppercase">Total Billed</p>
                <p className="text-lg font-extrabold text-[#0F1E3D] mt-0.5">{formatCurrency(detail.totalDebit)}</p>
              </div>
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-center">
                <p className="text-xs text-gray-500 font-semibold uppercase">Total Paid</p>
                <p className="text-lg font-extrabold text-emerald-700 mt-0.5">{formatCurrency(detail.totalPaid)}</p>
              </div>
              <div className="p-3 bg-red-50/60 border border-red-200 rounded-xl text-center">
                <p className="text-xs text-gray-500 font-semibold uppercase">Period Balance</p>
                <p
                  className={`text-lg font-extrabold mt-0.5 ${
                    detail.balance > 0 ? "text-red-700" : "text-emerald-700"
                  }`}
                >
                  {formatCurrency(detail.balance)}
                </p>
              </div>
            </div>

            {/* Timeline list */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Transaction Entries ({detail.timeline.length})
                </h4>
                {(startDate || endDate) && (
                  <span className="text-xs text-[#0F1E3D] font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    Filtered by Date Range
                  </span>
                )}
              </div>

              {detail.timeline.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No orders or payments recorded for this date range.
                </p>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                  {detail.timeline.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="p-3.5 flex items-center justify-between hover:bg-gray-50/60 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${
                            item.type === "DEBIT"
                              ? "bg-red-100 text-red-600"
                              : "bg-emerald-100 text-emerald-600"
                          }`}
                        >
                          {item.type === "DEBIT" ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.label}</p>
                          <p className="text-xs text-gray-400">{formatDateTimeIST(item.date)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p
                            className={`text-sm font-bold ${
                              item.type === "DEBIT" ? "text-red-600" : "text-emerald-600"
                            }`}
                          >
                            {item.type === "DEBIT" ? `+ ${formatCurrency(item.amount)}` : `- ${formatCurrency(item.amount)}`}
                          </p>
                          {item.status && (
                            <span className="inline-block text-[10px] uppercase font-semibold text-gray-400">
                              {item.status}
                            </span>
                          )}
                        </div>

                        {item.type === "CREDIT" && (
                          <button
                            onClick={() => setDeletePaymentId(item.id)}
                            title="Delete Payment Record"
                            className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={!!deletePaymentId}
        onClose={() => setDeletePaymentId(null)}
        onConfirm={handleDeletePayment}
        title="Delete Payment Entry"
        message="Are you sure you want to delete this recorded payment entry? The user's outstanding balance will increase accordingly."
        confirmLabel="Delete Entry"
        isLoading={isDeleting}
      />
    </>
  );
}
