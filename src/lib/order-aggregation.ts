/**
 * src/lib/order-aggregation.ts
 *
 * Shared helpers for aggregating order data into summary matrices and
 * company-grouped sets. Used by:
 *   - Admin Orders page → _OrderSummaryMatrix.tsx
 *   - Admin Orders page → _WhatsAppDigestPanel.tsx
 *   - PDF export route  → /api/admin/orders/export-pdf/route.ts
 */

// ── Shared order shape (minimal, matches what /api/admin/orders returns) ──────

export interface AggregateOrderThaliItem {
  id: string;
  quantity: number;
  thali: { id: string; name: string; nameGu?: string | null; price: number };
  sabjiProduct?: { id: string; name: string; nameGu?: string | null } | null;
}

export interface AggregateOrderAddonItem {
  id: string;
  quantity: number;
  priceSnapshot: number;
  addonProduct: { id: string; name: string };
}

export interface AggregateOrder {
  id: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  note?: string | null;
  user: {
    id: string;
    name: string;
    number: string;
    company: { id: string; name: string } | null;
  };
  thaliItems?: AggregateOrderThaliItem[];
  addonItems?: AggregateOrderAddonItem[];
}

// ── Summary Matrix ────────────────────────────────────────────────────────────

export interface ThaliCount {
  thaliId: string;
  name: string;
  qty: number;
}

export interface SabjiCount {
  thaliName: string;
  sabjiName: string;
  qty: number;
}

export interface AddonCount {
  productId: string;
  name: string;
  qty: number;
}

export interface SummaryMatrix {
  thaliCounts: ThaliCount[];
  sabjiCounts: SabjiCount[];
  addonCounts: AddonCount[];
  noSabjiCount: number; // thali lines with null sabjiProduct
}

/**
 * Builds a SummaryMatrix from an array of orders.
 * Groups sabjis by (thaliId, sabjiProductId) so the same sabji under
 * different thali types shows as separate rows — exactly what a kitchen needs.
 */
export function buildSummaryMatrix(orders: AggregateOrder[]): SummaryMatrix {
  const thaliMap = new Map<string, ThaliCount>();
  const sabjiKey = (thaliId: string, sabjiId: string) => `${thaliId}::${sabjiId}`;
  const sabjiMap = new Map<string, SabjiCount>();
  const addonMap = new Map<string, AddonCount>();
  let noSabjiCount = 0;

  for (const order of orders) {
    if (!order.thaliItems || order.thaliItems.length === 0) continue;

    for (const ti of order.thaliItems) {
      const qty = ti.quantity ?? 1;

      // Thali counts
      const existing = thaliMap.get(ti.thali.id);
      if (existing) {
        existing.qty += qty;
      } else {
        thaliMap.set(ti.thali.id, {
          thaliId: ti.thali.id,
          name: ti.thali.name,
          qty,
        });
      }

      // Sabji counts
      if (!ti.sabjiProduct) {
        noSabjiCount += qty;
      } else {
        const key = sabjiKey(ti.thali.id, ti.sabjiProduct.id);
        const existingSabji = sabjiMap.get(key);
        if (existingSabji) {
          existingSabji.qty += qty;
        } else {
          sabjiMap.set(key, {
            thaliName: ti.thali.name,
            sabjiName: ti.sabjiProduct.name,
            qty,
          });
        }
      }
    }

    // Addon counts
    if (order.addonItems) {
      for (const ai of order.addonItems) {
        const qty = ai.quantity ?? 1;
        const existing = addonMap.get(ai.addonProduct.id);
        if (existing) {
          existing.qty += qty;
        } else {
          addonMap.set(ai.addonProduct.id, {
            productId: ai.addonProduct.id,
            name: ai.addonProduct.name,
            qty,
          });
        }
      }
    }
  }

  return {
    thaliCounts: Array.from(thaliMap.values()).sort((a, b) => b.qty - a.qty),
    sabjiCounts: Array.from(sabjiMap.values()).sort((a, b) => b.qty - a.qty),
    addonCounts: Array.from(addonMap.values()).sort((a, b) => b.qty - a.qty),
    noSabjiCount,
  };
}

// ── Company Grouping ──────────────────────────────────────────────────────────

export interface CompanyGroup {
  companyId: string;
  companyName: string;
  companyAddress?: string | null;
  orders: AggregateOrder[];
  totalAmount: number;
}

/**
 * Groups orders by the customer's company.
 * Orders with no company go into a "__no_company__" group.
 */
export function groupOrdersByCompany(orders: AggregateOrder[]): CompanyGroup[] {
  const map = new Map<string, CompanyGroup>();

  for (const order of orders) {
    const company = order.user.company;
    const key = company?.id ?? "__no_company__";
    const name = company?.name ?? "No Company";

    if (!map.has(key)) {
      map.set(key, {
        companyId: key,
        companyName: name,
        orders: [],
        totalAmount: 0,
      });
    }

    const group = map.get(key)!;
    group.orders.push(order);
    group.totalAmount += order.totalAmount;
  }

  return Array.from(map.values()).sort((a, b) =>
    a.companyName.localeCompare(b.companyName)
  );
}
