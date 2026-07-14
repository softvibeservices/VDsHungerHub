import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyCustomerAccessToken,
  CUSTOMER_ACCESS_COOKIE,
  checkUserAndDeviceStatus,
} from "@/lib/customer-auth";

/**
 * GET /api/customer/orders/[id]
 *
 * Returns a single order with full detail for the order status timeline (§10).
 * Only the owner of the order can access it.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = verifyCustomerAccessToken(token);
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const statusCheck = await checkUserAndDeviceStatus(claims.sub, claims.fph);
    if (!statusCheck.allowed) {
      return NextResponse.json(
        { error: statusCheck.message, code: statusCheck.code },
        { status: 403 }
      );
    }

    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: {
        id,
        userId: claims.sub, // enforce ownership
      },
      include: {
        menu: { select: { id: true, date: true, mealType: true } },
        thali: { select: { id: true, name: true, nameGu: true, price: true } },
        address: {
          select: {
            id: true,
            type: true,
            line1: true,
            line2: true,
            landmark: true,
            city: true,
            pincode: true,
          },
        },
        thaliItems: {
          include: {
            thali: { select: { id: true, name: true, nameGu: true } },
            sabjiProduct: { select: { id: true, name: true, nameGu: true } },
          },
        },
        addonItems: {
          include: {
            addonProduct: { select: { id: true, name: true, nameGu: true, price: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error("[CUSTOMER ORDER GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
