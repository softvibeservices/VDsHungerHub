import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, quantity, price, isActive } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!quantity?.trim()) return NextResponse.json({ error: "Quantity is required" }, { status: 400 });

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: name.trim(),
        quantity: quantity.trim(),
        price: Number(price),
        ...(isActive !== undefined && { isActive }),
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
