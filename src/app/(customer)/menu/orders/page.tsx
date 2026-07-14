"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { UtensilsCrossed, Clock, CheckCircle2, Package, XCircle, AlertCircle } from "lucide-react";

type OrderStatus = "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

interface OrderListItem {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  thali: { name: string; nameGu: string | null; price: number };
  menu: { date: string; mealType: "LUNCH" | "DINNER" };
  thaliItems: {
    id: string;
    thali: { id: string; name: string };
    sabjiProduct: { id: string; name: string };
    quantity: number;
  }[];
  addonItems: {
    id: string;
    addonProduct: { id: string; name: string; price: number };
    quantity: number;
    priceSnapshot: number;
  }[];
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

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await fetch("/api/customer/orders?limit=50", {
          credentials: "include", // cookie-based, no Authorization header needed
        });

        if (res.status === 401) {
          setError("Please log in to view your order history.");
          setLoading(false);
          return;
        }

        if (!res.ok) {
          setError("Could not load order history. Please try again.");
          setLoading(false);
          return;
        }

        const data = await res.json();
        setOrders(data.orders ?? []);
      } catch (err) {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    loadOrders();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-10">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center space-y-3 shadow-sm max-w-md mx-auto">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="text-red-400" size={24} />
            </div>
            <p className="text-sm text-gray-600 font-medium">{error}</p>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400 shadow-sm max-w-md mx-auto">
            <Package size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium text-gray-800">No orders yet</p>
            <p className="text-xs mt-1">Your placed orders will appear here</p>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }
              );

              return (
                <div
                  key={order.id}
                  className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-gray-900 text-sm">
                          {order.thali?.name ?? "Daily Thali Order"}
                        </p>
                        {order.thali?.nameGu && (
                          <p className="text-xs text-gray-400 mt-0.5">{order.thali.nameGu}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-extrabold text-orange-600 text-base">
                          {formatCurrency(order.totalAmount)}
                        </p>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full mt-1.5 ${statusConf.color}`}
                        >
                          {statusConf.icon}
                          {statusConf.label}
                        </span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="text-xs text-gray-400 flex flex-wrap gap-x-4 gap-y-1">
                      <span>📅 {menuDate}</span>
                      <span>
                        {order.menu.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}
                      </span>
                      <span>🕒 {orderTime}</span>
                    </div>

                    {/* Thali Items (Thali + Sabji choice) */}
                    {order.thaliItems && order.thaliItems.length > 0 && (
                      <div className="space-y-2 border-t border-gray-50 pt-3">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                          Meals Chosen
                        </p>
                        <div className="space-y-1.5">
                          {order.thaliItems.map((item) => (
                            <div key={item.id} className="flex justify-between items-center text-xs">
                              <span className="font-medium text-gray-700">
                                {item.quantity}× {item.thali.name}
                              </span>
                              <span className="text-[11px] bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-xl font-medium">
                                Sabji: {item.sabjiProduct.name}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add-ons */}
                    {order.addonItems && order.addonItems.length > 0 && (
                      <div className="border-t border-gray-50 pt-3 space-y-2">
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                          Add-ons
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {order.addonItems.map((item) => (
                            <span
                              key={item.id}
                              className="text-[11px] bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-0.5 rounded-full font-medium"
                            >
                              {item.quantity}× {item.addonProduct.name} (+{formatCurrency(item.priceSnapshot * item.quantity)})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
