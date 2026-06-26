import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const isActiveParam = searchParams.get("isActive");

    const where: Record<string, unknown> = {};
    if (isActiveParam !== null && isActiveParam !== "") {
      where.isActive = isActiveParam === "true";
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { nameGu: { contains: search, mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        addOns: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ products });
  } catch (error) {
    console.error("[PRODUCTS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, nameGu, quantity, price, isAddOnAvailable, addOns } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!quantity?.trim()) return NextResponse.json({ error: "Quantity is required" }, { status: 400 });
    if (price === undefined || isNaN(Number(price)) || Number(price) < 0)
      return NextResponse.json({ error: "Valid price is required" }, { status: 400 });

    // Validate add-ons if provided
    const addonList: { name: string; price: number; sortOrder: number }[] = [];
    if (isAddOnAvailable && Array.isArray(addOns)) {
      for (let i = 0; i < addOns.length; i++) {
        const addon = addOns[i];
        if (!addon.name?.trim()) continue; // skip blank entries
        addonList.push({
          name: addon.name.trim(),
          price: Number(addon.price ?? 0),
          sortOrder: i,
        });
      }
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        nameGu: nameGu?.trim() || null,
        quantity: quantity.trim(),
        price: Number(price),
        isAddOnAvailable: Boolean(isAddOnAvailable),
        ...(addonList.length > 0 && {
          addOns: {
            create: addonList,
          },
        }),
      },
      include: {
        addOns: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A product with this name already exists" }, { status: 409 });
    }
    console.error("[PRODUCTS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
