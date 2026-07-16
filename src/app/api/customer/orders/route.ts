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
 * Body:
 *   menuId      string
 *   thaliItems  Array<{ thaliId: string; sabjiProductId: string; quantity: number }>
 *   addonItems? Array<{ addonProductId: string; quantity: number }>
 *   note?       string
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
    const [maxThali, maxAddon] = await Promise.all([
      getOrderLimit("MAX_THALI_PER_ORDER", DEFAULT_MAX_THALI),
      getOrderLimit("MAX_ADDON_PER_ORDER", DEFAULT_MAX_ADDON),
    ]);

    // ── Validate thali item totals (server-side, never trust client count) ─────
    const totalThaliQty: number = thaliItems.reduce(
      (sum: number, t: any) => sum + (Number(t.quantity) || 1),
      0
    );
    const totalAddonQty: number = (addonItems as any[]).reduce(
      (sum: number, a: any) => sum + (Number(a.quantity) || 1),
      0
    );

    if (totalThaliQty > maxThali) {
      return NextResponse.json(
        { error: `Maximum ${maxThali} thali per order. You submitted ${totalThaliQty}.` },
        { status: 400 }
      );
    }

    if (totalAddonQty > maxAddon) {
      return NextResponse.json(
        { error: `Maximum ${maxAddon} add-on items per order. You submitted ${totalAddonQty}.` },
        { status: 400 }
      );
    }

    // ── Validate menu ─────────────────────────────────────────────────────────
    const menu = await prisma.dailyMenu.findUnique({
      where: { id: menuId },
      include: {
        thalis: { include: { thali: { select: { id: true, price: true, categoryId: true, isActive: true } } } },
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

    let activeCutoff = menu.cutoffTime;
    if (!activeCutoff && settings && settings.cutoffTime) {
      const [hours, minutes] = settings.cutoffTime.split(":").map(Number);
      const combined = new Date(menu.date);
      combined.setHours(hours, minutes, 0, 0);
      activeCutoff = combined;
    }

    if (activeCutoff && new Date() > new Date(activeCutoff)) {
      return NextResponse.json(
        { error: "Ordering cutoff time has passed." },
        { status: 400 }
      );
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

    // ── Validate each thali item ──────────────────────────────────────────────
    const thaliPriceMap: Record<string, number> = {};
    const thaliCategoryMap: Record<string, string | null> = {};
    const validThaliIds = new Set<string>();

    for (const mt of menu.thalis) {
      if (!mt.thali.isActive) continue; // skip inactive thalis
      validThaliIds.add(mt.thaliId);
      thaliPriceMap[mt.thaliId] = mt.thali.price;
      thaliCategoryMap[mt.thaliId] = mt.thali.categoryId;
    }

    for (const item of thaliItems as any[]) {
      if (!item.thaliId || !validThaliIds.has(item.thaliId)) {
        return NextResponse.json(
          { error: `Thali ${item.thaliId} is not available in this menu` },
          { status: 400 }
        );
      }

      if (!item.sabjiProductId) {
        return NextResponse.json(
          { error: `Each thali item must have a sabjiProductId` },
          { status: 400 }
        );
      }

      // Validate sabji is valid for this thali's category
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

    // ── Validate and price add-ons ────────────────────────────────────────────
    let addonPriceMap: Record<string, number> = {};
    if (Array.isArray(addonItems) && addonItems.length > 0) {
      const addonProductIds = (addonItems as any[]).map((a) => a.addonProductId);
      const addonProducts = await prisma.product.findMany({
        where: {
          id: { in: addonProductIds },
          isActive: true,
          isAddOnAvailable: true,
        },
        select: { id: true, price: true },
      });

      addonPriceMap = Object.fromEntries(addonProducts.map((p: { id: string; price: number }) => [p.id, p.price]));

      for (const item of addonItems as any[]) {
        if (!addonPriceMap[item.addonProductId]) {
          return NextResponse.json(
            { error: `Add-on ${item.addonProductId} is not available` },
            { status: 400 }
          );
        }
      }
    }

    // ── Check duplicate (same user + same menu) ───────────────────────────────
    const existing = await prisma.order.findFirst({
      where: { userId, menuId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You have already ordered for this meal.", orderId: existing.id },
        { status: 409 }
      );
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
          create: (thaliItems as any[]).map((t: { thaliId: string; sabjiProductId: string; quantity: number }) => ({
            thaliId: t.thaliId,
            sabjiProductId: t.sabjiProductId,
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
 * Returns the current customer's order history.
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

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { userId: claims.sub },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          thali: { select: { id: true, name: true, nameGu: true, price: true } },
          menu: { select: { id: true, date: true, mealType: true } },
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
        },
      }),
      prisma.order.count({ where: { userId: claims.sub } }),
    ]);

    return NextResponse.json({ orders, total, page, limit });
  } catch (error) {
    console.error("[CUSTOMER ORDERS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
