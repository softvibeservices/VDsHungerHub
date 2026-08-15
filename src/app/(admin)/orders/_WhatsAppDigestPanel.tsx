// src\app\(admin)\orders\_WhatsAppDigestPanel.tsx

"use client";

/**
 * _WhatsAppDigestPanel.tsx
 *
 * Renders per-company "Copy for WhatsApp" buttons.
 * Clicking copies a pre-formatted text block with all orders for that
 * company (names, phones, thali, sabji, addons, note, total).
 *
 * Uses groupOrdersByCompany() and buildCompanyDigestText() from shared helpers.
 */

import { useState } from "react";
import { Copy, Check, MessageCircle } from "lucide-react";
import { groupOrdersByCompany } from "@/lib/order-aggregation";
import { buildCompanyDigestText } from "@/lib/whatsapp-digest";
import type { AggregateOrder } from "@/lib/order-aggregation";

interface Props {
  orders: AggregateOrder[];
  mealType: "LUNCH" | "DINNER";
  date: string; // YYYY-MM-DD
}

export default function WhatsAppDigestPanel({ orders, mealType, date }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (orders.length === 0) return null;

  const groups = groupOrdersByCompany(orders);

  const copyGroup = (companyId: string, companyName: string) => {
    const group = groups.find((g) => g.companyId === companyId);
    if (!group) return;
    const text = buildCompanyDigestText(group, mealType, date);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(companyId);
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const copyAll = () => {
    const texts = groups
      .map((g) => buildCompanyDigestText(g, mealType, date))
      .join("\n\n\n");
    navigator.clipboard.writeText(texts).then(() => {
      setCopiedId("__all__");
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-green-600" />
          <h3 className="font-extrabold text-gray-900 text-sm">WhatsApp Digest</h3>
        </div>
        <button
          type="button"
          onClick={copyAll}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            copiedId === "__all__"
              ? "bg-green-500 text-white border-green-500"
              : "bg-white border-green-300 text-green-700 hover:bg-green-50"
          }`}
        >
          {copiedId === "__all__" ? (
            <><Check size={12} /> Copied All!</>
          ) : (
            <><Copy size={12} /> Copy All Companies</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {groups.map((group) => (
          <div
            key={group.companyId}
            className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50/50 hover:bg-green-50/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-gray-800 truncate">{group.companyName}</p>
                {group.companyAddress && (
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{group.companyAddress}</p>
                )}
              </div>
              <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full flex-shrink-0">
                {group.orders.length} orders
              </span>
            </div>
            <button
              type="button"
              onClick={() => copyGroup(group.companyId, group.companyName)}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                copiedId === group.companyId
                  ? "bg-green-500 text-white border-green-500"
                  : "bg-white border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300"
              }`}
            >
              {copiedId === group.companyId ? (
                <><Check size={11} /> Copied!</>
              ) : (
                <><Copy size={11} /> Copy for WhatsApp</>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
