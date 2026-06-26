import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, nameGu, price, description, maxSabjiCount, items, sabjiProductIds, isActive } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!price || Number(price) <= 0) return NextResponse.json({ error: "Valid price is required" }, { status: 400 });

    const maxCount = Number(maxSabjiCount ?? 1);
    if (maxCount < 0 || maxCount > 3) {
      return NextResponse.json({ error: "Max sabji count must be between 0 and 3" }, { status: 400 });
    }

    await prisma.$transaction(async (tx: any) => {
      // Delete all existing items and thali-sabji pool relations
      await tx.thaliItem.deleteMany({ where: { thaliId: id } });
      await tx.thaliSabjiProduct.deleteMany({ where: { thaliId: id } });

      await tx.thali.update({
        where: { id },
        data: {
          name: name.trim(),
          nameGu: nameGu?.trim() || null,
          price: Number(price),
          description: description?.trim() || null,
          maxSabjiCount: maxCount,
          ...(isActive !== undefined && { isActive }),
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
            thaliId: id,
            productId,
          })),
        });
      }
    });

    const finalThali = await prisma.thali.findUnique({
      where: { id },
      include: {
        items: { orderBy: { sortOrder: "asc" } },
        sabjiPool: { include: { product: true } },
      },
    });

    return NextResponse.json({ thali: finalThali });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A thali with this name already exists" }, { status: 409 });
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Thali not found" }, { status: 404 });
    }
    console.error("[THALIS PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if thali is used in any menus
    const menuCount = await prisma.dailyMenuThali.count({ where: { thaliId: id } });
    if (menuCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete: thali is used in one or more daily menus" },
        { status: 409 }
      );
    }

    await prisma.thali.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Thali not found" }, { status: 404 });
    }
    console.error("[THALIS DELETE]", error);
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

    const thali = await prisma.thali.update({
      where: { id },
      data,
    });

    return NextResponse.json({ thali });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Thali not found" }, { status: 404 });
    }
    console.error("[THALIS PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

