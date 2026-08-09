/**
 * src/lib/whatsapp-digest.ts
 *
 * Pure client-side text formatter for WhatsApp-ready delivery digests.
 * Uses AggregateOrder from order-aggregation.ts so the grouping logic
 * is not duplicated.
 */

import type { AggregateOrder, CompanyGroup } from "./order-aggregation";
import { formatCurrency } from "./utils";

/**
 * Builds a WhatsApp-friendly text block for one company's orders.
 *
 * Example output:
 *   *VD's Hunger Hub — TechCorp Pvt Ltd*
 *   📍 A-402, Iscon Elegance, SG Highway
 *   Lunch · Fri, 9 Aug 2026
 *
 *   1. Rahul Shah (+91 98xxxxxx12)
 *      Full Thali × 1 — Bhindi Sabji
 *      + Extra Roti × 2
 *      ₹180
 *
 *   ──────────────
 *   Total orders: 2 | Total amount: ₹270
 */
export function buildCompanyDigestText(
  group: CompanyGroup,
  mealType: "LUNCH" | "DINNER",
  date: string,          // YYYY-MM-DD
  businessName = "VD's Hunger Hub"
): string {
  const lines: string[] = [];

  // Header
  lines.push(`*${businessName} — ${group.companyName}*`);
  if (group.companyAddress) {
    lines.push(`📍 ${group.companyAddress}`);
  }

  // Date + meal
  const dateLabel = new Date(date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  lines.push(`${mealType === "LUNCH" ? "Lunch" : "Dinner"} · ${dateLabel}`);
  lines.push("");

  // Individual orders
  group.orders.forEach((order, idx) => {
    const user = order.user;
    lines.push(`${idx + 1}. ${user.name} (+91 ${user.number})`);

    if (order.thaliItems && order.thaliItems.length > 0) {
      for (const ti of order.thaliItems) {
        const sabjiPart = ti.sabjiProduct
          ? `— ${ti.sabjiProduct.name}`
          : "— No sabji";
        lines.push(`   ${ti.thali.name} × ${ti.quantity} ${sabjiPart}`);
      }
    }

    if (order.addonItems && order.addonItems.length > 0) {
      for (const ai of order.addonItems) {
        lines.push(`   + ${ai.addonProduct.name} × ${ai.quantity}`);
      }
    }

    if (order.note?.trim()) {
      lines.push(`   📝 "${order.note.trim()}"`);
    }

    lines.push(`   ${formatCurrency(order.totalAmount)}`);
    lines.push("");
  });

  // Footer
  lines.push("──────────────");
  lines.push(
    `Total orders: ${group.orders.length} | Total amount: ${formatCurrency(group.totalAmount)}`
  );

  return lines.join("\n");
}

/**
 * Builds digest text for ALL companies, separated by double newlines.
 * Useful for pasting into a WhatsApp broadcast list.
 */
export function buildAllCompaniesDigestText(
  groups: CompanyGroup[],
  mealType: "LUNCH" | "DINNER",
  date: string,
  businessName = "VD's Hunger Hub"
): string {
  return groups
    .map((g) => buildCompanyDigestText(g, mealType, date, businessName))
    .join("\n\n\n");
}
