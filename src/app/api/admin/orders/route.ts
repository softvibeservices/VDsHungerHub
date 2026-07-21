import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";
import { getTodayIST } from "@/lib/utils";

/**
 * GET /api/admin/orders?date=YYYY-MM-DD&mealType=LUNCH|DINNER&status=PENDING
 *
 * Returns all orders for a given date, grouped by meal type.
 * Supports 5-minute polling from the admin Orders page.
 */
export async function GET(req: NextRequest) {
  const session = await verifyStaffSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const dateFilter = searchParams.get("date") ?? getTodayIST(); // YYYY-MM-DD
  const statusFilter = searchParams.get("status"); // optional
  const mealType = searchParams.get("mealType"); // LUNCH | DINNER | null

  const filterDate = new Date(dateFilter + "T00:00:00.000Z");

  const orders = await prisma.order.findMany({
    where: {
      menu: {
        date: filterDate,
        ...(mealType === "LUNCH" || mealType === "DINNER"
          ? { mealType }
          : {}),
      },
      ...(statusFilter === "PENDING" ||
      statusFilter === "CONFIRMED" ||
      statusFilter === "DELIVERED" ||
      statusFilter === "CANCELLED"
        ? { status: statusFilter }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        include: { company: { select: { id: true, name: true } } },
      },
      thali: { select: { id: true, name: true, nameGu: true, price: true } },
      menu: {
        select: {
          id: true,
          date: true,
          mealType: true,
          publicSlug: true,
        },
      },
      selectedSabji: {
        include: { product: { select: { id: true, name: true } } },
      },
      selectedAddons: {
        include: {
          product: { select: { id: true, name: true } },
        },
      },
    },
  });

  type OrderResult = (typeof orders)[number];

  // Group by meal type for convenience
  const lunch = orders.filter((o: OrderResult) => o.menu.mealType === "LUNCH");
  const dinner = orders.filter((o: OrderResult) => o.menu.mealType === "DINNER");

  return NextResponse.json({
    date: dateFilter,
    totalOrders: orders.length,
    lunch: { count: lunch.length, orders: lunch },
    dinner: { count: dinner.length, orders: dinner },
    fetchedAt: new Date().toISOString(),
  });
}

/**
 * PATCH /api/admin/orders — Bulk update order statuses
 */
export async function PATCH(req: NextRequest) {
  const session = await verifyStaffSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { orderIds, status } = await req.json();

    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json(
        { error: "orderIds must be a non-empty array" },
        { status: 400 }
      );
    }

    const validStatuses = ["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const result = await prisma.order.updateMany({
      where: {
        id: { in: orderIds },
      },
      data: {
        status: status as any,
      },
    });

    return NextResponse.json({ updatedCount: result.count });
  } catch (error) {
    console.error("[BULK PATCH ORDERS ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
