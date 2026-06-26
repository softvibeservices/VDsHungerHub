import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, nameGu, isActive, thaliIds } = await req.json();

    // Replace the full set of assigned thalis: disconnect all current members,
    // then connect exactly the incoming list. This makes the "assign these thalis
    // to this category" UI behave as a full replace, not an incremental add.
    const current = await prisma.thaliCategory.findUnique({
      where: { id },
      include: { thalis: { select: { id: true } } },
    });
    if (!current) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const category = await prisma.thaliCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(nameGu !== undefined && { nameGu: nameGu?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
        ...(Array.isArray(thaliIds) && {
          thalis: {
            disconnect: current.thalis.map((t: { id: string }) => ({ id: t.id })),
            connect: thaliIds.map((tid: string) => ({ id: tid })),
          },
        }),
      },
      include: { thalis: true },
    });

    return NextResponse.json({ category });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    console.error("[THALI-CATEGORIES PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Thali.categoryId uses onDelete: SetNull, so deleting a category
    // un-categorizes its thalis rather than deleting them or failing.
    await prisma.thaliCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    console.error("[THALI-CATEGORIES DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
