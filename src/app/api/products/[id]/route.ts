import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, nameGu, quantity, price, isActive, isAddOnAvailable, addOns } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!quantity?.trim()) return NextResponse.json({ error: "Quantity is required" }, { status: 400 });

    // Build add-on list
    const addonList: { name: string; price: number; sortOrder: number }[] = [];
    if (isAddOnAvailable && Array.isArray(addOns)) {
      for (let i = 0; i < addOns.length; i++) {
        const addon = addOns[i];
        if (!addon.name?.trim()) continue;
        addonList.push({
          name: addon.name.trim(),
          price: Number(addon.price ?? 0),
          sortOrder: i,
        });
      }
    }

    // Delete existing add-ons and recreate (simplest strategy for this scale)
    await prisma.productAddon.deleteMany({ where: { productId: id } });

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: name.trim(),
        nameGu: nameGu?.trim() || null,
        quantity: quantity.trim(),
        price: Number(price),
        ...(isActive !== undefined && { isActive }),
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

    return NextResponse.json({ product });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A product with this name already exists" }, { status: 409 });
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    console.error("[PRODUCTS PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2003") {
      return NextResponse.json({ error: "Cannot delete: product is used in a daily menu" }, { status: 409 });
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    console.error("[PRODUCTS DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, any> = {};

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
      }
      data.isActive = body.isActive;
    }

    if (body.price !== undefined) {
      const priceVal = Number(body.price);
      if (isNaN(priceVal) || priceVal < 0) {
        return NextResponse.json({ error: "Price must be a positive number" }, { status: 400 });
      }
      data.price = priceVal;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const product = await prisma.product.update({
      where: { id },
      data,
    });

    return NextResponse.json({ product });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    console.error("[PRODUCTS PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

