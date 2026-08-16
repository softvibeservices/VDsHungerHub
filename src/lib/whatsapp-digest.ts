import type { CompanyGroup } from "./order-aggregation";
import { formatCurrency } from "./utils";

/**
 * Builds a high-quality WhatsApp-friendly text block for one company's orders.
 *
 * Output Format:
 *   🍱 *ViTa Cuisine — Delivery Digest*
 *   🏢 *Company:* TechCorp Pvt Ltd
 *   📍 *Office Address:* A-402, Iscon Elegance, SG Highway
 *   🌅 *LUNCH* · Sun, 16 Aug 2026
 *
 *   1. *Rahul Shah* (+91 9898012345)
 *      📍 *Location:* [HOME] 102 Shivalik Heights, CG Road
 *      • 1× Gujarati Thali (Sabji: Sev Tameta)
 *      + 2× Extra Roti (₹20)
 *      💬 *Note:* "Please keep it extra spicy"
 *      💰 *Amount:* ₹180
 *
 *   ──────────────────────────────
 *   📊 *Summary:* 3 Orders | Total Amount: ₹540
 *   🚚 ViTa Cuisine — Fast & Fresh Delivery
 */
export function buildCompanyDigestText(
  group: CompanyGroup,
  mealType: "LUNCH" | "DINNER",
  date: string,          // YYYY-MM-DD
  businessName = "ViTa Cuisine"
): string {
  const lines: string[] = [];

  // Header
  lines.push(`🍱 *${businessName} — Delivery Digest*`);
  lines.push(`🏢 *Company:* ${group.companyName}`);
  if (group.companyAddress) {
    lines.push(`📍 *Office Address:* ${group.companyAddress}`);
  }

  // Date + Meal Header
  const dateLabel = new Date(date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  lines.push(`${mealType === "LUNCH" ? "🌅 *LUNCH DIGEST*" : "🌙 *DINNER DIGEST*"} · ${dateLabel}`);
  lines.push("");

  // Individual orders
  group.orders.forEach((order, idx) => {
    const user = order.user;
    lines.push(`${idx + 1}. *${user.name}* (+91 ${user.number})`);

    // Delivery Address
    if (order.address) {
      const typeStr = order.address.type ? `[${order.address.type.toUpperCase()}] ` : "";
      const locStr = [order.address.line1, order.address.line2, order.address.city].filter(Boolean).join(", ");
      lines.push(`   📍 *Delivery:* ${typeStr}${locStr}`);
    } else {
      lines.push(`   🏢 *Delivery:* [WORKPLACE] Primary Office Address`);
    }

    // Thali Items & Sabji
    if (order.thaliItems && order.thaliItems.length > 0) {
      for (const ti of order.thaliItems) {
        const sabjiPart = ti.sabjiProduct
          ? `(Sabji: ${ti.sabjiProduct.name})`
          : "(No Sabji)";
        lines.push(`   • ${ti.quantity}× ${ti.thali.name} ${sabjiPart}`);
      }
    }

    // Addon Items
    if (order.addonItems && order.addonItems.length > 0) {
      for (const ai of order.addonItems) {
        lines.push(`   + ${ai.quantity}× ${ai.addonProduct.name}`);
      }
    }

    // Customer Note / Instructions
    if (order.note?.trim()) {
      lines.push(`   💬 *Note:* "${order.note.trim()}"`);
    }

    // Total Amount
    lines.push(`   💰 *Amount:* ${formatCurrency(order.totalAmount)}`);
    lines.push("");
  });

  // Footer Summary
  lines.push("──────────────────────────────");
  lines.push(
    `📊 *Summary:* ${group.orders.length} Order${group.orders.length > 1 ? "s" : ""} | Total: *${formatCurrency(group.totalAmount)}*`
  );
  lines.push("🚚 _ViTa Cuisine — Fresh & Delicious Delivery_");

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
  businessName = "ViTa Cuisine"
): string {
  return groups
    .map((g) => buildCompanyDigestText(g, mealType, date, businessName))
    .join("\n\n\n");
}
