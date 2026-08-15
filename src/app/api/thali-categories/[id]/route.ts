// src\app\api\thali-categories\[id]\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAuth } from "@/lib/staff-auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffAuth(req, { permission: "menu:manage" });
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { name, nameGu, isActive, thaliIds } = await req.json();

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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaffAuth(req, { permission: "menu:manage" });
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
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
