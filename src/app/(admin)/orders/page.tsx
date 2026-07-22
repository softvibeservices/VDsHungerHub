"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  Package,
  XCircle,
  ShoppingBag,
  Building2,
  SlidersHorizontal,
  ArrowUpDown,
  FilterX,
  MessageSquare,
  Send,
  ChevronDown,
  ChevronUp,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import toast from "react-hot-toast";
import { getTodayIST, formatCurrency } from "@/lib/utils";
import SearchInput from "@/components/ui/SearchInput";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

interface OrderThaliItem {
  id: string;
  quantity: number;
  thali: { id: string; name: string; nameGu?: string | null; price: number };
  sabjiProduct?: { id: string; name: string; nameGu?: string | null } | null;
}

interface OrderAddonItem {
  id: string;
  quantity: number;
  priceSnapshot: number;
  addonProduct: { id: string; name: string; nameGu?: string | null };
}

interface AdminOrder {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  note?: string | null;          // FIX #2: customer cooking instruction
  user: {
    id: string;
    name: string;
    number: string;
    company: { id: string; name: string };
  };
  thali: { id: string; name: string; nameGu: string | null; price: number };
  thaliItems?: OrderThaliItem[];
  addonItems?: OrderAddonItem[];
  menu: {
    id: string;
    date: string;
    mealType: "LUNCH" | "DINNER";
    publicSlug: string | null;
  };
  selectedSabji: { product: { id: string; name: string } }[];
  selectedAddons: { product: { id: string; name: string }; price: number; quantity: number }[];
  comments?: OrderComment[];     // FIX #2: admin reply thread
}

interface OrderComment {
  id: string;
  authorType: "STAFF" | "CUSTOMER";
  authorStaffId?: string | null;
  message: string;
  createdAt: string;
}

interface OrdersResponse {
  date: string;
  totalOrders: number;
  lunch: { count: number; orders: AdminOrder[] };
  dinner: { count: number; orders: AdminOrder[] };
  fetchedAt: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  PENDING: <Clock size={13} className="text-yellow-500 flex-shrink-0" />,
  CONFIRMED: <CheckCircle2 size={13} className="text-blue-500 flex-shrink-0" />,
  PREPARING: <UtensilsCrossed size={13} className="text-purple-500 flex-shrink-0" />,
  OUT_FOR_DELIVERY: <Truck size={13} className="text-indigo-500 flex-shrink-0" />,
  DELIVERED: <Package size={13} className="text-green-500 flex-shrink-0" />,
  CANCELLED: <XCircle size={13} className="text-red-500 flex-shrink-0" />,
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-50 text-yellow-700 border border-yellow-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border border-blue-200",
  PREPARING: "bg-purple-50 text-purple-700 border border-purple-200",
  OUT_FOR_DELIVERY: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  DELIVERED: "bg-green-50 text-green-700 border border-green-200",
  CANCELLED: "bg-red-50 text-red-700 border border-red-200",
};

export default function AdminOrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [activeTab, setActiveTab] = useState<"LUNCH" | "DINNER">("LUNCH");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filter & Sorting state
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [showOnlyWithNotes, setShowOnlyWithNotes] = useState(false);
  const [sortBy, setSortBy] = useState<"time-desc" | "time-asc" | "amount-desc" | "amount-asc" | "name-asc">("time-desc");

  // Bulk Selection state
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // FIX #2: comment thread state per order (openId → { loading, replyText, localComments })
  const [commentThreads, setCommentThreads] = useState<
    Record<string, { open: boolean; replyText: string; loading: boolean; comments: OrderComment[] }>
  >({});

  const openCommentThread = async (orderId: string, initialComments: OrderComment[] = []) => {
    setCommentThreads((prev) => ({
      ...prev,
      [orderId]: { open: true, replyText: "", loading: false, comments: initialComments },
    }));
  };

  const closeCommentThread = (orderId: string) => {
    setCommentThreads((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], open: false },
    }));
  };

  const sendReply = async (orderId: string) => {
    const thread = commentThreads[orderId];
    if (!thread || !thread.replyText.trim()) return;
    setCommentThreads((prev) => ({ ...prev, [orderId]: { ...prev[orderId], loading: true } }));
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: thread.replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Failed to post reply"); return; }
      setCommentThreads((prev) => ({
        ...prev,
        [orderId]: {
          ...prev[orderId],
          replyText: "",
          comments: [...(prev[orderId]?.comments ?? []), data.comment],
        },
      }));
      toast.success("Reply added");
    } catch {
      toast.error("Network error");
    } finally {
      setCommentThreads((prev) => ({ ...prev, [orderId]: { ...prev[orderId], loading: false } }));
    }
  };

  // Fetch companies for dropdown list
  useEffect(() => {
    async function fetchCompanies() {
      try {
        const res = await fetch("/api/companies?limit=100");
        if (res.ok) {
          const json = await res.json();
          setCompanies(json.companies ?? []);
        }
      } catch (err) {
        console.error("Failed to load companies:", err);
      }
    }
    fetchCompanies();
  }, []);

  const fetchOrders = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) setRefreshing(true);
      try {
        const res = await fetch(
          `/api/admin/orders?date=${selectedDate}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to load orders");
        const json: OrdersResponse = await res.json();
        setData(json);
        setLastFetchedAt(json.fetchedAt);
      } catch {
        if (showRefreshIndicator) toast.error("Could not refresh orders");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  // Initial load + 5-minute polling
  useEffect(() => {
    setLoading(true);
    fetchOrders();

    pollTimerRef.current = setInterval(() => {
      fetchOrders(); // silent background refresh
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchOrders]);

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(`Order marked as ${newStatus.toLowerCase()}`);
      fetchOrders(); // refresh after status change
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleBulkStatusChange(newStatus: OrderStatus) {
    if (selectedOrderIds.length === 0) return;
    setUpdatingId("BULK");
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedOrderIds,
          status: newStatus,
        }),
      });
      if (!res.ok) throw new Error("Bulk update failed");
      const json = await res.json();
      toast.success(`Updated ${json.updatedCount} orders to ${newStatus.toLowerCase()}`);
      setSelectedOrderIds([]); // Clear selection
      fetchOrders(); // Refresh table
    } catch {
      toast.error("Failed to update status in bulk");
    } finally {
      setUpdatingId(null);
    }
  }

  const activeOrders =
    activeTab === "LUNCH"
      ? data?.lunch.orders ?? []
      : data?.dinner.orders ?? [];

  // Frontend filtering and sorting
  const filteredAndSortedOrders = activeOrders
    .filter((order) => {
      // Search by user name, user number, or thali name
      const matchesSearch =
        searchQuery === "" ||
        order.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.user.number.includes(searchQuery) ||
        order.thali.name.toLowerCase().includes(searchQuery.toLowerCase());

      // Filter by Company
      const matchesCompany =
        selectedCompanyId === "" || order.user.company.id === selectedCompanyId;

      // Filter by Status
      const matchesStatus =
        selectedStatus === "" || order.status === selectedStatus;

      // Filter by Customer Note / Instructions
      const matchesNoteFilter = !showOnlyWithNotes || !!order.note?.trim();

      return matchesSearch && matchesCompany && matchesStatus && matchesNoteFilter;
    })
    .sort((a, b) => {
      if (sortBy === "time-desc") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "time-asc") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "amount-desc") {
        return b.totalAmount - a.totalAmount;
      }
      if (sortBy === "amount-asc") {
        return a.totalAmount - b.totalAmount;
      }
      if (sortBy === "name-asc") {
        return a.user.name.localeCompare(b.user.name);
      }
      return 0;
    });

  interface CustomerOrderGroup {
    key: string;
    user: AdminOrder["user"];
    orders: AdminOrder[];
    totalAmount: number;
  }

  const groupedCustomerOrders: CustomerOrderGroup[] = useMemo(() => {
    const map = new Map<string, CustomerOrderGroup>();
    for (const o of filteredAndSortedOrders) {
      const key = o.user.number;
      if (!map.has(key)) {
        map.set(key, { key, user: o.user, orders: [], totalAmount: 0 });
      }
      const group = map.get(key)!;
      group.orders.push(o);
      group.totalAmount += o.totalAmount;
    }
    return Array.from(map.values());
  }, [filteredAndSortedOrders]);

  // Clear selection on filter / tab changes to prevent accidental updates on off-screen items
  useEffect(() => {
    setSelectedOrderIds([]);
  }, [activeTab, selectedCompanyId, selectedDate, searchQuery, selectedStatus, showOnlyWithNotes]);

  // Calculate pending count for display
  const pendingCount = data
    ? [...data.lunch.orders, ...data.dinner.orders].filter((o) => o.status === "PENDING").length
    : 0;

  // Determine header checkbox states
  const allVisibleSelected =
    filteredAndSortedOrders.length > 0 &&
    filteredAndSortedOrders.every((o) => selectedOrderIds.includes(o.id));

  const someVisibleSelected =
    selectedOrderIds.length > 0 && !allVisibleSelected;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-orange-500 flex-shrink-0" size={22} />
            <h2 className="text-xl font-bold text-gray-900 leading-none">Orders</h2>
          </div>
          {data && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
              <span className="text-[10px] font-extrabold bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Total: {data.totalOrders}
              </span>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm border ${
                pendingCount > 0 
                  ? "bg-yellow-50 text-yellow-750 border-yellow-200 animate-pulse" 
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                Pending: {pendingCount}
              </span>
              <span className="text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Lunch: {data.lunch.count}
              </span>
              <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Dinner: {data.dinner.count}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm border border-gray-250 rounded-xl px-3 py-2 bg-white text-gray-800 font-medium focus:ring-2 focus:ring-orange-500/30 outline-none cursor-pointer shadow-sm hover:border-gray-300 transition-colors"
          />
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-250 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-40 shadow-sm"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {lastFetchedAt && (
        <p className="text-[11px] text-gray-400 -mt-4 font-medium">
          Last updated: {new Date(lastFetchedAt).toLocaleTimeString("en-IN")} · Auto-refreshes every 5 min
        </p>
      )}

      {/* Filters and search panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search</label>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="User, phone or thali..."
              className="w-full"
            />
          </div>

          {/* Company filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Company</label>
            <div className="relative">
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 text-gray-900 bg-white rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors pr-9 cursor-pointer shadow-sm hover:border-gray-300"
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <Building2 size={15} />
              </div>
            </div>
          </div>

          {/* Status filter */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</label>
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 text-gray-900 bg-white rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors pr-9 cursor-pointer shadow-sm hover:border-gray-300"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="PREPARING">Preparing</option>
                <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <SlidersHorizontal size={15} />
              </div>
            </div>
          </div>

          {/* Sorting */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sort By</label>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 text-sm border border-gray-200 text-gray-900 bg-white rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors pr-9 cursor-pointer shadow-sm hover:border-gray-300"
              >
                <option value="time-desc">Newest First</option>
                <option value="time-asc">Oldest First</option>
                <option value="amount-desc">Price: High to Low</option>
                <option value="amount-asc">Price: Low to High</option>
                <option value="name-asc">Customer Name (A-Z)</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <ArrowUpDown size={15} />
              </div>
            </div>
          </div>
        </div>

        {/* Has Instructions Quick Filter Toggle Chip */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => setShowOnlyWithNotes((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              showOnlyWithNotes
                ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                : "bg-white border-gray-200 text-gray-600 hover:border-amber-300"
            }`}
          >
            <MessageSquare size={13} />
            Has Cooking Instructions
            {data && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                {[...data.lunch.orders, ...data.dinner.orders].filter((o) => !!o.note?.trim()).length}
              </span>
            )}
          </button>
        </div>

        {/* Filters status and reset action */}
        {(searchQuery || selectedCompanyId || selectedStatus || showOnlyWithNotes) && (
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 font-medium">
              Active filters: showing {filteredAndSortedOrders.length} of {activeOrders.length} orders ({groupedCustomerOrders.length} customers)
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCompanyId("");
                setSelectedStatus("");
                setShowOnlyWithNotes(false);
              }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-bold transition-colors"
            >
              <FilterX size={13} />
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Meal type tabs */}
      <div className="flex gap-1 bg-gray-200/60 p-1 rounded-xl w-fit">
        {(["LUNCH", "DINNER"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}
            {data && (
              <span className="ml-1.5 text-xs text-gray-400 font-bold">
                ({tab === "LUNCH" ? data.lunch.count : data.dinner.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Bulk actions bar */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between gap-4 flex-wrap animate-fadeIn shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-550 text-white text-[11px] flex items-center justify-center font-bold">
              {selectedOrderIds.length}
            </span>
            <p className="text-xs font-bold text-orange-805 uppercase tracking-wider">orders selected</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => handleBulkStatusChange("OUT_FOR_DELIVERY")}
              disabled={updatingId !== null}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
            >
              <Truck size={13} />
              Mark Out for Delivery
            </button>
            <button
              onClick={() => handleBulkStatusChange("DELIVERED")}
              disabled={updatingId !== null}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
            >
              <Package size={13} />
              Mark Delivered
            </button>
            <button
              onClick={() => handleBulkStatusChange("CANCELLED")}
              disabled={updatingId !== null}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
            >
              <XCircle size={13} />
              Mark Cancelled
            </button>
            <button
              onClick={() => handleBulkStatusChange("PENDING")}
              disabled={updatingId !== null}
              className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
            >
              <Clock size={13} />
              Mark Pending
            </button>
            <button
              onClick={() => setSelectedOrderIds([])}
              className="px-3 py-1.5 bg-white border border-gray-250 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold transition-colors shadow-sm"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* CUSTOMER GROUPED ORDERS VIEW */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 mt-2 font-medium">Loading customer orders...</p>
          </div>
        ) : groupedCustomerOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center text-gray-400 shadow-sm">
            <p className="font-bold text-gray-700 text-base">
              {activeOrders.length === 0
                ? `No ${activeTab.toLowerCase()} orders for ${selectedDate}`
                : "No orders matched your filters"}
            </p>
            {activeOrders.length > 0 && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCompanyId("");
                  setSelectedStatus("");
                  setShowOnlyWithNotes(false);
                }}
                className="mt-2 text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          groupedCustomerOrders.map((group) => (
            <div
              key={group.key}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:border-orange-200 transition-all space-y-0"
            >
              {/* Customer Header Bar */}
              <div className="bg-gradient-to-r from-gray-50 to-orange-50/20 px-5 py-3.5 border-b border-gray-150 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-500/10 text-orange-600 font-extrabold flex items-center justify-center text-sm border border-orange-200">
                    {group.user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-gray-900 text-base">{group.user.name}</h3>
                      <span className="text-xs text-gray-500 font-mono font-medium">+91 {group.user.number}</span>
                      {group.user.company && (
                        <span className="text-[10px] bg-gray-100 text-gray-700 border border-gray-200 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                          🏢 {group.user.company.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full border border-orange-200">
                    {group.orders.length} {group.orders.length === 1 ? "Order" : "Orders"}
                  </span>
                  <span className="text-sm font-black text-gray-900">
                    Total: <span className="text-orange-600">{formatCurrency(group.totalAmount)}</span>
                  </span>
                </div>
              </div>

              {/* Indented List of Orders for this Customer */}
              <div className="divide-y divide-gray-100">
                {group.orders.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  return (
                    <div
                      key={order.id}
                      className={`p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isSelected ? "bg-orange-50/20" : "hover:bg-gray-50/50"
                      }`}
                    >
                      {/* Left: Checkbox + Time + Line items */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOrderIds((prev) => [...prev, order.id]);
                            } else {
                              setSelectedOrderIds((prev) =>
                                prev.filter((id) => id !== order.id)
                              );
                            }
                          }}
                          className="w-4 h-4 mt-1 text-orange-500 border-gray-300 rounded focus:ring-orange-500 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                        />

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                              {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {order.menu.publicSlug && (
                              <span className="text-[10px] text-gray-400 font-mono">#{order.id.slice(-6)}</span>
                            )}
                          </div>

                          {/* Line Items */}
                          {order.thaliItems && order.thaliItems.length > 0 ? (
                            <div className="space-y-1">
                              {order.thaliItems.map((ti) => (
                                <div key={ti.id} className="text-sm font-medium text-gray-900 flex items-center gap-2 flex-wrap">
                                  <span>
                                    {ti.quantity}× <strong className="text-gray-900">{ti.thali.name}</strong>
                                  </span>
                                  {ti.sabjiProduct && (
                                    <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-md font-bold">
                                      Sabji: {ti.sabjiProduct.name}
                                    </span>
                                  )}
                                </div>
                              ))}
                              {order.addonItems && order.addonItems.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 items-center pt-1">
                                  {order.addonItems.map((ai) => (
                                    <span
                                      key={ai.id}
                                      className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold"
                                    >
                                      +{ai.addonProduct.name} x{ai.quantity} ({formatCurrency(ai.priceSnapshot * ai.quantity)})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-bold text-gray-900 text-sm">{order.thali.name}</p>
                              {(order.selectedSabji.length > 0 || order.selectedAddons.length > 0) && (
                                <div className="flex flex-wrap gap-1 items-center">
                                  {order.selectedSabji.map(({ product }) => (
                                    <span key={product.id} className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-1.5 py-0.5 rounded font-bold">
                                      {product.name}
                                    </span>
                                  ))}
                                  {order.selectedAddons.map(({ product, price, quantity }) => (
                                    <span key={product.id} className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-1.5 py-0.5 rounded font-bold">
                                      +{product.name} {quantity > 1 ? `x${quantity}` : ""} ({formatCurrency(price * (quantity || 1))})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Cooking Instruction note */}
                          {order.note && (
                            <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 max-w-md mt-1">
                              <MessageSquare size={12} className="text-amber-600 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-amber-900 font-semibold leading-snug">
                                Instruction: {order.note}
                              </p>
                            </div>
                          )}

                          {/* Comment thread toggle */}
                          {(() => {
                            const thread = commentThreads[order.id];
                            const isOpen = thread?.open ?? false;
                            const commentCount = (thread?.comments ?? order.comments ?? []).length;

                            return (
                              <div className="pt-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isOpen
                                      ? closeCommentThread(order.id)
                                      : openCommentThread(order.id, order.comments ?? [])
                                  }
                                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-bold transition-colors"
                                >
                                  <MessageSquare size={12} />
                                  {commentCount > 0 ? `${commentCount} Reply${commentCount > 1 ? "ies" : ""}` : "Add Reply"}
                                  {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>

                                {isOpen && (
                                  <div className="mt-2 border border-blue-200 rounded-xl overflow-hidden bg-blue-50/30 max-w-md">
                                    {(thread?.comments ?? []).length > 0 && (
                                      <div className="divide-y divide-blue-100">
                                        {(thread?.comments ?? []).map((c) => (
                                          <div key={c.id} className="px-3 py-2">
                                            <p className="text-xs font-bold text-blue-800">
                                              {c.authorType === "STAFF" ? "🧑‍💼 Staff" : "👤 Customer"}
                                              <span className="text-[10px] text-blue-500 font-normal ml-2">
                                                {new Date(c.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                              </span>
                                            </p>
                                            <p className="text-xs text-gray-800 mt-0.5">{c.message}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 p-2 border-t border-blue-100 bg-white">
                                      <input
                                        type="text"
                                        value={thread?.replyText ?? ""}
                                        onChange={(e) =>
                                          setCommentThreads((prev) => ({
                                            ...prev,
                                            [order.id]: { ...prev[order.id], replyText: e.target.value },
                                          }))
                                        }
                                        onKeyDown={(e) => e.key === "Enter" && sendReply(order.id)}
                                        placeholder="Type reply to customer…"
                                        className="flex-1 text-xs px-3 py-1.5 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500 min-w-0"
                                        maxLength={500}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => sendReply(order.id)}
                                        disabled={thread?.loading || !thread?.replyText?.trim()}
                                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors flex-shrink-0 text-xs font-bold"
                                      >
                                        <Send size={12} />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Right: Amount + Status + Actions */}
                      <div className="flex items-center gap-3 self-end md:self-center flex-wrap">
                        <span className="font-black text-gray-900 text-base">
                          {formatCurrency(order.totalAmount)}
                        </span>

                        <div className="flex items-center gap-1.5">
                          {STATUS_ICONS[order.status]}
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${STATUS_COLORS[order.status]}`}>
                            {order.status}
                          </span>
                        </div>

                        {/* Quick actions for Pending, Confirmed or Preparing orders */}
                        {(order.status === "PENDING" || order.status === "CONFIRMED" || order.status === "PREPARING") && (
                          <button
                            onClick={() => handleStatusChange(order.id, "OUT_FOR_DELIVERY")}
                            disabled={updatingId !== null}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1 shadow-sm"
                            title="Mark Out for Delivery"
                          >
                            <Truck size={12} />
                            Out for Delivery
                          </button>
                        )}

                        <select
                          value={order.status}
                          disabled={updatingId !== null}
                          onChange={(e) =>
                            handleStatusChange(order.id, e.target.value as OrderStatus)
                          }
                          className="text-xs border border-gray-300 rounded-lg px-2.5 py-1 bg-white text-gray-800 font-bold focus:ring-1 focus:ring-orange-500 outline-none disabled:opacity-40 hover:border-gray-400 transition-colors shadow-sm cursor-pointer"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="CONFIRMED">Confirmed</option>
                          <option value="PREPARING">Preparing</option>
                          <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                          <option value="DELIVERED">Delivered</option>
                          <option value="CANCELLED">Cancelled</option>
                        </select>

                        {updatingId === order.id && (
                          <RefreshCw size={14} className="animate-spin text-orange-500" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
