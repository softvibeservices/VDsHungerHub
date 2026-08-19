// src\app\(customer)\menu\orders\page.tsx

"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Clock, CheckCircle2, Package, XCircle, Truck,
  AlertCircle, ChevronDown, ChevronUp, Filter,
  Calendar, Loader2, MessageSquare, RefreshCw, MapPin, Eye
} from "lucide-react";
import { getWhatsAppInquiryLink } from "@/lib/constants";

type OrderStatus = "PENDING" | "OUT_FOR_DELIVERY" | "DELIVERED" | "CANCELLED";
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

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  PENDING:          { label: "Pending",         bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200",   icon: <Clock size={12} /> },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", bg: "bg-indigo-50 font-bold", text: "text-indigo-700 font-bold", border: "border-indigo-200", icon: <Truck size={12} /> },
  DELIVERED:        { label: "Delivered",        bg: "bg-emerald-50 font-bold", text: "text-emerald-700 font-bold", border: "border-emerald-200", icon: <CheckCircle2 size={12} /> },
  CANCELLED:        { label: "Cancelled",        bg: "bg-rose-50",    text: "text-rose-700 font-bold", border: "border-rose-200",    icon: <XCircle size={12} /> },
};

const PAGE_SIZE = 15;

export default function UserOrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [filteredTotalAmount, setFilteredTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [mealFilter, setMealFilter] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [dueBalance, setDueBalance] = useState<number | null>(null);

  // Expanded row ID state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchDueBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/credit", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.credit?.balance !== undefined) {
          setDueBalance(data.credit.balance);
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchDueBalance();
  }, [fetchDueBalance]);

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
      setFilteredTotalAmount(data.filteredTotalAmount ?? 0);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, mealFilter, fromDate, toDate]);

  useEffect(() => { setPage(1); }, [statusFilter, mealFilter, fromDate, toDate]);
  useEffect(() => { loadOrders(page); }, [loadOrders, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = !!(statusFilter || mealFilter || fromDate || toDate);

  const clearFilters = () => {
    setStatusFilter("");
    setMealFilter("");
    setFromDate("");
    setToDate("");
  };

  // Quick Date Range Preset Helpers
  const setQuickDatePreset = (preset: "1-15" | "16-31" | "this-month") => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthStr = pad(month + 1);

    if (preset === "1-15") {
      setFromDate(`${year}-${monthStr}-01`);
      setToDate(`${year}-${monthStr}-15`);
    } else if (preset === "16-31") {
      const lastDay = new Date(year, month + 1, 0).getDate();
      setFromDate(`${year}-${monthStr}-16`);
      setToDate(`${year}-${monthStr}-${pad(lastDay)}`);
    } else if (preset === "this-month") {
      const lastDay = new Date(year, month + 1, 0).getDate();
      setFromDate(`${year}-${monthStr}-01`);
      setToDate(`${year}-${monthStr}-${pad(lastDay)}`);
    }
  };

  const getActivePreset = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, "0");
    const monthStr = pad(month + 1);
    const lastDay = pad(new Date(year, month + 1, 0).getDate());

    if (fromDate === `${year}-${monthStr}-01` && toDate === `${year}-${monthStr}-15`) return "1-15";
    if (fromDate === `${year}-${monthStr}-16` && toDate === `${year}-${monthStr}-${lastDay}`) return "16-31";
    if (fromDate === `${year}-${monthStr}-01` && toDate === `${year}-${monthStr}-${lastDay}`) return "this-month";
    return null;
  };

  const isTodayDate = (dateStr?: string | null) => {
    if (!dateStr) return false;
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const dStr = new Date(dateStr).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    return todayStr === dStr;
  };

  const isCurrentActiveOrder = (order: OrderListItem) => {
    const isPendingOrOut = order.status === "PENDING" || order.status === "OUT_FOR_DELIVERY";
    return isPendingOrOut && (isTodayDate(order.createdAt) || isTodayDate(order.menu.date));
  };

  const getPageNumbers = (current: number, max: number) => {
    const pages: (number | string)[] = [];
    if (max <= 7) {
      for (let i = 1; i <= max; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      const start = Math.max(2, current - 1);
      const end = Math.min(max - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < max - 2) pages.push("...");
      pages.push(max);
    }
    return pages;
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric"
    });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
    });

  // Summary string builder for compact table view
  const buildItemsSummary = (order: OrderListItem) => {
    const parts: string[] = [];
    if (order.thaliItems && order.thaliItems.length > 0) {
      order.thaliItems.forEach((t) => {
        parts.push(`${t.quantity}× ${t.thali.name}${t.sabjiProduct ? ` (${t.sabjiProduct.name})` : ""}`);
      });
    } else if (order.thali) {
      parts.push(order.thali.name);
    }
    if (order.addonItems && order.addonItems.length > 0) {
      const addonCount = order.addonItems.reduce((acc, a) => acc + a.quantity, 0);
      parts.push(`+ ${addonCount} add-on${addonCount > 1 ? "s" : ""}`);
    }
    return parts.join(", ") || "Order Items";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">My Orders</h1>

            {!loading && total > 0 && (
              <span className="text-xs font-black text-orange-800 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full shadow-2xs">
                {hasFilters ? "Filtered Orders Sum: " : "Orders Billed: "}
                {formatCurrency(filteredTotalAmount)}
              </span>
            )}

            {dueBalance !== null && dueBalance > 0 && (
              <a
                href="/menu/profile?tab=payments"
                className="text-xs font-black text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-full shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                Outstanding Due: {formatCurrency(dueBalance)} (Pay Now →)
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Quick Date Presets Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-extrabold text-gray-500 uppercase tracking-wide mr-1">
            📅 Quick Date Range:
          </span>
          <button
            type="button"
            onClick={() => setQuickDatePreset("1-15")}
            className={`px-4 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              getActivePreset() === "1-15"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
            }`}
          >
            🗓️ Days 1–15
          </button>

          <button
            type="button"
            onClick={() => setQuickDatePreset("16-31")}
            className={`px-4 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              getActivePreset() === "16-31"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
            }`}
          >
            🗓️ Days 16–31
          </button>

          <button
            type="button"
            onClick={() => setQuickDatePreset("this-month")}
            className={`px-4 py-2 text-xs font-black rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              getActivePreset() === "this-month"
                ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 shadow-md shadow-orange-500/20"
                : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
            }`}
          >
            📅 This Month
          </button>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3.5 py-2 text-xs font-bold text-gray-600 hover:text-orange-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors cursor-pointer"
            >
              All Orders (Reset)
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadOrders(page)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white hover:bg-orange-50 hover:border-orange-300 text-gray-700 hover:text-orange-600 text-xs font-bold transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            title="Refresh order list"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-orange-500" : ""} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              hasFilters
                ? "bg-orange-50 border-orange-300 text-orange-700 shadow-sm"
                : "bg-white border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600"
            }`}
          >
            <Filter size={15} />
            <span>More Filters</span>
            {hasFilters && (
              <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-extrabold flex items-center justify-center">
                ✓
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Advanced Filter panel */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4 shadow-sm animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending (Kitchen)</option>
                <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
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
        </div>
      )}

      {/* Active Filter Callout Banner */}
      {hasFilters && !loading && !error && (
        <div className="bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 rounded-2xl p-4 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center text-lg flex-shrink-0">
              ✨
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full border border-white/25">
                  Active Filter Applied
                </span>
                {getActivePreset() && (
                  <span className="text-[10px] font-extrabold bg-white text-orange-600 px-2 py-0.5 rounded-full shadow-2xs">
                    {getActivePreset() === "1-15" ? "Days 1–15" : getActivePreset() === "16-31" ? "Days 16–31" : "This Month"}
                  </span>
                )}
              </div>
              <p className="text-base font-black text-white mt-0.5">
                Filtered Orders Sum: <span className="text-amber-100 text-lg font-black">{formatCurrency(filteredTotalAmount)}</span>
                <span className="text-xs font-semibold text-orange-100 ml-2">({total} order{total > 1 ? "s" : ""})</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="px-3.5 py-2 bg-white/20 hover:bg-white/30 text-white font-extrabold text-xs rounded-xl border border-white/30 transition-all flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <XCircle size={14} /> Clear Filter
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-orange-500" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-white border border-gray-200 rounded-3xl p-8 text-center space-y-3 shadow-sm max-w-md mx-auto">
          <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="text-red-400" size={24} />
          </div>
          <p className="text-sm text-gray-600 font-medium">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && orders.length === 0 && (
        <div className="bg-white border border-gray-100 rounded-3xl p-12 text-center text-gray-400 shadow-sm space-y-2">
          <Package size={44} className="mx-auto mb-2 opacity-25" />
          <p className="font-bold text-gray-800 text-base">
            {hasFilters ? "No orders match your filters" : "No orders found"}
          </p>
          <p className="text-xs text-gray-400">
            {hasFilters ? "Try changing or clearing date / status filters" : "Your placed thali orders will appear here"}
          </p>
          {hasFilters && (
            <button onClick={clearFilters} className="mt-2 text-xs font-bold text-orange-600 hover:text-orange-700 cursor-pointer">
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* ── Table Format View (Clean, Compact with Expandable View Button) ────── */}
      {!loading && !error && orders.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date & Meal</th>
                  <th className="py-3.5 px-4">Items Summary</th>
                  <th className="py-3.5 px-4">Delivery Address</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {orders.map((order) => {
                  const sc = STATUS_CONFIG[order.status];
                  const isCurrent = isCurrentActiveOrder(order);
                  const isExpanded = expandedId === order.id;

                  return (
                    <Fragment key={order.id}>
                      {/* Main Table Row */}
                      <tr
                        className={`transition-colors duration-150 ${
                          isExpanded
                            ? "bg-orange-50/40"
                            : isCurrent
                            ? "bg-orange-50/20 hover:bg-orange-50/40"
                            : "hover:bg-gray-50/80"
                        }`}
                      >
                        {/* Date & Meal */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-orange-500 text-white flex items-center justify-center text-xs font-black shadow-2xs shrink-0">
                              {order.menu.mealType === "LUNCH" ? "🌅" : "🌙"}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-extrabold text-gray-900 text-xs">
                                  {order.menu.mealType === "LUNCH" ? "Lunch" : "Dinner"}
                                </span>
                                {isCurrent && (
                                  <span className="text-[9px] font-black bg-orange-500 text-white px-1.5 py-0.2 rounded-full uppercase">
                                    TODAY
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 font-medium">
                                {formatDate(order.menu.date)} · <span className="text-gray-700">{formatTime(order.createdAt)}</span>
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Items Summary */}
                        <td className="py-3.5 px-4">
                          <p className="font-medium text-gray-800 text-xs line-clamp-2 max-w-xs">
                            {buildItemsSummary(order)}
                          </p>
                        </td>

                        {/* Delivery Address */}
                        <td className="py-3.5 px-4 max-w-[220px]">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <MapPin size={13} className="text-orange-500 shrink-0" />
                            <span className="truncate" title={order.address ? order.address.line1 : "Workplace Delivery"}>
                              {order.address ? order.address.line1 : "Workplace Delivery"}
                            </span>
                          </div>
                        </td>

                        {/* Total Amount */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className="font-black text-orange-600 text-sm">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[11px] font-black shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              {order.status === "OUT_FOR_DELIVERY" ? "OUT FOR DELIVERY" : "PREPARING"}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>
                              {sc.icon} {sc.label}
                            </span>
                          )}
                        </td>

                        {/* View Button */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : order.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                          >
                            <Eye size={13} />
                            <span>{isExpanded ? "Hide" : "View"}</span>
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Order Details Panel */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-gray-200">
                          <td colSpan={6} className="p-4 sm:p-6">
                            <div className="bg-white rounded-2xl border border-gray-200/80 p-5 space-y-4 shadow-sm animate-fadeIn">
                              <div className="flex justify-between items-start gap-3 border-b border-gray-100 pb-3 flex-wrap">
                                <div>
                                  <h4 className="font-extrabold text-gray-900 text-sm flex items-center gap-2">
                                    <span>Order Details</span>
                                    <span className="text-xs font-medium text-gray-400 font-mono">#{order.id.slice(-8)}</span>
                                  </h4>
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    Placed on {formatDate(order.createdAt)} at {formatTime(order.createdAt)}
                                  </p>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${sc.bg} ${sc.text} ${sc.border}`}>
                                  {sc.icon} {sc.label}
                                </span>
                              </div>

                              {/* Thalis Breakdown */}
                              <div className="space-y-2">
                                <h5 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Thali Items</h5>
                                {order.thaliItems.length > 0 ? (
                                  <div className="space-y-2">
                                    {order.thaliItems.map((item) => (
                                      <div key={item.id} className="flex items-center justify-between text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex-wrap gap-2">
                                        <span className="font-bold text-gray-900">
                                          {item.quantity} × {item.thali.name}
                                        </span>
                                        {item.sabjiProduct?.name && (
                                          <span className="text-[11px] font-bold text-orange-800 bg-orange-100/90 border border-orange-200 px-2.5 py-0.5 rounded-full">
                                            Sabji: {item.sabjiProduct.name}
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : order.thali ? (
                                  <div className="text-xs font-bold text-gray-900 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                    {order.thali.name}
                                  </div>
                                ) : null}
                              </div>

                              {/* Add-ons Breakdown */}
                              {order.addonItems.length > 0 && (
                                <div className="space-y-1.5">
                                  <h5 className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Add-on Extras</h5>
                                  <div className="flex flex-wrap gap-2">
                                    {order.addonItems.map((item) => (
                                      <span key={item.id} className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1 rounded-full">
                                        + {item.quantity}× {item.addonProduct.name} ({formatCurrency(item.priceSnapshot * item.quantity)})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Customer Note */}
                              {order.note && (
                                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950">
                                  <MessageSquare size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                  <p><strong>Note:</strong> {order.note}</p>
                                </div>
                              )}

                              {/* Kitchen Replies */}
                              {order.comments && order.comments.filter((c) => c.authorType === "STAFF").length > 0 && (
                                <div className="space-y-1.5">
                                  {order.comments
                                    .filter((c) => c.authorType === "STAFF")
                                    .map((c) => (
                                      <div key={c.id} className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-950">
                                        <span className="text-blue-500 shrink-0">💬</span>
                                        <p><strong>Kitchen Reply:</strong> {c.message}</p>
                                      </div>
                                    ))}
                                </div>
                              )}

                              {/* Delivery Address */}
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <MapPin size={15} className="text-orange-500 shrink-0" />
                                  <div>
                                    <span className="font-extrabold text-[10px] text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded mr-1.5">
                                      📍 {order.address?.type || "WORKPLACE"}
                                    </span>
                                    <span className="font-bold text-gray-800">
                                      {order.address ? order.address.line1 : "Primary Office Address (Workplace Delivery)"}
                                    </span>
                                    {order.address?.city && <span className="text-gray-500">, {order.address.city}</span>}
                                  </div>
                                </div>
                              </div>

                              {/* Footer Actions */}
                              <div className="flex items-center justify-between gap-3 border-t border-gray-100 pt-3 flex-wrap">
                                <div>
                                  <span className="text-[10px] font-black uppercase text-gray-400 block">Total Billed</span>
                                  <span className="text-lg font-black text-orange-600">{formatCurrency(order.totalAmount)}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <a
                                    href={getWhatsAppInquiryLink(`Hi ViTa Cuisine! I have a question about my Order dated ${formatDate(order.menu.date)} (${order.menu.mealType === "LUNCH" ? "Lunch" : "Dinner"})`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                  >
                                    <span>💬 Order Support</span>
                                  </a>
                                  <a
                                    href="/menu"
                                    className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-orange-500/20 flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span>Reorder 🍲</span>
                                  </a>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !error && orders.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500 font-medium">
              Showing <span className="font-bold text-gray-900">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}</span> of <span className="font-bold text-gray-900">{total}</span> orders (15 per page)
            </p>

            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => { setPage(1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={page === 1 || loading}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-orange-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                « First
              </button>
              <button
                type="button"
                onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={page === 1 || loading}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-orange-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                ‹ Prev
              </button>

              {getPageNumbers(page, totalPages).map((pNum, idx) =>
                typeof pNum === "number" ? (
                  <button
                    key={`pg_${pNum}`}
                    type="button"
                    onClick={() => { setPage(pNum); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={`px-3 py-1.5 text-xs font-black rounded-lg border transition-all cursor-pointer ${
                      page === pNum
                        ? "bg-orange-500 text-white border-orange-500 shadow-xs"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-orange-50 hover:border-orange-300"
                    }`}
                  >
                    {pNum}
                  </button>
                ) : (
                  <span key={`dots_${idx}`} className="px-1 text-xs text-gray-400 font-bold">
                    ...
                  </span>
                )
              )}

              <button
                type="button"
                onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={page === totalPages || loading}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-700 hover:bg-orange-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Next ›
              </button>
              <button
                type="button"
                onClick={() => { setPage(totalPages); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                disabled={page === totalPages || loading}
                className="px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-orange-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                Last »
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
