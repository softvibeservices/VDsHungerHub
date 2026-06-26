"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  RefreshCw,
  Clock,
  CheckCircle2,
  Package,
  XCircle,
  ShoppingBag,
} from "lucide-react";
import toast from "react-hot-toast";
import { getTodayIST, formatCurrency } from "@/lib/utils";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

type OrderStatus = "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

interface AdminOrder {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  user: {
    id: string;
    name: string;
    number: string;
    company: { id: string; name: string };
  };
  thali: { id: string; name: string; nameGu: string | null; price: number };
  menu: {
    id: string;
    date: string;
    mealType: "LUNCH" | "DINNER";
    publicSlug: string | null;
  };
  selectedSabji: { product: { id: string; name: string } }[];
  selectedAddons: { product: { id: string; name: string }; price: number }[];
}

interface OrdersResponse {
  date: string;
  totalOrders: number;
  lunch: { count: number; orders: AdminOrder[] };
  dinner: { count: number; orders: AdminOrder[] };
  fetchedAt: string;
}

const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  PENDING: <Clock size={14} className="text-yellow-500" />,
  CONFIRMED: <CheckCircle2 size={14} className="text-blue-500" />,
  DELIVERED: <Package size={14} className="text-green-500" />,
  CANCELLED: <XCircle size={14} className="text-red-500" />,
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
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

  const activeOrders =
    activeTab === "LUNCH"
      ? data?.lunch.orders ?? []
      : data?.dinner.orders ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-orange-500" size={20} />
            <h2 className="text-xl font-bold text-gray-900">Orders</h2>
          </div>
          {lastFetchedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated:{" "}
              {new Date(lastFetchedAt).toLocaleTimeString("en-IN")}
              {" · "}Auto-refreshes every 5 min
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-orange-500/30 outline-none"
          />
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Orders", value: data.totalOrders, cls: "text-orange-600" },
            { label: "Lunch Orders", value: data.lunch.count, cls: "text-amber-600" },
            { label: "Dinner Orders", value: data.dinner.count, cls: "text-indigo-600" },
            {
              label: "Pending",
              value: [...data.lunch.orders, ...data.dinner.orders].filter(
                (o) => o.status === "PENDING"
              ).length,
              cls: "text-yellow-600",
            },
          ].map(({ label, value, cls }) => (
            <div
              key={label}
              className="bg-white border border-gray-200 rounded-xl p-4 text-center"
            >
              <p className={`text-2xl font-extrabold ${cls}`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Meal type tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["LUNCH", "DINNER"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}
            {data && (
              <span className="ml-1.5 text-xs text-gray-400">
                ({tab === "LUNCH" ? data.lunch.count : data.dinner.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && activeOrders.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
          <Package size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            No {activeTab.toLowerCase()} orders for {selectedDate}
          </p>
        </div>
      )}

      <div className="space-y-3">
        {activeOrders.map((order) => (
          <div
            key={order.id}
            className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4"
          >
            {/* Order header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900">{order.user.name}</p>
                <p className="text-sm text-gray-500">{order.user.company.name}</p>
                <p className="text-xs text-gray-400">+91 {order.user.number}</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-orange-600">
                  {formatCurrency(order.totalAmount)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {/* Thali + Sabji + Add-ons */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="font-semibold text-gray-800 text-sm">
                {order.thali.name}
                {order.thali.nameGu && (
                  <span className="text-gray-400 font-normal text-xs ml-1">
                    ({order.thali.nameGu})
                  </span>
                )}
              </p>
              {order.selectedSabji.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {order.selectedSabji.map(({ product }) => (
                    <span
                      key={product.id}
                      className="text-[11px] bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full"
                    >
                      {product.name}
                    </span>
                  ))}
                </div>
              )}
              {order.selectedAddons.length > 0 && (
                <div className="border-t border-gray-200 pt-2 flex flex-wrap gap-1.5">
                  {order.selectedAddons.map(({ product, price }) => (
                    <span
                      key={product.id}
                      className="text-[11px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full"
                    >
                      +{product.name} ({formatCurrency(price)})
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Status + Actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                {STATUS_ICONS[order.status]}
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}
                >
                  {order.status}
                </span>
              </div>

              <select
                value={order.status}
                disabled={updatingId === order.id}
                onChange={(e) =>
                  handleStatusChange(order.id, e.target.value as OrderStatus)
                }
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:ring-2 focus:ring-orange-500/30 outline-none disabled:opacity-40"
              >
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
