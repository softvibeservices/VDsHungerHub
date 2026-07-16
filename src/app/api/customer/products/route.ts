import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/customer/products?addonsOnly=true
 *
 * Safe customer-scoped endpoint to fetch active add-on products.
 * Returns a minimal projection (no internal columns).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const addonsOnly = searchParams.get("addonsOnly") === "true";

    const where: Record<string, unknown> = {
      isActive: true,
    };
    if (addonsOnly) {
      where.isAddOnAvailable = true;
    }

    const products = await prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        nameGu: true,
        price: true,
        quantity: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error("[CUSTOMER PRODUCTS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
