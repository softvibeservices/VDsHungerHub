import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { products } = await req.json();
    if (!Array.isArray(products)) {
      return NextResponse.json({ error: "Products array is required" }, { status: 400 });
    }

    let created = 0;
    let updated = 0;

    for (const item of products) {
      const { name, nameGu, quantity, price } = item;
      if (!name?.trim()) continue;

      const existing = await prisma.product.findUnique({
        where: { name: name.trim() },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            nameGu: nameGu?.trim() || existing.nameGu,
            quantity: quantity?.trim() || existing.quantity,
            price: price !== undefined ? Number(price) : existing.price,
          },
        });
        updated++;
      } else {
        await prisma.product.create({
          data: {
            name: name.trim(),
            nameGu: nameGu?.trim() || null,
            quantity: quantity?.trim() || "1 unit",
            price: price !== undefined ? Number(price) : 0,
          },
        });
        created++;
      }
    }

    return NextResponse.json({ created, updated, skipped: products.length - (created + updated) });
  } catch (error) {
    console.error("[PRODUCTS BULK POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
