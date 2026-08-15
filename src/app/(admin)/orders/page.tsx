// src\app\(admin)\orders\page.tsx

"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  RefreshCw,
  Clock,
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
  Sun,
  Moon,
  UtensilsCrossed,
} from "lucide-react";
import toast from "react-hot-toast";
import { getTodayIST, formatCurrency } from "@/lib/utils";
import SearchInput from "@/components/ui/SearchInput";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PageToolbar from "@/components/ui/PageToolbar";
import Tabs from "@/components/ui/Tabs";
import Badge, { BadgeVariant } from "@/components/ui/Badge";
import OrderSummaryMatrix from "./_OrderSummaryMatrix";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { hasPermission } from "@/lib/rbac-client";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

type OrderStatus =
  | "PENDING"
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
    company: { id: string; name: string; address?: string | null } | null;
  };
  thali: { id: string; name: string; nameGu: string | null; price: number } | null;
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

const ORDER_STATUS_BADGE: Record<OrderStatus, { variant: BadgeVariant; icon: any; label: string }> = {
  PENDING:          { variant: "warning", icon: Clock,           label: "Pending" },
  OUT_FOR_DELIVERY: { variant: "info",    icon: Truck,           label: "Out for Delivery" },
  DELIVERED:        { variant: "success", icon: Package,         label: "Delivered" },
  CANCELLED:        { variant: "danger",  icon: XCircle,         label: "Cancelled" },
};

export default function AdminOrdersPage() {
  const currentUser = useCurrentUser();
  const canUpdateOrders = hasPermission(currentUser, "orders:update-status");

  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [activeTab, setActiveTab] = useState<"LUNCH" | "DINNER">("LUNCH");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Summary Matrix Toggle (default: false / hidden)
  const [showSummaryMatrix, setShowSummaryMatrix] = useState(false);

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
    if (!canUpdateOrders) {
      toast.error("Forbidden: missing orders:update-status permission");
      return;
    }
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Update failed");
      }
      toast.success(`Order marked as ${newStatus.toLowerCase()}`);
      fetchOrders(); // refresh after status change
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleGroupStatusChange(targetOrderIds: string[], newStatus: OrderStatus, labelName?: string) {
    if (!canUpdateOrders) {
      toast.error("Forbidden: missing orders:update-status permission");
      return;
    }
    if (targetOrderIds.length === 0) return;
    setUpdatingId("BULK");
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: targetOrderIds,
          status: newStatus,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Bulk update failed");
      }
      const json = await res.json();
      const statusLabel = newStatus.toLowerCase().replace(/_/g, " ");
      toast.success(
        labelName
          ? `Updated ${json.updatedCount} orders for ${labelName} to ${statusLabel}`
          : `Updated ${json.updatedCount} orders to ${statusLabel}`
      );
      setSelectedOrderIds([]); // Clear selection
      fetchOrders(); // Refresh table
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update status in bulk");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleBulkStatusChange(newStatus: OrderStatus) {
    await handleGroupStatusChange(selectedOrderIds, newStatus);
  }

  const activeOrders =
    activeTab === "LUNCH"
      ? data?.lunch.orders ?? []
      : data?.dinner.orders ?? [];

  // Frontend filtering and sorting
  const filteredAndSortedOrders = activeOrders
    .filter((order) => {
      // Search by user name, user number, or thali name (thaliItems or legacy thali)
      const thaliNames = order.thaliItems && order.thaliItems.length > 0
        ? order.thaliItems.map((ti) => ti.thali.name.toLowerCase()).join(" ")
        : (order.thali?.name ?? "").toLowerCase();
      const matchesSearch =
        searchQuery === "" ||
        order.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.user.number.includes(searchQuery) ||
        thaliNames.includes(searchQuery.toLowerCase());

      // Filter by Company
      const matchesCompany =
        selectedCompanyId === "" || order.user.company?.id === selectedCompanyId;

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

  interface CompanyOrderGroup {
    companyId: string;
    companyName: string;
    orders: AdminOrder[];
    totalAmount: number;
    customerGroups: CustomerOrderGroup[];
  }

  const [groupByCompany, setGroupByCompany] = useState(false);
  const [expandedCompanyIds, setExpandedCompanyIds] = useState<Record<string, boolean>>({});

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

  const groupedCompanyOrders: CompanyOrderGroup[] = useMemo(() => {
    const map = new Map<string, CompanyOrderGroup>();

    for (const o of filteredAndSortedOrders) {
      const compId = o.user.company?.id ?? "NO_COMPANY";
      const compName = o.user.company?.name ?? "Individual Customers (No Company)";

      if (!map.has(compId)) {
        map.set(compId, {
          companyId: compId,
          companyName: compName,
          orders: [],
          totalAmount: 0,
          customerGroups: [],
        });
      }

      const group = map.get(compId)!;
      group.orders.push(o);
      group.totalAmount += o.totalAmount;
    }

    for (const group of map.values()) {
      const custMap = new Map<string, CustomerOrderGroup>();
      for (const o of group.orders) {
        const key = o.user.number;
        if (!custMap.has(key)) {
          custMap.set(key, { key, user: o.user, orders: [], totalAmount: 0 });
        }
        const custGroup = custMap.get(key)!;
        custGroup.orders.push(o);
        custGroup.totalAmount += o.totalAmount;
      }
      group.customerGroups = Array.from(custMap.values());
    }

    return Array.from(map.values());
  }, [filteredAndSortedOrders]);

  const toggleCompanyExpand = (companyId: string) => {
    setExpandedCompanyIds((prev) => ({
      ...prev,
      [companyId]: !prev[companyId],
    }));
  };

  const expandAllCompanies = () => {
    const next: Record<string, boolean> = {};
    for (const c of groupedCompanyOrders) {
      next[c.companyId] = true;
    }
    setExpandedCompanyIds(next);
  };

  const collapseAllCompanies = () => {
    setExpandedCompanyIds({});
  };

  const allCompaniesExpanded =
    groupedCompanyOrders.length > 0 &&
    groupedCompanyOrders.every((c) => expandedCompanyIds[c.companyId]);

  const toggleCompanySelection = (companyOrders: AdminOrder[], isAllSelected: boolean) => {
    const orderIds = companyOrders.map((o) => o.id);
    if (isAllSelected) {
      setSelectedOrderIds((prev) => prev.filter((id) => !orderIds.includes(id)));
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...orderIds])));
    }
  };

  // Clear selection on filter / tab changes to prevent accidental updates on off-screen items
  useEffect(() => {
    setSelectedOrderIds([]);
  }, [activeTab, selectedCompanyId, selectedDate, searchQuery, selectedStatus, showOnlyWithNotes]);

  // Calculate pending count for display
  const pendingCount = data
    ? [...data.lunch.orders, ...data.dinner.orders].filter((o) => o.status === "PENDING").length
    : 0;

  const statusCounts = useMemo(() => {
    const counts = { PENDING: 0, OUT_FOR_DELIVERY: 0, DELIVERED: 0, CANCELLED: 0 };
    for (const o of activeOrders) {
      if (counts[o.status] !== undefined) {
        counts[o.status]++;
      }
    }
    return counts;
  }, [activeOrders]);

  // Determine header checkbox states
  const allVisibleSelected =
    filteredAndSortedOrders.length > 0 &&
    filteredAndSortedOrders.every((o) => selectedOrderIds.includes(o.id));

  const someVisibleSelected =
    selectedOrderIds.length > 0 && !allVisibleSelected;

  return (
    <div className="space-y-4">
      {/* Live status pills + date/refresh controls */}
      <PageToolbar
        filters={
          data && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-extrabold bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Total: {data.totalOrders}
              </span>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm border ${
                pendingCount > 0
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                Pending: {pendingCount}
              </span>
            </div>
          )
        }
        actions={
          <>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <Button
              variant="secondary"
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              leftIcon={<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />}
            >
              Refresh
            </Button>
            <Button
              variant={showSummaryMatrix ? "primary" : "secondary"}
              onClick={() => setShowSummaryMatrix((v) => !v)}
              leftIcon={<UtensilsCrossed size={14} />}
            >
              {showSummaryMatrix ? "Hide Kitchen Summary" : "Kitchen Summary"}
            </Button>
          </>
        }
      />

      {lastFetchedAt && (
        <p className="text-[11px] text-gray-400 -mt-3 font-medium">
          Last updated: {new Date(lastFetchedAt).toLocaleTimeString("en-IN")} · Auto-refreshes every 5 min
        </p>
      )}

      {/* Compact Filters & Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-3 space-y-2.5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          {/* Search bar */}
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search customer, phone or thali..."
            className="w-full"
          />

          {/* Company filter */}
          <Select
            value={selectedCompanyId}
            onChange={(e) => setSelectedCompanyId(e.target.value)}
            placeholder="All Companies"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
          />

          {/* Sorting */}
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            options={[
              { value: "time-desc", label: "Sort: Newest First" },
              { value: "time-asc", label: "Sort: Oldest First" },
              { value: "amount-desc", label: "Sort: Price (High to Low)" },
              { value: "amount-asc", label: "Sort: Price (Low to High)" },
              { value: "name-asc", label: "Sort: Customer (A-Z)" },
            ]}
          />
        </div>

        {/* Quick Filter Toggles & Reset */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-gray-100 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setGroupByCompany((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                groupByCompany
                  ? "bg-orange-500 border-orange-500 text-white shadow-sm"
                  : "bg-white border-gray-200 text-gray-700 hover:border-orange-300"
              }`}
            >
              <Building2 size={13} />
              Group by Company
              {groupByCompany && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 font-bold ml-0.5">
                  ({groupedCompanyOrders.length})
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowOnlyWithNotes((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
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

          {(searchQuery || selectedCompanyId || selectedStatus || showOnlyWithNotes) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedCompanyId("");
                setSelectedStatus("");
                setShowOnlyWithNotes(false);
              }}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-bold transition-colors cursor-pointer"
            >
              <FilterX size={13} />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Company Wise Bulk Action Bar when a company filter is selected */}
      {selectedCompanyId && (
        <div className="bg-orange-50/80 border border-orange-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-600 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-orange-950">
                Company Status Actions — {companies.find((c) => c.id === selectedCompanyId)?.name}
              </p>
              <p className="text-[10px] text-orange-700 font-medium">
                Apply status update to all {filteredAndSortedOrders.length} orders for this company
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-orange-800 uppercase tracking-wider hidden sm:inline mr-1">
              Set All Company Orders:
            </span>
            <button
              onClick={() => handleGroupStatusChange(filteredAndSortedOrders.map((o) => o.id), "PENDING", companies.find((c) => c.id === selectedCompanyId)?.name)}
              disabled={updatingId !== null || filteredAndSortedOrders.length === 0}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-yellow-800 bg-yellow-100 hover:bg-yellow-200 active:bg-yellow-300 transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
            >
              Pending
            </button>
            <button
              onClick={() => handleGroupStatusChange(filteredAndSortedOrders.map((o) => o.id), "OUT_FOR_DELIVERY", companies.find((c) => c.id === selectedCompanyId)?.name)}
              disabled={updatingId !== null || filteredAndSortedOrders.length === 0}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-800 bg-indigo-100 hover:bg-indigo-200 active:bg-indigo-300 transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
            >
              🚚 Out for Delivery
            </button>
            <button
              onClick={() => handleGroupStatusChange(filteredAndSortedOrders.map((o) => o.id), "DELIVERED", companies.find((c) => c.id === selectedCompanyId)?.name)}
              disabled={updatingId !== null || filteredAndSortedOrders.length === 0}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 active:bg-emerald-300 transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
            >
              ✓ Delivered
            </button>
            <button
              onClick={() => handleGroupStatusChange(filteredAndSortedOrders.map((o) => o.id), "CANCELLED", companies.find((c) => c.id === selectedCompanyId)?.name)}
              disabled={updatingId !== null || filteredAndSortedOrders.length === 0}
              className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-800 bg-red-100 hover:bg-red-200 active:bg-red-300 transition-colors shadow-sm disabled:opacity-40 cursor-pointer"
            >
              ✕ Cancelled
            </button>
          </div>
        </div>
      )}

      {/* Meal & Status Navigation Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-1">
        <Tabs
          variant="underline"
          value={selectedStatus || "ALL"}
          onChange={(val) => setSelectedStatus(val === "ALL" ? "" : val)}
          items={[
            { value: "ALL", label: `All Orders (${activeOrders.length})` },
            { value: "PENDING", label: `Pending (${statusCounts.PENDING})` },
            { value: "OUT_FOR_DELIVERY", label: `🚚 Out for Delivery (${statusCounts.OUT_FOR_DELIVERY})` },
            { value: "DELIVERED", label: `✓ Delivered (${statusCounts.DELIVERED})` },
            { value: "CANCELLED", label: `✕ Cancelled (${statusCounts.CANCELLED})` },
          ]}
          className="border-b-0"
        />

        {/* Meal type switcher */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-shrink-0">
          {(["LUNCH", "DINNER"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab === "LUNCH" ? (
                <Sun size={14} className="text-amber-500" />
              ) : (
                <Moon size={14} className="text-indigo-500" />
              )}
              {tab === "LUNCH" ? "Lunch" : "Dinner"}
              {data && (
                <span className="ml-1 text-[11px] text-gray-400 font-bold">
                  ({tab === "LUNCH" ? data.lunch.count : data.dinner.count})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 flex items-center justify-between gap-4 flex-wrap animate-fadeIn shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-orange-500 text-white text-[11px] flex items-center justify-center font-bold">
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
              className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-bold transition-colors shadow-sm"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Summary Matrix Panel - Hidden by default, toggled via Kitchen Summary button */}
      {showSummaryMatrix && !loading && filteredAndSortedOrders.length > 0 && (
        <div className="space-y-3 animate-fadeIn">
          <OrderSummaryMatrix
            orders={filteredAndSortedOrders as any}
            mealType={activeTab}
            onClose={() => setShowSummaryMatrix(false)}
          />
        </div>
      )}

      {/* ORDERS LIST CONTAINER (CUSTOMER VIEW VS COMPANY VIEW) */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center shadow-sm">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-gray-500 mt-2 font-medium">Loading customer orders...</p>
          </div>
        ) : filteredAndSortedOrders.length === 0 ? (
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
                  setGroupByCompany(false);
                }}
                className="mt-2 text-xs font-bold text-orange-500 hover:text-orange-600 transition-colors cursor-pointer"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : groupByCompany ? (
          /* COMPANY GROUPED VIEW (COLLAPSED BY DEFAULT) */
          <div className="space-y-4">
            {/* Company View Toolbar: Count summary + Expand All / Collapse All button */}
            <div className="flex items-center justify-between bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-slate-600" />
                <span className="text-xs font-bold text-slate-800">
                  Showing {groupedCompanyOrders.length} {groupedCompanyOrders.length === 1 ? "Company" : "Companies"} ({filteredAndSortedOrders.length} total orders)
                </span>
              </div>
              <button
                type="button"
                onClick={allCompaniesExpanded ? collapseAllCompanies : expandAllCompanies}
                className="flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 bg-white border border-orange-200 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                {allCompaniesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {allCompaniesExpanded ? "Collapse All Companies" : "Expand All Companies"}
              </button>
            </div>

            {groupedCompanyOrders.map((compGroup) => {
              const isExpanded = !!expandedCompanyIds[compGroup.companyId];
              const companyOrderIds = compGroup.orders.map((o) => o.id);
              const isAllCompanySelected =
                companyOrderIds.length > 0 &&
                companyOrderIds.every((id) => selectedOrderIds.includes(id));
              const isSomeCompanySelected =
                companyOrderIds.some((id) => selectedOrderIds.includes(id)) &&
                !isAllCompanySelected;

              return (
                <div
                  key={compGroup.companyId}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:border-orange-300 transition-all"
                >
                  {/* Clickable Company Header Bar (Collapsed by Default) */}
                  <div
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, input, label, .no-expand")) return;
                      toggleCompanyExpand(compGroup.companyId);
                    }}
                    className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Checkbox for entire company */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="no-expand flex items-center p-1 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isAllCompanySelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isSomeCompanySelected;
                          }}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleCompanySelection(compGroup.orders, isAllCompanySelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4.5 h-4.5 rounded text-orange-500 focus:ring-orange-500 border-gray-400 cursor-pointer"
                        />
                      </div>

                      <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-orange-400 flex-shrink-0">
                        <Building2 size={18} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-extrabold text-white text-base truncate">
                            {compGroup.companyName}
                          </h3>
                          <span className="text-xs font-bold bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2.5 py-0.5 rounded-full">
                            {compGroup.orders.length} {compGroup.orders.length === 1 ? "Order" : "Orders"}
                          </span>
                          <span className="text-xs text-slate-300 font-medium">
                            ({compGroup.customerGroups.length} {compGroup.customerGroups.length === 1 ? "customer" : "customers"})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-extrabold text-orange-400">
                        Total: {formatCurrency(compGroup.totalAmount)}
                      </span>

                      {/* Company Status Actions */}
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="no-expand flex flex-wrap items-center gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 shadow-sm max-w-full"
                      >
                        <span className="text-[10px] font-bold text-gray-400 uppercase px-1 hidden sm:inline">
                          Set All:
                        </span>
                        <button
                          onClick={() => handleGroupStatusChange(compGroup.orders.map((o) => o.id), "PENDING", compGroup.companyName)}
                          disabled={updatingId !== null}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-yellow-300 hover:bg-yellow-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Pending
                        </button>
                        <button
                          onClick={() => handleGroupStatusChange(compGroup.orders.map((o) => o.id), "OUT_FOR_DELIVERY", compGroup.companyName)}
                          disabled={updatingId !== null}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-300 hover:bg-indigo-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          🚚 Out for Delivery
                        </button>
                        <button
                          onClick={() => handleGroupStatusChange(compGroup.orders.map((o) => o.id), "DELIVERED", compGroup.companyName)}
                          disabled={updatingId !== null}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          ✓ Delivered
                        </button>
                        <button
                          onClick={() => handleGroupStatusChange(compGroup.orders.map((o) => o.id), "CANCELLED", compGroup.companyName)}
                          disabled={updatingId !== null}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-300 hover:bg-red-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          ✕ Cancelled
                        </button>
                      </div>

                      {/* Expand / Collapse Chevron */}
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-300 flex-shrink-0">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Body: Customers & Orders inside this Company */}
                  {isExpanded && (
                    <div className="p-4 space-y-4 bg-gray-50/50 border-t border-gray-200">
                      {compGroup.customerGroups.map((group) => (
                        <div
                          key={group.key}
                          className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm space-y-0"
                        >
                          {/* Customer Header Bar */}
                          <div className="bg-gradient-to-r from-gray-50 to-orange-50/20 px-5 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-600 font-extrabold flex items-center justify-center text-xs border border-orange-200">
                                {group.user.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-extrabold text-gray-900 text-sm">{group.user.name}</h4>
                                  <span className="text-xs text-gray-500 font-mono">+91 {group.user.number}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-xs font-bold bg-orange-100 text-orange-800 px-2.5 py-0.5 rounded-full border border-orange-200">
                                {group.orders.length} {group.orders.length === 1 ? "Order" : "Orders"}
                              </span>
                              <span className="text-sm font-bold text-gray-900">
                                Total: <span className="text-orange-600">{formatCurrency(group.totalAmount)}</span>
                              </span>

                              <div className="flex flex-wrap items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm max-w-full">
                                <button
                                  onClick={() => handleGroupStatusChange(group.orders.map((o) => o.id), "PENDING", group.user.name)}
                                  disabled={updatingId !== null}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-yellow-700 hover:bg-yellow-50 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  Pending
                                </button>
                                <button
                                  onClick={() => handleGroupStatusChange(group.orders.map((o) => o.id), "OUT_FOR_DELIVERY", group.user.name)}
                                  disabled={updatingId !== null}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-50 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  🚚 Out for Delivery
                                </button>
                                <button
                                  onClick={() => handleGroupStatusChange(group.orders.map((o) => o.id), "DELIVERED", group.user.name)}
                                  disabled={updatingId !== null}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  ✓ Delivered
                                </button>
                                <button
                                  onClick={() => handleGroupStatusChange(group.orders.map((o) => o.id), "CANCELLED", group.user.name)}
                                  disabled={updatingId !== null}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  ✕ Cancelled
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Customer Orders */}
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
                                          setSelectedOrderIds((prev) => prev.filter((id) => id !== order.id));
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
                                          {order.thaliItems.map((ti: any) => (
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
                                              {order.addonItems.map((ai: any) => (
                                                <span
                                                  key={ai.id}
                                                  className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold"
                                                >
                                                  +{ai.addonProduct.name} x{ai.quantity} ({formatCurrency((ai.priceSnapshot ?? ai.addonProduct?.price ?? 0) * ai.quantity)})
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="space-y-1">
                                          <p className="font-bold text-gray-900 text-sm">{order.thali?.name ?? "—"}</p>
                                          {(order.selectedSabji.length > 0 || order.selectedAddons.length > 0) && (
                                            <div className="flex flex-wrap gap-1 items-center">
                                              {order.selectedSabji.map(({ product }: any) => (
                                                <span key={product.id} className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-1.5 py-0.5 rounded font-bold">
                                                  {product.name}
                                                </span>
                                              ))}
                                              {order.selectedAddons.map(({ product, price, quantity }: any) => (
                                                <span key={product.id} className="text-xs bg-purple-50 text-purple-100 px-1.5 py-0.5 rounded font-bold">
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
                                    </div>
                                  </div>

                                  {/* Right: Amount + Status pill buttons */}
                                  <div className="flex flex-col items-end gap-2 self-end md:self-center">
                                    <span className="font-bold text-gray-900 text-lg">
                                      {formatCurrency(order.totalAmount)}
                                    </span>

                                    {/* Status pill button row */}
                                    <div className="flex flex-wrap items-center gap-1 bg-gray-100 rounded-xl p-1 shadow-sm max-w-full">
                                      {([
                                        { status: "PENDING",          label: "Pending",            activeClass: "bg-amber-500 text-white shadow-sm font-bold" },
                                        { status: "OUT_FOR_DELIVERY", label: "🚚 Out for Delivery", activeClass: "bg-indigo-600 text-white shadow-sm font-bold" },
                                        { status: "DELIVERED",        label: "✓ Delivered",        activeClass: "bg-emerald-600 text-white shadow-sm font-bold" },
                                        { status: "CANCELLED",        label: "✕ Cancelled",        activeClass: "bg-red-600 text-white shadow-sm font-bold" },
                                      ] as const).map(({ status: s, label, activeClass }) => (
                                        <button
                                          key={s}
                                          onClick={() => order.status !== s && handleStatusChange(order.id, s)}
                                          disabled={updatingId !== null}
                                          title={`Mark as ${s.toLowerCase().replace(/_/g, " ")}`}
                                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer ${
                                            order.status === s
                                              ? activeClass
                                              : "text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm"
                                          }`}
                                        >
                                          {label}
                                        </button>
                                      ))}
                                    </div>

                                    {updatingId === order.id && (
                                      <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold">
                                        <RefreshCw size={10} className="animate-spin" /> Updating…
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* CUSTOMER GROUPED VIEW (DEFAULT) */
          groupedCustomerOrders.map((group) => (
            <div
              key={group.key}
              className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:border-orange-200 transition-all space-y-0"
            >
              {/* Customer Header Bar */}
              <div className="bg-gradient-to-r from-gray-50 to-orange-50/20 px-5 py-3.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
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

                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full border border-orange-200">
                    {group.orders.length} {group.orders.length === 1 ? "Order" : "Orders"}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    Total: <span className="text-orange-600">{formatCurrency(group.totalAmount)}</span>
                  </span>

                  {/* Customer Bulk Status Buttons */}
                  <div className="flex flex-wrap items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm max-w-full">
                    <span className="text-[10px] font-bold text-gray-400 uppercase px-1 hidden sm:inline">
                      Set All:
                    </span>
                    <button
                      onClick={() => handleGroupStatusChange(group.orders.map((o) => o.id), "PENDING", group.user.name)}
                      disabled={updatingId !== null}
                      title="Mark all orders for this customer as Pending"
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-yellow-700 hover:bg-yellow-50 active:bg-yellow-100 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Pending
                    </button>
                    <button
                      onClick={() => handleGroupStatusChange(group.orders.map((o) => o.id), "OUT_FOR_DELIVERY", group.user.name)}
                      disabled={updatingId !== null}
                      title="Mark all orders for this customer as Out for Delivery"
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 hover:bg-indigo-50 active:bg-indigo-100 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      🚚 Out for Delivery
                    </button>
                    <button
                      onClick={() => handleGroupStatusChange(group.orders.map((o) => o.id), "DELIVERED", group.user.name)}
                      disabled={updatingId !== null}
                      title="Mark all orders for this customer as Delivered"
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 hover:bg-emerald-50 active:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      ✓ Delivered
                    </button>
                    <button
                      onClick={() => handleGroupStatusChange(group.orders.map((o) => o.id), "CANCELLED", group.user.name)}
                      disabled={updatingId !== null}
                      title="Mark all orders for this customer as Cancelled"
                      className="px-2.5 py-1 rounded-lg text-xs font-bold text-red-700 hover:bg-red-50 active:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      ✕ Cancelled
                    </button>
                  </div>
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
                              {order.thaliItems.map((ti: any) => (
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
                                  {order.addonItems.map((ai: any) => (
                                    <span
                                      key={ai.id}
                                      className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-bold"
                                    >
                                      +{ai.addonProduct.name} x{ai.quantity} ({formatCurrency((ai.priceSnapshot ?? ai.addonProduct?.price ?? 0) * ai.quantity)})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-bold text-gray-900 text-sm">{order.thali?.name ?? "—"}</p>
                              {(order.selectedSabji.length > 0 || order.selectedAddons.length > 0) && (
                                <div className="flex flex-wrap gap-1 items-center">
                                  {order.selectedSabji.map(({ product }: any) => (
                                    <span key={product.id} className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-1.5 py-0.5 rounded font-bold">
                                      {product.name}
                                    </span>
                                  ))}
                                  {order.selectedAddons.map(({ product, price, quantity }: any) => (
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
                                            <div className="flex items-center gap-2">
                                              <Badge
                                                variant={c.authorType === "STAFF" ? "info" : "neutral"}
                                                label={c.authorType === "STAFF" ? "Staff" : "Customer"}
                                              />
                                              <span className="text-[10px] text-blue-500 font-normal">
                                                {new Date(c.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                              </span>
                                            </div>
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

                      {/* Right: Amount + Status pill buttons */}
                      <div className="flex flex-col items-end gap-2 self-end md:self-center">
                        <span className="font-bold text-gray-900 text-lg">
                          {formatCurrency(order.totalAmount)}
                        </span>

                        {/* Status pill button row */}
                        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 shadow-sm">
                          {([
                            { status: "PENDING",          label: "Pending",            activeClass: "bg-amber-500 text-white shadow-sm font-bold" },
                            { status: "OUT_FOR_DELIVERY", label: "🚚 Out for Delivery", activeClass: "bg-indigo-600 text-white shadow-sm font-bold" },
                            { status: "DELIVERED",        label: "✓ Delivered",        activeClass: "bg-emerald-600 text-white shadow-sm font-bold" },
                            { status: "CANCELLED",        label: "✕ Cancelled",        activeClass: "bg-red-600 text-white shadow-sm font-bold" },
                          ] as const).map(({ status: s, label, activeClass }) => (
                            <button
                              key={s}
                              onClick={() => order.status !== s && handleStatusChange(order.id, s)}
                              disabled={updatingId !== null}
                              title={`Mark as ${s.toLowerCase().replace(/_/g, " ")}`}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer ${
                                order.status === s
                                  ? activeClass
                                  : "text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {updatingId === order.id && (
                          <div className="flex items-center gap-1 text-[10px] text-orange-500 font-bold">
                            <RefreshCw size={10} className="animate-spin" /> Updating…
                          </div>
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
