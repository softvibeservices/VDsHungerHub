"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { UserLedgerDetail } from "@/types";
import { formatCurrency, formatMobileNumber } from "@/lib/utils";
import { formatDateTimeIST } from "@/lib/time";
import { generateUserBillPdf } from "@/lib/pdf-bill";
import { Trash2, Plus, Download, ArrowDownRight, ArrowUpRight } from "lucide-react";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  onOpenRecordPayment: () => void;
  onRefreshParent: () => void;
}

export default function HistoryModal({
  isOpen,
  onClose,
  userId,
  onOpenRecordPayment,
  onRefreshParent,
}: HistoryModalProps) {
  const [detail, setDetail] = useState<UserLedgerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchDetail = async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/credit/${id}`);
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
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchDetail(userId);
    } else {
      setDetail(null);
    }
  }, [isOpen, userId]);

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
      const json = await res.json();
      setDetail(json.detail);
      onRefreshParent();
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
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Loader />
          </div>
        ) : error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm">{error}</div>
        ) : detail ? (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-base">{detail.user.name}</h3>
                <p className="text-xs text-gray-500">
                  {formatMobileNumber(detail.user.number)}
                  {detail.user.company ? ` • ${detail.user.company.name}` : ""}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => generateUserBillPdf(detail)}
                  className="gap-1.5"
                >
                  <Download className="w-4 h-4" /> Export PDF
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onOpenRecordPayment}
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Record Payment
                </Button>
              </div>
            </div>

            {/* Summary metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg text-center">
                <p className="text-xs text-gray-500 font-medium">Total Billed</p>
                <p className="text-lg font-bold text-red-700">{formatCurrency(detail.totalDebit)}</p>
              </div>
              <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg text-center">
                <p className="text-xs text-gray-500 font-medium">Total Paid</p>
                <p className="text-lg font-bold text-emerald-700">{formatCurrency(detail.totalPaid)}</p>
              </div>
              <div className="p-3 bg-orange-50/50 border border-orange-100 rounded-lg text-center">
                <p className="text-xs text-gray-500 font-medium">Balance Due</p>
                <p
                  className={`text-lg font-bold ${
                    detail.balance > 0 ? "text-orange-700" : "text-emerald-700"
                  }`}
                >
                  {formatCurrency(detail.balance)}
                </p>
              </div>
            </div>

            {/* Timeline list */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Transaction History
              </h4>
              {detail.timeline.length === 0 ? (
                <p className="text-sm text-gray-400 italic py-4 text-center">No orders or payments recorded yet.</p>
              ) : (
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
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
