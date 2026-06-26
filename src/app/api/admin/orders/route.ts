import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getTodayIST } from "@/lib/utils";

/**
 * GET /api/admin/orders?date=YYYY-MM-DD&mealType=LUNCH|DINNER&status=PENDING
 *
 * Returns all orders for a given date, grouped by meal type.
 * Supports 5-minute polling from the admin Orders page.
 */
export async function GET(req: NextRequest) {
  // Admin/Staff auth
  const token =
    req.cookies.get("vdh_token")?.value ??
    req.cookies.get("vd_admin_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const payload = verifyToken(token);
  if (!payload) {
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

