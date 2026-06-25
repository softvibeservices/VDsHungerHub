import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const mealType = searchParams.get("mealType");

    const where: Record<string, unknown> = {};
    if (dateParam) {
      const date = new Date(dateParam);
      where.date = date;
    }
    if (mealType) {
      where.mealType = mealType;
    }

    const menus = await prisma.dailyMenu.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        thalis: { include: { thali: true } },
        sabjiOptions: { include: { product: true, thali: true } },
      },
    });

    return NextResponse.json({ menus });
  } catch (error) {
    console.error("[MENU GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, mealType, cutoffTime, thaliIds, sabjiOptions } = await req.json();

    if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });
    if (!mealType) return NextResponse.json({ error: "Meal type is required" }, { status: 400 });
    if (!Array.isArray(thaliIds) || thaliIds.length === 0)
      return NextResponse.json({ error: "At least one thali must be selected" }, { status: 400 });

    const menu = await prisma.dailyMenu.create({
      data: {
        date: new Date(date),
        mealType,
        cutoffTime: cutoffTime || null,
        thalis: {
          create: thaliIds.map((thaliId: string) => ({ thaliId })),
        },
        sabjiOptions: {
          create: (sabjiOptions as { thaliId: string; productIds: string[] }[]).flatMap(
            ({ thaliId, productIds }) =>
              productIds.map((productId) => ({ thaliId, productId }))
          ),
        },
      },
      include: {
        thalis: { include: { thali: true } },
        sabjiOptions: { include: { product: true, thali: true } },
      },
    });

    return NextResponse.json({ menu }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "A menu for this date and meal type already exists" },
        { status: 409 }
      );
    }
    console.error("[MENU POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
