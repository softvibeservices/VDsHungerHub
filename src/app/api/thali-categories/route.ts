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

    const categories = await prisma.thaliCategory.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        thalis: {
          select: { id: true, name: true, nameGu: true, sabjiCount: true, isActive: true },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[THALI-CATEGORIES GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, nameGu, thaliIds } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const category = await prisma.thaliCategory.create({
      data: {
        name: name.trim(),
        nameGu: nameGu?.trim() || null,
        thalis: Array.isArray(thaliIds) && thaliIds.length > 0
          ? { connect: thaliIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: { thalis: true },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    console.error("[THALI-CATEGORIES POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
