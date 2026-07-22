import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";

/**
 * POST /api/admin/orders/[id]/comments
 * Staff adds a reply/note to an order.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // Verify staff session (includes DB revocation check)
    const payload = await verifyStaffSession(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const message = typeof body.message === "string" ? body.message.trim().slice(0, 500) : "";
    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Verify order exists
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const comment = await prisma.orderComment.create({
      data: {
        orderId,
        authorType: "STAFF",
        authorStaffId: payload.staffId,
        message,
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("[ORDER COMMENTS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/admin/orders/[id]/comments
 * Returns all comments for an order.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    const payload = await verifyStaffSession(req);
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const comments = await prisma.orderComment.findMany({
      where: { orderId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ comments });
  } catch (error) {
    console.error("[ORDER COMMENTS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
