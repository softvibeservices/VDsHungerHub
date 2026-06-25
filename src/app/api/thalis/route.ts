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
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ thalis });
  } catch (error) {
    console.error("[THALIS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, price, description, maxSabjiCount, items } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!price || Number(price) <= 0) return NextResponse.json({ error: "Valid price is required" }, { status: 400 });
    if (!Array.isArray(items) || items.length === 0)
      return NextResponse.json({ error: "At least one fixed item is required" }, { status: 400 });

    const thali = await prisma.thali.create({
      data: {
        name: name.trim(),
        price: Number(price),
        description: description?.trim() || null,
        maxSabjiCount: Number(maxSabjiCount ?? 1),
        items: {
          create: (items as string[]).map((itemName, idx) => ({
            itemName: itemName.trim(),
            sortOrder: idx,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ thali }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A thali with this name already exists" }, { status: 409 });
    }
    console.error("[THALIS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
