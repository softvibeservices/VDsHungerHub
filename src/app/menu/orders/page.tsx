"use client";

import { useEffect, useState } from "react";
import { verifyUserToken } from "@/lib/user-auth";
import { formatCurrency } from "@/lib/utils";
import { UtensilsCrossed, Clock, CheckCircle2, Package, XCircle, AlertCircle } from "lucide-react";

const LOCAL_JWT_KEY = "vdh_user_jwt";

type OrderStatus = "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

interface OrderListItem {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  thali: { name: string; nameGu: string | null; price: number };
  menu: { date: string; mealType: "LUNCH" | "DINNER" };
  selectedSabji: { product: { name: string; nameGu: string | null } }[];
  selectedAddons: { product: { name: string }; price: number }[];
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending",
    color: "bg-yellow-100 text-yellow-700",
    icon: <Clock size={12} />,
  },
  CONFIRMED: {
    label: "Confirmed",
    color: "bg-blue-100 text-blue-700",
    icon: <CheckCircle2 size={12} />,
  },
  DELIVERED: {
    label: "Delivered",
    color: "bg-green-100 text-green-700",
    icon: <Package size={12} />,
  },
  CANCELLED: {
    label: "Cancelled",
    color: "bg-red-100 text-red-700",
    icon: <XCircle size={12} />,
  },
};

export default function UserOrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    async function loadOrders() {
      const jwt = localStorage.getItem(LOCAL_JWT_KEY);
      if (!jwt) {
        setError("Please place an order first to view your history.");
        setLoading(false);
        return;
      }

      const payload = verifyUserToken(jwt);
      if (payload) setUserName(payload.name);

      const res = await fetch("/api/orders?limit=50", {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!res.ok) {
        setError("Could not load order history. Please try again.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setOrders(data.orders);
      setLoading(false);
    }

    loadOrders();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 md:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
            {userName && (
              <p className="text-sm text-gray-500 mt-0.5">
                Hello, <strong>{userName}</strong>
              </p>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="text-red-400" size={24} />
            </div>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400 shadow-sm">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No orders yet</p>
            <p className="text-xs mt-1">Your placed orders will appear here</p>
          </div>
        )}

        <div className="space-y-3">
          {orders.map((order) => {
            const statusConf = STATUS_CONFIG[order.status];
            const menuDate = new Date(order.menu.date).toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "numeric",
              month: "short",
              year: "numeric",
            });
            const orderTime = new Date(order.createdAt).toLocaleTimeString(
              "en-IN",
              { hour: "2-digit", minute: "2-digit" }
            );

            return (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3 shadow-sm"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">
                      {order.thali.name}
                    </p>
                    {order.thali.nameGu && (
                      <p className="text-xs text-gray-400">{order.thali.nameGu}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-extrabold text-orange-600">
                      {formatCurrency(order.totalAmount)}
                    </p>
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 ${statusConf.color}`}
                    >
                      {statusConf.icon}
                      {statusConf.label}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                  <span>📅 {menuDate}</span>
                  <span>
                    {order.menu.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}
                  </span>
                  <span>🕒 Ordered at {orderTime}</span>
                </div>

                {/* Sabji */}
                {order.selectedSabji.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {order.selectedSabji.map(({ product }) => (
                      <span
                        key={product.name}
                        className="text-[11px] bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full"
                      >
                        {product.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* Add-ons */}
                {order.selectedAddons.length > 0 && (
                  <div className="border-t border-gray-100 pt-2 space-y-1">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                      Add-ons
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {order.selectedAddons.map(({ product, price }) => (
                        <span
                          key={product.name}
                          className="text-[11px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-0.5 rounded-full"
                        >
                          {product.name} +{formatCurrency(price)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
