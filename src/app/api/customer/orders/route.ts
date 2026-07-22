import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyCustomerAccessToken,
  getOrderLimit,
  DEFAULT_MAX_THALI,
  DEFAULT_MAX_ADDON,
  CUSTOMER_ACCESS_COOKIE,
  checkUserAndDeviceStatus,
} from "@/lib/customer-auth";

/**
 * POST /api/customer/orders
 *
 * Multi-thali order creation. Requires a verified customer session.
 * Server-side enforces MAX_THALI_PER_ORDER and MAX_ADDON_PER_ORDER limits.
 *
 * Fixes applied:
 *   #3: sabji validation is conditional on thali.sabjiCount (sabji-less thalis are allowed)
 *   #4: add-on limit is per-product (not a shared combined total)
 *
 * Body:
 *   menuId      string
 *   thaliItems  Array<{ thaliId: string; sabjiProductId: string | null; quantity: number }>
 *   addonItems? Array<{ addonProductId: string; quantity: number }>
 *   note?       string
 *   addressId?  string
 */
export async function POST(req: NextRequest) {
  try {
    // ── Auth: require verified customer session cookie ─────────────────────────
    const token = req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = verifyCustomerAccessToken(token);
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = claims.sub;

    // Check user and device status
    const statusCheck = await checkUserAndDeviceStatus(userId, claims.fph);
    if (!statusCheck.allowed) {
      return NextResponse.json(
        { error: statusCheck.message, code: statusCheck.code },
        { status: 403 }
      );
    }

    // ── Fetch verified, active user ───────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true, isVerified: true },
    });

    if (!user || !user.isActive || !user.isVerified) {
      return NextResponse.json(
        { error: "Account not active or not verified" },
        { status: 403 }
      );
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json();
    const { menuId, thaliItems = [], addonItems = [], note, addressId } = body;

    if (!menuId) {
      return NextResponse.json({ error: "menuId is required" }, { status: 400 });
    }

    if (!Array.isArray(thaliItems) || thaliItems.length === 0) {
      return NextResponse.json(
        { error: "At least one thali item is required" },
        { status: 400 }
      );
    }

    // ── Load configurable limits ──────────────────────────────────────────────
    const [maxThali, maxAddonPerItem] = await Promise.all([
      getOrderLimit("MAX_THALI_PER_ORDER", DEFAULT_MAX_THALI),
      getOrderLimit("MAX_ADDON_PER_ORDER", DEFAULT_MAX_ADDON), // now means: max per ITEM, not combined
    ]);

    // ── Validate thali item totals (server-side, never trust client count) ─────
    const totalThaliQty: number = thaliItems.reduce(
      (sum: number, t: any) => sum + (Number(t.quantity) || 1),
      0
    );

    if (totalThaliQty > maxThali) {
      return NextResponse.json(
        { error: `Maximum ${maxThali} thali per order. You submitted ${totalThaliQty}.` },
        { status: 400 }
      );
    }

    // ── Validate menu ─────────────────────────────────────────────────────────
    const menu = await prisma.dailyMenu.findUnique({
      where: { id: menuId },
      include: {
        // FIX #3: include sabjiCount so we can conditionally require it
        thalis: { include: { thali: { select: { id: true, price: true, categoryId: true, isActive: true, sabjiCount: true } } } },
        sabjiOptions: true,
      },
    });

    if (!menu) {
      return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    }

    // Fetch global meal settings
    const settings = await prisma.mealSettings.findUnique({
      where: { mealType: menu.mealType },
    });

    if (settings && !settings.isOrderingOpen) {
      return NextResponse.json(
        { error: "Ordering is temporarily closed by the administrator." },
        { status: 403 }
      );
    }

    if (settings?.cutoffTime) {
      const [hours, minutes] = settings.cutoffTime.split(":").map(Number);
      const combinedCutoff = new Date(menu.date);
      combinedCutoff.setHours(hours, minutes, 0, 0);
      if (new Date() > combinedCutoff) {
        return NextResponse.json(
          { error: "Ordering cutoff time has passed." },
          { status: 400 }
        );
      }
    }

    // ── Validate delivery address ─────────────────────────────────────────────
    let verifiedAddressId: string | null = null;
    if (addressId) {
      const address = await prisma.address.findFirst({
        where: { id: addressId, userId },
        select: { id: true },
      });
      if (!address) {
        return NextResponse.json({ error: "Selected address not found" }, { status: 400 });
      }
      verifiedAddressId = address.id;
    }

    // ── Build lookup maps for thali validation ────────────────────────────────
    const thaliPriceMap: Record<string, number> = {};
    const thaliCategoryMap: Record<string, string | null> = {};
    const thaliSabjiCountMap: Record<string, number> = {};
    const validThaliIds = new Set<string>();

    for (const mt of menu.thalis) {
      if (!mt.thali.isActive) continue;
      validThaliIds.add(mt.thaliId);
      thaliPriceMap[mt.thaliId] = mt.thali.price;
      thaliCategoryMap[mt.thaliId] = mt.thali.categoryId;
      thaliSabjiCountMap[mt.thaliId] = mt.thali.sabjiCount;
    }

    // ── Validate each thali item ──────────────────────────────────────────────
    for (const item of thaliItems as any[]) {
      if (!item.thaliId || !validThaliIds.has(item.thaliId)) {
        return NextResponse.json(
          { error: `Thali ${item.thaliId} is not available in this menu` },
          { status: 400 }
        );
      }

      // FIX #3: only require sabji if the thali actually has sabjiCount > 0
      const requiresSabji = (thaliSabjiCountMap[item.thaliId] ?? 1) > 0;

      if (requiresSabji && !item.sabjiProductId) {
        return NextResponse.json(
          { error: "This thali requires a sabji selection" },
          { status: 400 }
        );
      }

      // If a sabji was provided, validate it belongs to this thali's category
      if (item.sabjiProductId) {
        const categoryId = thaliCategoryMap[item.thaliId];
        const validSabji = menu.sabjiOptions.filter(
          (so: { categoryId: string; productId: string }) => so.categoryId === categoryId
        );
        const validSabjiIds = new Set(validSabji.map((s: { productId: string }) => s.productId));

        if (!validSabjiIds.has(item.sabjiProductId)) {
          return NextResponse.json(
            { error: `Sabji ${item.sabjiProductId} is not valid for thali ${item.thaliId}` },
            { status: 400 }
          );
        }
      }
    }

    // ── Validate and price add-ons ────────────────────────────────────────────
    let addonPriceMap: Record<string, number> = {};
    let addonNameMap: Record<string, string> = {};

    if (Array.isArray(addonItems) && addonItems.length > 0) {
      const addonProductIds = (addonItems as any[]).map((a) => a.addonProductId);
      const addonProducts = await prisma.product.findMany({
        where: {
          id: { in: addonProductIds },
          isActive: true,
          isAddOnAvailable: true,
        },
        select: { id: true, price: true, name: true },
      });

      addonPriceMap = Object.fromEntries(addonProducts.map((p: { id: string; price: number; name: string }) => [p.id, p.price]));
      addonNameMap = Object.fromEntries(addonProducts.map((p: { id: string; price: number; name: string }) => [p.id, p.name]));

      for (const item of addonItems as any[]) {
        if (!addonPriceMap[item.addonProductId]) {
          return NextResponse.json(
            { error: `Add-on ${item.addonProductId} is not available` },
            { status: 400 }
          );
        }
      }
    }

    // ── FIX #4: Validate per-product add-on limits ────────────────────────────
    // Group THIS submission's requested quantity by product
    const requestedByProduct = new Map<string, number>();
    for (const a of addonItems as any[]) {
      requestedByProduct.set(
        a.addonProductId,
        (requestedByProduct.get(a.addonProductId) ?? 0) + (Number(a.quantity) || 1)
      );
    }

    // Check against per-item limit immediately (before checking existing orders)
    for (const [productId, qty] of requestedByProduct) {
      if (qty > maxAddonPerItem) {
        const productName = addonNameMap[productId] ?? "This item";
        return NextResponse.json(
          { error: `Maximum ${maxAddonPerItem} × ${productName} allowed per order.` },
          { status: 400 }
        );
      }
    }

    // ── Check cumulative limits for this meal cycle (non-cancelled orders) ──
    const existingOrders = await prisma.order.findMany({
      where: {
        userId,
        menuId,
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        thaliItems: { select: { quantity: true } },
        // FIX #4: need addonProductId to do per-product cumulative check
        addonItems: { select: { addonProductId: true, quantity: true } },
      },
    });

    const existingThaliCount = existingOrders.reduce((acc: number, o: any) => {
      if (o.thaliItems && o.thaliItems.length > 0) {
        return acc + o.thaliItems.reduce((s: number, item: { quantity: number }) => s + (item.quantity || 1), 0);
      }
      return acc + 1; // fallback for legacy single-thali orders
    }, 0);

    if (existingThaliCount + totalThaliQty > maxThali) {
      const remainingAllowed = Math.max(0, maxThali - existingThaliCount);
      const errorMsg =
        existingThaliCount > 0
          ? `Maximum ${maxThali} Thalis allowed per meal cycle. You have already ordered ${existingThaliCount} Thali(s). You can order at most ${remainingAllowed} more.`
          : `Maximum ${maxThali} Thalis allowed per order. You submitted ${totalThaliQty}.`;
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // FIX #4: per-product cumulative check against existing orders
    if (requestedByProduct.size > 0) {
      // Build map of existing ordered qty per product for this meal cycle
      const existingByProduct = new Map<string, number>();
      for (const o of existingOrders) {
        for (const item of o.addonItems ?? []) {
          existingByProduct.set(
            item.addonProductId,
            (existingByProduct.get(item.addonProductId) ?? 0) + (item.quantity || 1)
          );
        }
      }

      for (const [productId, requestedQty] of requestedByProduct) {
        const alreadyOrdered = existingByProduct.get(productId) ?? 0;
        if (alreadyOrdered + requestedQty > maxAddonPerItem) {
          const remaining = Math.max(0, maxAddonPerItem - alreadyOrdered);
          const productName = addonNameMap[productId] ?? "This item";
          return NextResponse.json(
            {
              error:
                alreadyOrdered > 0
                  ? `Maximum ${maxAddonPerItem} × ${productName} allowed per meal. You've already ordered ${alreadyOrdered}. You can add ${remaining} more.`
                  : `Maximum ${maxAddonPerItem} × ${productName} allowed per order.`,
            },
            { status: 400 }
          );
        }
      }
    }

    // ── Calculate total ───────────────────────────────────────────────────────
    const thaliTotal = (thaliItems as any[]).reduce(
      (sum: number, t: any) => sum + (thaliPriceMap[t.thaliId] ?? 0) * (Number(t.quantity) || 1),
      0
    );
    const addonTotal = (addonItems as any[]).reduce(
      (sum: number, a: any) =>
        sum + (addonPriceMap[a.addonProductId] ?? 0) * (Number(a.quantity) || 1),
      0
    );
    const totalAmount = thaliTotal + addonTotal;

    // ── Create order (use first thali as legacy thaliId for backwards compat) ──
    const primaryThaliId = (thaliItems as any[])[0]?.thaliId;

    const order = await prisma.order.create({
      data: {
        userId,
        menuId,
        thaliId: primaryThaliId,
        totalAmount,
        addressId: verifiedAddressId,
        status: "PENDING",
        note: note ? note.trim().slice(0, 200) || null : null,
        thaliItems: {
          create: (thaliItems as any[]).map((t: { thaliId: string; sabjiProductId: string | null; quantity: number }) => ({
            thaliId: t.thaliId,
            // FIX #3: normalize empty string to null
            sabjiProductId: t.sabjiProductId || null,
            quantity: Math.max(1, Number(t.quantity) || 1),
          })),
        },
        addonItems: {
          create: (addonItems as any[]).map((a) => ({
            addonProductId: a.addonProductId,
            quantity: Math.max(1, Number(a.quantity) || 1),
            priceSnapshot: addonPriceMap[a.addonProductId] ?? 0,
          })),
        },
      },
      include: {
        thaliItems: {
          include: {
            thali: { select: { id: true, name: true } },
            sabjiProduct: { select: { id: true, name: true } },
          },
        },
        addonItems: {
          include: {
            addonProduct: { select: { id: true, name: true } },
          },
        },
        menu: { select: { id: true, date: true, mealType: true } },
      },
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error("[CUSTOMER ORDERS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/customer/orders
 * Returns the current customer's order history with pagination and filters.
 *
 * Query params:
 *   page?     number (default: 1)
 *   limit?    number (default: 20, max: 50)
 *   status?   PENDING | CONFIRMED | DELIVERED | CANCELLED
 *   mealType? LUNCH | DINNER
 *   from?     YYYY-MM-DD
 *   to?       YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = verifyCustomerAccessToken(token);
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user and device status
    const statusCheck = await checkUserAndDeviceStatus(claims.sub, claims.fph);
    if (!statusCheck.allowed) {
      return NextResponse.json(
        { error: statusCheck.message, code: statusCheck.code },
        { status: 403 }
      );
    }

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
    const skip = (page - 1) * limit;

    // ── FIX #6: filter params ─────────────────────────────────────────────────
    const statusParam = searchParams.get("status");
    const mealTypeParam = searchParams.get("mealType");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const validStatuses = ["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"];
    const validMealTypes = ["LUNCH", "DINNER"];

    // Build where clause
    const where: any = { userId: claims.sub };

    if (statusParam && validStatuses.includes(statusParam)) {
      where.status = statusParam;
    }

    if (mealTypeParam && validMealTypes.includes(mealTypeParam)) {
      where.menu = { ...(where.menu ?? {}), mealType: mealTypeParam };
    }

    if (fromParam || toParam) {
      where.menu = {
        ...(where.menu ?? {}),
        date: {
          ...(fromParam ? { gte: new Date(fromParam + "T00:00:00.000Z") } : {}),
          ...(toParam ? { lte: new Date(toParam + "T23:59:59.999Z") } : {}),
        },
      };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          thali: { select: { id: true, name: true, nameGu: true, price: true } },
          menu: { select: { id: true, date: true, mealType: true } },
          address: { select: { id: true, type: true, line1: true, line2: true, landmark: true, city: true, pincode: true } },
          thaliItems: {
            include: {
              thali: { select: { id: true, name: true } },
              sabjiProduct: { select: { id: true, name: true } },
            },
          },
          addonItems: {
            include: {
              addonProduct: { select: { id: true, name: true, price: true } },
            },
          },
          // Include admin comments so customer sees replies
          comments: {
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return NextResponse.json({ orders, total, page, limit });
  } catch (error) {
    console.error("[CUSTOMER ORDERS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
