import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isActiveParam = searchParams.get("isActive");

    const where: Record<string, unknown> = {};
    if (isActiveParam !== null && isActiveParam !== "") {
      where.isActive = isActiveParam === "true";
    }

    const thalis = await prisma.thali.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        sabjiPool: { include: { product: true } },
      },
    });

    return NextResponse.json({ thalis });
  } catch (error) {
    console.error("[THALIS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, nameGu, price, description, maxSabjiCount, items, sabjiProductIds } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!price || Number(price) <= 0) return NextResponse.json({ error: "Valid price is required" }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: "At least one fixed item is required" }, { status: 400 });

    const maxCount = Number(maxSabjiCount ?? 1);
    if (maxCount < 0 || maxCount > 3) {
      return NextResponse.json({ error: "Max sabji count must be between 0 and 3" }, { status: 400 });
    }

    const thali = await prisma.$transaction(async (tx) => {
      const created = await tx.thali.create({
        data: {
          name: name.trim(),
          nameGu: nameGu?.trim() || null,
          price: Number(price),
          description: description?.trim() || null,
          maxSabjiCount: maxCount,
          items: {
            create: (items as string[]).map((itemName, idx) => ({
              itemName: itemName.trim(),
              sortOrder: idx,
            })),
          },
        },
      });

      if (maxCount > 0 && Array.isArray(sabjiProductIds) && sabjiProductIds.length > 0) {
        await tx.thaliSabjiProduct.createMany({
          data: sabjiProductIds.map((productId: string) => ({
            thaliId: created.id,
            productId,
          })),
        });
      }

      return created;
    });

    const finalThali = await prisma.thali.findUnique({
      where: { id: thali.id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        sabjiPool: { include: { product: true } },
      },
    });

    return NextResponse.json({ thali: finalThali }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A thali with this name already exists" }, { status: 409 });
    }
    console.error("[THALIS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
