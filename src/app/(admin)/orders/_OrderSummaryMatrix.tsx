"use client";

/**
 * _OrderSummaryMatrix.tsx
 *
 * Shows a compact summary of all orders in the current view:
 *   - Thali totals (sorted by qty desc)
 *   - Sabji breakdown per thali
 *   - Add-on totals
 *
 * All data is computed from the orders array passed as props — no API calls.
 */

import { UtensilsCrossed, PackagePlus, Soup } from "lucide-react";
import { buildSummaryMatrix } from "@/lib/order-aggregation";
import type { AggregateOrder } from "@/lib/order-aggregation";

interface Props {
  orders: AggregateOrder[];
  mealType: "LUNCH" | "DINNER";
}

export default function OrderSummaryMatrix({ orders, mealType }: Props) {
  const matrix = buildSummaryMatrix(orders);

  if (orders.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex items-center gap-2">
        <UtensilsCrossed size={16} className={mealType === "LUNCH" ? "text-amber-500" : "text-indigo-500"} />
        <h3 className="font-extrabold text-gray-900 text-sm">
          {mealType === "LUNCH" ? "Lunch" : "Dinner"} Summary Matrix
        </h3>
        <span className="ml-auto text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {orders.length} orders
        </span>
      </div>

      {/* Thali Counts */}
      {matrix.thaliCounts.length > 0 && (
        <div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">
            Thali Counts
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {matrix.thaliCounts.map((t) => (
              <div
                key={t.thaliId}
                className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-3 py-2"
              >
                <span className="text-xs font-semibold text-gray-700 truncate">{t.name}</span>
                <span className="ml-2 text-sm font-extrabold text-orange-600 flex-shrink-0">
                  ×{t.qty}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sabji Breakdown */}
      {matrix.sabjiCounts.length > 0 && (
        <div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Soup size={11} /> Sabji Breakdown
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {matrix.sabjiCounts.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-xl px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-700 truncate">{s.sabjiName}</p>
                  <p className="text-[10px] text-gray-400 truncate">with {s.thaliName}</p>
                </div>
                <span className="ml-2 text-sm font-extrabold text-amber-600 flex-shrink-0">
                  ×{s.qty}
                </span>
              </div>
            ))}
            {matrix.noSabjiCount > 0 && (
              <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                <span className="text-xs font-semibold text-gray-500">No sabji (plain)</span>
                <span className="ml-2 text-sm font-extrabold text-gray-400 flex-shrink-0">
                  ×{matrix.noSabjiCount}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add-on Counts */}
      {matrix.addonCounts.length > 0 && (
        <div>
          <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <PackagePlus size={11} /> Add-ons
          </p>
          <div className="flex flex-wrap gap-2">
            {matrix.addonCounts.map((a) => (
              <div
                key={a.productId}
                className="flex items-center gap-1.5 bg-purple-50 border border-purple-100 rounded-xl px-3 py-2"
              >
                <span className="text-xs font-semibold text-gray-700">{a.name}</span>
                <span className="text-sm font-extrabold text-purple-600">×{a.qty}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
