import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/user-auth";
import type { DailyMenuThali, DailyMenuSabjiOption } from "@prisma/client";

/**
 * POST /api/orders — Place a new order
 */
export async function POST(req: NextRequest) {
  // 1. Auth — require valid user JWT
  const userPayload = getUserFromRequest(req);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  const { menuId, thaliId, selectedSabjiIds, selectedAddonIds } =
    await req.json();

  if (!menuId || !thaliId) {
    return NextResponse.json(
      { error: "menuId and thaliId are required" },
      { status: 400 }
    );
  }

  // 3. Validate user is still active
  const user = await prisma.user.findUnique({
    where: { id: userPayload.sub },
  });
  if (!user || !user.isActive) {
    return NextResponse.json(
      { error: "Account is deactivated" },
      { status: 403 }
    );
  }

  // 4. Validate menu exists and is published
  const menu = await prisma.dailyMenu.findUnique({
    where: { id: menuId },
    include: {
      thalis: true,
      sabjiOptions: true,
    },
  });

  if (!menu || !menu.isPublished) {
    return NextResponse.json(
      { error: "Menu not found or not published" },
      { status: 404 }
    );
  }

  // 5. Enforce cutoff time (server-side — cannot be bypassed)
  if (menu.cutoffTime && new Date() > new Date(menu.cutoffTime)) {
    return NextResponse.json(
      { error: "Ordering cutoff time has passed. Please contact admin." },
      { status: 400 }
    );
  }

  // 6. Validate thali is in this menu
  const thaliSlot = menu.thalis.find((t: DailyMenuThali) => t.thaliId === thaliId);
  if (!thaliSlot) {
    return NextResponse.json(
      { error: "This thali is not available today" },
      { status: 400 }
    );
  }

  // 7. Fetch thali details for sabji validation
  const thaliDetail = await prisma.thali.findUnique({
    where: { id: thaliId },
  });
  if (!thaliDetail) {
    return NextResponse.json({ error: "Thali not found" }, { status: 404 });
  }

  // 8. Validate sabji selection (DailyMenuSabjiOption uses categoryId, not thaliId)
  const validSabjiProductIds = menu.sabjiOptions
    .filter((so: DailyMenuSabjiOption) => so.categoryId === thaliDetail.categoryId)
    .map((so: DailyMenuSabjiOption) => so.productId);

  const sabjiToAdd: string[] = (selectedSabjiIds ?? []).filter(
    (id: string) => validSabjiProductIds.includes(id)
  );

  if (
    thaliDetail.sabjiCount > 0 &&
    sabjiToAdd.length < thaliSlot.minSabjiRequired
  ) {
    return NextResponse.json(
      {
        error: `Minimum ${thaliSlot.minSabjiRequired} sabji selection required`,
      },
      { status: 400 }
    );
  }

  // 9. Validate and price add-ons
  const addonIds: string[] = selectedAddonIds ?? [];
  let addonsData: { productId: string; price: number }[] = [];

  if (addonIds.length > 0) {
    const addonProducts = await prisma.product.findMany({
      where: {
        id: { in: addonIds },
        isActive: true,
        isAddOnAvailable: true,
      },
      select: { id: true, price: true },
    });
    addonsData = addonProducts.map((p: { id: string; price: number }) => ({
      productId: p.id,
      price: p.price,
    }));
  }

  // 10. Check for duplicate order (same user + same menu)
  const existingOrder = await prisma.order.findFirst({
    where: { userId: user.id, menuId },
  });
  if (existingOrder) {
    return NextResponse.json(
      {
        error: "You have already placed an order for this meal.",
        orderId: existingOrder.id,
      },
      { status: 409 }
    );
  }

  // 11. Calculate total
  const addonsTotal = addonsData.reduce((sum, a) => sum + a.price, 0);
  const totalAmount = thaliDetail.price + addonsTotal;

  // 12. Create order
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      menuId,
      thaliId,
      totalAmount,
      status: "PENDING",
      selectedSabji: {
        create: sabjiToAdd.map((productId: string) => ({ productId })),
      },
      selectedAddons: {
        create: addonsData.map(({ productId, price }) => ({ productId, price })),
      },
    },
    include: {
      selectedSabji: {
        include: { product: { select: { id: true, name: true } } },
      },
      selectedAddons: {
        include: { product: { select: { id: true, name: true } } },
      },
      thali: { select: { id: true, name: true, price: true } },
      menu: { select: { id: true, date: true, mealType: true } },
    },
  });

  return NextResponse.json({ order }, { status: 201 });
}

/**
 * GET /api/orders — User's own order history (paginated)
 */
export async function GET(req: NextRequest) {
  const userPayload = getUserFromRequest(req);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: userPayload.sub },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        thali: { select: { id: true, name: true, nameGu: true, price: true } },
        menu: { select: { id: true, date: true, mealType: true } },
        selectedSabji: {
          include: {
            product: { select: { id: true, name: true, nameGu: true } },
          },
        },
        selectedAddons: {
          include: {
            product: { select: { id: true, name: true, nameGu: true } },
          },
        },
      },
    }),
    prisma.order.count({ where: { userId: userPayload.sub } }),
  ]);

  return NextResponse.json({ orders, total, page, limit });
}
