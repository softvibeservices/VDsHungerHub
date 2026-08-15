"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  UtensilsCrossed, Clock, CheckCircle2, Package, XCircle, Truck,
  AlertCircle, ChevronDown, ChevronUp, Filter, Search,
  Calendar, Loader2, MessageSquare
} from "lucide-react";

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

const STATUS_CONFIG: Record<OrderStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  PENDING:          { label: "Pending",         bg: "bg-yellow-50",  text: "text-yellow-700",  icon: <Clock size={11} /> },
  OUT_FOR_DELIVERY: { label: "Out for Delivery", bg: "bg-indigo-50",  text: "text-indigo-700", icon: <Truck size={11} /> },
  DELIVERED:        { label: "Delivered",        bg: "bg-green-50",   text: "text-green-700",   icon: <Package size={11} /> },
  CANCELLED:        { label: "Cancelled",        bg: "bg-red-50",     text: "text-red-700",     icon: <XCircle size={11} /> },
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

  // Requirement #1: Quick Date Selection Preset Helpers (1-15, 16-31, This Month)
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

  // Date checking for today's active orders
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

  // Requirement #4: Smart Page Number Windowing for 1000s of Orders
  const getPageNumbers = (current: number, max: number) => {
    const pages: (number | string)[] = [];
    if (max <= 7) {
      for (let i = 1; i <= max; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      const start = Math.max(2, current - 1);
      const end = Math.min(max - 1, current + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (current < max - 2) pages.push("...");
      pages.push(max);
    }
    return pages;
  };

  // ── Render helpers ──────────────────────────────────────────────────────────

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric"
    });

  const formatDateHeader = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric"
    });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true
    });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">My Orders</h1>
            {!loading && total > 0 && hasFilters && (
              <span className="text-xs font-black text-orange-700 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded-full shadow-2xs">
                Total Spend: {formatCurrency(filteredTotalAmount)}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            {total > 0 && !loading ? (
              <>Showing {orders.length} of {total} order{total > 1 ? "s" : ""} · Page {page} of {totalPages}</>
            ) : (
              "Track your thali orders and history"
            )}
          </p>
        </div>
      </div>

      {/* Quick Date Presets Bar — Always Visible directly on main page (outside filter dialog) */}
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

        <button
          type="button"
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer self-start sm:self-auto ${
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

      {/* Advanced Filter panel (optional expansion) */}
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

      {/* Requirement #2: Highlighted Beautiful Active Filter Applied Callout Banner */}
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
                Filtered Total Bill: <span className="text-amber-100 text-lg font-black">{formatCurrency(filteredTotalAmount)}</span>
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

      {/* Orders Table — Desktop */}
      {!loading && !error && orders.length > 0 && (
        <>
          <div className="hidden md:block bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100/90">
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold text-gray-700 uppercase tracking-wider whitespace-nowrap border-r border-gray-200">Date &amp; Meal</th>
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold text-gray-700 uppercase tracking-wider border-r border-gray-200">Order Details</th>
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold text-gray-700 uppercase tracking-wider whitespace-nowrap border-r border-gray-200">Total</th>
                  <th className="text-left px-5 py-3.5 text-xs font-extrabold text-gray-700 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order, index) => {
                  const sc = STATUS_CONFIG[order.status];
                  const isCurrent = isCurrentActiveOrder(order);

                  // Requirement #3: Check if date changes from previous order to render day divider row
                  const prevOrder = index > 0 ? orders[index - 1] : null;
                  const showDateDivider = !prevOrder || prevOrder.menu.date !== order.menu.date;

                  return (
                    <Fragment key={`grp_${order.id}`}>
                      {/* Requirement #3: Horizontal Date Divider Row (SaaS Style) */}
                      {showDateDivider && (
                        <tr key={`divider_${order.id}`} className="bg-slate-100/90 border-y-2 border-slate-200">
                          <td colSpan={4} className="px-5 py-3 bg-slate-100/90">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
                                <Calendar size={13} />
                              </div>
                              <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                                {formatDateHeader(order.menu.date)}
                              </span>
                              <span className="text-[10px] font-extrabold text-orange-700 bg-orange-100 border border-orange-200 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                                {order.menu.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}
                              </span>
                              <div className="h-0.5 bg-slate-300 flex-1 ml-2 rounded-full" />
                            </div>
                          </td>
                        </tr>
                      )}

                      <tr
                        key={order.id}
                        className={`transition-all ${
                          isCurrent
                            ? "bg-gradient-to-r from-amber-50/90 via-orange-50/60 to-amber-50/90 hover:from-amber-100/90 hover:to-orange-100/70 border-l-4 border-orange-500 shadow-xs font-medium"
                            : "hover:bg-orange-50/20"
                        }`}
                      >
                        {/* Date & Meal */}
                        <td className="px-5 py-4 whitespace-nowrap border-r border-gray-200">
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-800 text-sm">{formatDate(order.menu.date)}</p>
                            {isCurrent && (
                              <span className="text-[10px] font-extrabold bg-orange-500 text-white px-2 py-0.5 rounded-full shadow-xs animate-pulse">
                                TODAY
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5 font-medium">
                            {order.menu.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{formatTime(order.createdAt)}</p>
                        </td>

                        {/* Order Details */}
                        <td className="px-5 py-4 border-r border-gray-200">
                          <div className="space-y-1.5 max-w-sm">
                            {order.thaliItems.length > 0 ? (
                              <div className="space-y-1">
                                {order.thaliItems.map((item) => {
                                  const sabjiName = item.sabjiProduct?.name;
                                  return (
                                    <div key={item.id} className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-gray-800 text-xs">
                                        {item.quantity}× {item.thali.name}
                                      </span>
                                      {sabjiName && (
                                        <span className="text-[10px] bg-orange-100 text-orange-800 border border-orange-200 px-2 py-0.5 rounded-full font-bold">
                                          Sabji: {sabjiName}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : order.thali ? (
                              <p className="font-bold text-gray-800 text-xs">{order.thali.name}</p>
                            ) : null}

                            {order.addonItems.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
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

                            {order.note && (
                              <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-1">
                                <MessageSquare size={11} className="text-amber-600 mt-0.5 flex-shrink-0" />
                                <p className="text-[11px] text-amber-900 font-medium">{order.note}</p>
                              </div>
                            )}

                            {order.comments && order.comments.length > 0 && (
                              <div className="space-y-1 mt-1">
                                {order.comments
                                  .filter((c) => c.authorType === "STAFF")
                                  .map((c) => (
                                    <div key={c.id} className="flex items-start gap-1.5 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                                      <span className="text-[10px] text-blue-500 flex-shrink-0">💬</span>
                                      <p className="text-[11px] text-blue-900 font-medium">{c.message}</p>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-4 whitespace-nowrap border-r border-gray-200">
                          <span className="font-black text-orange-600 text-base">{formatCurrency(order.totalAmount)}</span>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {isCurrent ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold px-3 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-sm shadow-orange-500/25 animate-pulse">
                                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                                {order.status === "OUT_FOR_DELIVERY" ? "🚚 OUT FOR DELIVERY" : "⏳ PREPARING IN KITCHEN"}
                              </span>
                            </div>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${sc.bg} ${sc.text}`}>
                              {sc.icon}
                              {sc.label}
                            </span>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list (accordion style) */}
          <div className="md:hidden space-y-3">
            {orders.map((order, index) => {
              const sc = STATUS_CONFIG[order.status];
              const isOpen = expandedId === order.id;
              const isCurrent = isCurrentActiveOrder(order);

              // Requirement #3: Check if date changes for mobile dividers
              const prevOrder = index > 0 ? orders[index - 1] : null;
              const showDateDivider = !prevOrder || prevOrder.menu.date !== order.menu.date;

              return (
                <div key={`mob_wrapper_${order.id}`} className="space-y-3">
                  {/* Requirement #3: Mobile Date Divider */}
                  {showDateDivider && (
                    <div key={`mob_divider_${order.id}`} className="flex items-center gap-2 pt-4 pb-2 border-b border-gray-200">
                      <div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        <Calendar size={13} />
                      </div>
                      <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                        {formatDateHeader(order.menu.date)}
                      </span>
                      <span className="text-[10px] font-extrabold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-md uppercase">
                        {order.menu.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}
                      </span>
                      <div className="h-0.5 bg-slate-200 flex-1 ml-1 rounded-full" />
                    </div>
                  )}

                  <div
                    key={order.id}
                    className={`rounded-3xl border transition-all overflow-hidden ${
                      isCurrent
                        ? "bg-gradient-to-r from-amber-50/90 via-orange-50/75 to-amber-50/90 border-2 border-orange-400 ring-2 ring-orange-300/30 shadow-md"
                        : "bg-white border-gray-100 shadow-sm"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : order.id)}
                      className="w-full px-4 py-3.5 flex items-center justify-between text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm">{formatDate(order.menu.date)}</span>
                          <span className="text-xs text-gray-500 font-medium">{order.menu.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {isCurrent ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                              {order.status === "OUT_FOR_DELIVERY" ? "OUT FOR DELIVERY" : "KITCHEN PREPARING"}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                              {sc.icon} {sc.label}
                            </span>
                          )}
                          <span className="font-black text-orange-600 text-sm">{formatCurrency(order.totalAmount)}</span>
                        </div>
                      </div>
                      {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 border-t border-gray-50 pt-3 space-y-3">
                        {order.thaliItems.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Meals Chosen</p>
                            {order.thaliItems.map((item) => (
                              <div key={item.id} className="flex justify-between items-center text-xs">
                                <span className="font-semibold text-gray-800">{item.quantity}× {item.thali.name}</span>
                                {item.sabjiProduct && (
                                  <span className="text-[11px] bg-orange-100 text-orange-800 border border-orange-200 px-2 py-0.5 rounded-xl font-bold">
                                    {item.sabjiProduct.name}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

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

                        {order.note && (
                          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                            <MessageSquare size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-900 font-medium">{order.note}</p>
                          </div>
                        )}

                        {order.comments && order.comments.filter((c) => c.authorType === "STAFF").length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">From Kitchen</p>
                            {order.comments
                              .filter((c) => c.authorType === "STAFF")
                              .map((c) => (
                                <div key={c.id} className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                                  <span className="text-xs flex-shrink-0">💬</span>
                                  <p className="text-xs text-blue-900 font-medium">{c.message}</p>
                                </div>
                              ))}
                          </div>
                        )}

                        <p className="text-[10px] text-gray-400">Ordered at {formatTime(order.createdAt)}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Requirement #4: Scalable Multi-Page Pagination Controls (Handles Thousands of Orders) */}
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
        </>
      )}
    </div>
  );
}
