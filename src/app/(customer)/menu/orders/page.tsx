"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  UtensilsCrossed, Clock, CheckCircle2, Package, XCircle,
  AlertCircle, ChevronDown, ChevronUp, Filter, Search,
  Calendar, Loader2, MessageSquare
} from "lucide-react";

type OrderStatus = "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED";
type MealType = "LUNCH" | "DINNER";

interface OrderComment {
  id: string;
  authorType: "STAFF" | "CUSTOMER";
  message: string;
  createdAt: string;
}

interface OrderListItem {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  note?: string | null;
  thali: { name: string; nameGu: string | null; price: number } | null;
  menu: { date: string; mealType: MealType };
  address?: { type: string; line1: string; line2?: string | null; city?: string | null } | null;
  thaliItems: {
    id: string;
    thali: { id: string; name: string };
    sabjiProduct: { id: string; name: string } | null;
    quantity: number;
  }[];
  addonItems: {
    id: string;
    addonProduct: { id: string; name: string; price: number };
    quantity: number;
    priceSnapshot: number;
  }[];
  comments: OrderComment[];
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  PENDING:   { label: "Pending",   bg: "bg-yellow-50",  text: "text-yellow-700",  icon: <Clock size={11} /> },
  CONFIRMED: { label: "Confirmed", bg: "bg-blue-50",    text: "text-blue-700",    icon: <CheckCircle2 size={11} /> },
  DELIVERED: { label: "Delivered", bg: "bg-green-50",   text: "text-green-700",   icon: <Package size={11} /> },
  CANCELLED: { label: "Cancelled", bg: "bg-red-50",     text: "text-red-700",     icon: <XCircle size={11} /> },
};

const PAGE_SIZE = 15;

export default function UserOrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [mealFilter, setMealFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Expanded row state (mobile accordion)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadOrders = useCallback(async (pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pg),
        limit: String(PAGE_SIZE),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (mealFilter) params.set("mealType", mealFilter);
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/customer/orders?${params.toString()}`, { credentials: "include" });

      if (res.status === 401) { setError("Please log in to view your orders."); return; }
      if (!res.ok) { setError("Could not load orders. Please try again."); return; }

      const data = await res.json();
      setOrders(data.orders ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, mealFilter, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [statusFilter, mealFilter, fromDate, toDate]);
  useEffect(() => { loadOrders(page); }, [loadOrders, page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = !!(statusFilter || mealFilter || fromDate || toDate);

  const clearFilters = () => {
    setStatusFilter("");
    setMealFilter("");
    setFromDate("");
    setToDate("");
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric"
    });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
    });

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">My Orders</h1>
          {total > 0 && !loading && (
            <p className="text-xs text-gray-400 mt-0.5 font-medium">
              {total} order{total > 1 ? "s" : ""} total · Page {page}/{totalPages}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold transition-all ${
            hasFilters
              ? "bg-orange-50 border-orange-200 text-orange-700"
              : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          <Filter size={15} />
          Filters
          {hasFilters && (
            <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-extrabold flex items-center justify-center">
              ✓
            </span>
          )}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Meal</label>
              <select
                value={mealFilter}
                onChange={(e) => setMealFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="">All Meals</option>
                <option value="LUNCH">🌅 Lunch</option>
                <option value="DINNER">🌙 Dinner</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              />
            </div>
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-bold text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
            >
              <XCircle size={13} /> Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-orange-400" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-3 shadow-sm max-w-md mx-auto">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="text-red-400" size={24} />
          </div>
          <p className="text-sm text-gray-600 font-medium">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && orders.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-12 text-center text-gray-400 shadow-sm">
          <Package size={40} className="mx-auto mb-3 opacity-25" />
          <p className="font-bold text-gray-700">
            {hasFilters ? "No orders match your filters" : "No orders yet"}
          </p>
          <p className="text-xs mt-1">
            {hasFilters ? "Try changing or clearing the filters" : "Your placed orders will appear here"}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-3 text-xs font-bold text-orange-600 hover:text-orange-700">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Orders Table — Desktop */}
      {!loading && !error && orders.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Date &amp; Meal</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Order Details</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Total</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => {
                  const sc = STATUS_CONFIG[order.status];
                  return (
                    <tr key={order.id} className="hover:bg-orange-50/20 transition-colors">
                      {/* Date & Meal */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-bold text-gray-800 text-sm">{formatDate(order.menu.date)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {order.menu.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatTime(order.createdAt)}</p>
                      </td>

                      {/* Order Details */}
                      <td className="px-4 py-3">
                        <div className="space-y-1.5 max-w-xs">
                          {/* Thali items */}
                          {order.thaliItems.length > 0 ? (
                            <div className="space-y-1">
                              {order.thaliItems.map((item) => {
                                const sabjiName = item.sabjiProduct?.name;
                                return (
                                  <div key={item.id}>
                                    <span className="font-semibold text-gray-800 text-xs">
                                      {item.quantity}× {item.thali.name}
                                    </span>
                                    {sabjiName && (
                                      <span className="ml-1.5 text-[10px] bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full font-medium">
                                        {sabjiName}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : order.thali ? (
                            <p className="font-semibold text-gray-800 text-xs">{order.thali.name}</p>
                          ) : null}

                          {/* Add-ons */}
                          {order.addonItems.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {order.addonItems.map((item) => (
                                <span
                                  key={item.id}
                                  className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full font-medium"
                                >
                                  {item.quantity}× {item.addonProduct.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Note */}
                          {order.note && (
                            <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                              <MessageSquare size={10} className="text-amber-600 mt-0.5 flex-shrink-0" />
                              <p className="text-[10px] text-amber-800 font-medium">{order.note}</p>
                            </div>
                          )}

                          {/* Admin replies */}
                          {order.comments && order.comments.length > 0 && (
                            <div className="space-y-1 mt-1">
                              {order.comments
                                .filter((c) => c.authorType === "STAFF")
                                .map((c) => (
                                  <div key={c.id} className="flex items-start gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1.5">
                                    <span className="text-[10px] text-blue-500 flex-shrink-0">💬</span>
                                    <p className="text-[10px] text-blue-800 font-medium">{c.message}</p>
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-extrabold text-orange-600 text-base">{formatCurrency(order.totalAmount)}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                          {sc.icon}
                          {sc.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list (accordion style) */}
          <div className="md:hidden space-y-3">
            {orders.map((order) => {
              const sc = STATUS_CONFIG[order.status];
              const isOpen = expandedId === order.id;
              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Summary row */}
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : order.id)}
                    className="w-full px-4 py-3.5 flex items-center justify-between text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{formatDate(order.menu.date)}</span>
                        <span className="text-xs text-gray-400">{order.menu.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                          {sc.icon} {sc.label}
                        </span>
                        <span className="font-extrabold text-orange-600 text-sm">{formatCurrency(order.totalAmount)}</span>
                      </div>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                      {/* Thali items */}
                      {order.thaliItems.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Meals Chosen</p>
                          {order.thaliItems.map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-xs">
                              <span className="font-semibold text-gray-800">{item.quantity}× {item.thali.name}</span>
                              {item.sabjiProduct && (
                                <span className="text-[11px] bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-xl font-medium">
                                  {item.sabjiProduct.name}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add-ons */}
                      {order.addonItems.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Add-ons</p>
                          <div className="flex flex-wrap gap-1.5">
                            {order.addonItems.map((item) => (
                              <span
                                key={item.id}
                                className="text-[11px] bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-0.5 rounded-full font-medium"
                              >
                                {item.quantity}× {item.addonProduct.name} ({formatCurrency(item.priceSnapshot * item.quantity)})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Note */}
                      {order.note && (
                        <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                          <MessageSquare size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-amber-800 font-medium">{order.note}</p>
                        </div>
                      )}

                      {/* Admin replies */}
                      {order.comments && order.comments.filter((c) => c.authorType === "STAFF").length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">From Kitchen</p>
                          {order.comments
                            .filter((c) => c.authorType === "STAFF")
                            .map((c) => (
                              <div key={c.id} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                                <span className="text-xs flex-shrink-0">💬</span>
                                <p className="text-xs text-blue-800 font-medium">{c.message}</p>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Ordered at */}
                      <p className="text-[10px] text-gray-400">Ordered at {formatTime(order.createdAt)}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between py-2">
              <p className="text-xs text-gray-500 font-medium">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} orders
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-xs text-gray-500 font-medium">{page} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
