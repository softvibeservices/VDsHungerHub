import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, price, description, maxSabjiCount, items, isActive } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!price || Number(price) <= 0) return NextResponse.json({ error: "Valid price is required" }, { status: 400 });

    // Delete all existing items and recreate them
    await prisma.thaliItem.deleteMany({ where: { thaliId: id } });

    const thali = await prisma.thali.update({
      where: { id },
      data: {
        name: name.trim(),
        price: Number(price),
        description: description?.trim() || null,
        maxSabjiCount: Number(maxSabjiCount ?? 1),
        ...(isActive !== undefined && { isActive }),
        items: {
          create: (items as string[]).map((itemName, idx) => ({
            itemName: itemName.trim(),
            sortOrder: idx,
          })),
        },
      },
      include: { items: { orderBy: { sortOrder: "asc" } } },
    });

    return NextResponse.json({ thali });
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
