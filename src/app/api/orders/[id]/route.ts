import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/orders/[id] — Admin/Staff update order status
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Admin/Staff auth only
  const session = await verifyStaffSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { status } = await req.json();
  const validStatuses = ["PENDING", "CONFIRMED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: { status },
    include: {
      user: { select: { id: true, name: true, number: true } },
      thali: { select: { id: true, name: true } },
      thaliItems: {
        include: {
          thali: { select: { id: true, name: true, nameGu: true, price: true } },
          sabjiProduct: { select: { id: true, name: true, nameGu: true } },
        },
      },
      addonItems: {
        include: {
          addonProduct: { select: { id: true, name: true, nameGu: true, price: true } },
        },
      },
      selectedSabji: {
        include: { product: { select: { id: true, name: true } } },
      },
      selectedAddons: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ order });
}

/**
 * GET /api/orders/[id] — Get single order detail (Admin/Staff)
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const session = await verifyStaffSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { include: { company: { select: { id: true, name: true } } } },
      thali: true,
      menu: { select: { id: true, date: true, mealType: true } },
      thaliItems: {
        include: {
          thali: { select: { id: true, name: true, nameGu: true, price: true } },
          sabjiProduct: { select: { id: true, name: true, nameGu: true } },
        },
      },
      addonItems: {
        include: {
          addonProduct: { select: { id: true, name: true, nameGu: true, price: true } },
        },
      },
      selectedSabji: {
        include: { product: { select: { id: true, name: true } } },
      },
      selectedAddons: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  return NextResponse.json({ order });
}
