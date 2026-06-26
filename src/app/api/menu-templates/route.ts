import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mealType = searchParams.get("mealType");

    const templates = await prisma.menuTemplate.findMany({
      where: mealType ? { mealType: mealType as "LUNCH" | "DINNER" } : {},
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ templates });
  } catch (error: unknown) {
    console.error("[MENU TEMPLATES GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, mealType, cutoffTime, thaliIds, sabjiConfig } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }
    if (!mealType || (mealType !== "LUNCH" && mealType !== "DINNER")) {
      return NextResponse.json({ error: "Valid meal type is required" }, { status: 400 });
    }
    if (!Array.isArray(thaliIds) || thaliIds.length === 0) {
      return NextResponse.json({ error: "At least one thali is required" }, { status: 400 });
    }

    const template = await prisma.menuTemplate.upsert({
      where: { name: name.trim() },
      update: {
        mealType,
        cutoffTime,
        thaliIds,
        sabjiConfig: sabjiConfig ?? [],
      },
      create: {
        name: name.trim(),
        mealType,
        cutoffTime,
        thaliIds,
        sabjiConfig: sabjiConfig ?? [],
      },
    });

    return NextResponse.json({ template });
  } catch (error: unknown) {
    console.error("[MENU TEMPLATES POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    await prisma.menuTemplate.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[MENU TEMPLATES DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
