// src\app\api\menu\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAuth } from "@/lib/staff-auth";
import { getTodayIST, istTimeToUTC } from "@/lib/time";
import { validateSabjiCoverage } from "@/lib/menu-validation";

export async function GET(req: NextRequest) {
  const auth = await requireStaffAuth(req);
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const mealType = searchParams.get("mealType");

    const where: Record<string, unknown> = {};
    if (dateParam) {
      const date = new Date(dateParam + "T00:00:00.000Z");
      where.date = date;
    }
    if (mealType) {
      where.mealType = mealType;
    }

    const menus = await prisma.dailyMenu.findMany({
      where,
      orderBy: { date: "desc" },
      include: {
        thalis: { include: { thali: { include: { items: { orderBy: { sortOrder: "asc" } } } } } },
        sabjiOptions: { include: { product: true, category: true } },
      },
    });

    return NextResponse.json({ menus });
  } catch (error) {
    console.error("[MENU GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaffAuth(req, { permission: "menu:manage" });
  if (auth.error) return auth.error;

  try {
    const { date, mealType, cutoffTime, thaliIds, thaliConfig, sabjiOptions } = await req.json();

    if (!date) return NextResponse.json({ error: "Date is required" }, { status: 400 });
    if (!mealType) return NextResponse.json({ error: "Meal type is required" }, { status: 400 });

    const todayStr = getTodayIST();
    if (date < todayStr) {
      return NextResponse.json({ error: "Cannot create a menu for a past date" }, { status: 400 });
    }

    interface MenuThaliInput {
      thaliId: string;
      minSabjiRequired?: number;
    }
    const resolvedConfig: MenuThaliInput[] = thaliConfig
      ? thaliConfig
      : (thaliIds || []).map((thaliId: string) => ({ thaliId }));

    if (resolvedConfig.length === 0) {
      return NextResponse.json({ error: "At least one thali must be selected" }, { status: 400 });
    }

    const thalisFromDb = await prisma.thali.findMany({
      where: { id: { in: resolvedConfig.map((t) => t.thaliId) } },
      include: { category: true },
    });
    const sabjiCountMap = new Map<string, number>(thalisFromDb.map((t: { id: string; sabjiCount: number }) => [t.id, t.sabjiCount]));

    const clampedThaliConfig = resolvedConfig.map(({ thaliId, minSabjiRequired }) => {
      const cap = sabjiCountMap.get(thaliId) ?? 1;
      return { thaliId, minSabjiRequired: Math.min(minSabjiRequired ?? cap, cap) };
    });

    const flatSabjiOptions = (sabjiOptions ?? []) as { categoryId: string; productId: string }[];
    const sabjiGroupMap = new Map<string, string[]>();
    for (const { categoryId, productId } of flatSabjiOptions) {
      if (!sabjiGroupMap.has(categoryId)) sabjiGroupMap.set(categoryId, []);
      sabjiGroupMap.get(categoryId)!.push(productId);
    }
    const sabjiOptionsInput: { categoryId: string; productIds: string[] }[] = Array.from(
      sabjiGroupMap.entries()
    ).map(([categoryId, productIds]) => ({ categoryId, productIds }));

    const validation = validateSabjiCoverage(thalisFromDb, clampedThaliConfig, sabjiOptionsInput);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "This menu can't be published yet — some dishes are missing.",
          issues: validation.issues,
        },
        { status: 400 }
      );
    }

    const cutoffTimeUTC = cutoffTime ? istTimeToUTC(cutoffTime, date) : null;
    const menuDate = new Date(date + "T00:00:00.000Z");

    const menu = await prisma.dailyMenu.create({
      data: {
        date: menuDate,
        mealType,
        cutoffTime: cutoffTimeUTC,
        thalis: { create: clampedThaliConfig },
        sabjiOptions: {
          create: sabjiOptionsInput.flatMap(({ categoryId, productIds }) =>
            productIds.map((productId) => ({ categoryId, productId }))
          ),
        },
      },
      include: {
        thalis: { include: { thali: { include: { items: { orderBy: { sortOrder: "asc" } } } } } },
        sabjiOptions: { include: { product: true, category: true } },
      },
    });

    return NextResponse.json({ menu }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A menu for this date and meal type already exists" }, { status: 409 });
    }
    console.error("[MENU POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
