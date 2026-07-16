// src/app/api/menu/history/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";

const PAGE_SIZE = 20;

/**
 * GET /api/menu/history?mealType=LUNCH|DINNER&page=1
 *
 * Returns every DailyMenu ever published, newest first, with enough
 * summary data (thali names, dish count, public link) to power the
 * "Past Menus & Links" admin page. Unlike /api/menu/summary this is
 * NOT limited to a date window — it's the permanent record.
 */
export async function GET(req: NextRequest) {
  const session = await verifyStaffSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const mealType = searchParams.get("mealType");
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  const where: Record<string, unknown> = {};
  if (mealType === "LUNCH" || mealType === "DINNER") {
    where.mealType = mealType;
  }

  try {
    const [menus, total] = await Promise.all([
      prisma.dailyMenu.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: {
          thalis: { select: { thali: { select: { name: true } } } },
          sabjiOptions: { select: { productId: true } },
        },
      }),
      prisma.dailyMenu.count({ where }),
    ]);

    const rows = menus.map((m: {
      id: string;
      date: Date;
      mealType: string;
      publicSlug: string | null;
      thalis: { thali: { name: string } }[];
      sabjiOptions: { productId: string }[];
    }) => ({
      id: m.id,
      date: m.date.toISOString().split("T")[0],
      mealType: m.mealType,
      publicSlug: m.publicSlug,
      thaliCount: m.thalis.length,
      thaliNames: m.thalis.map((t: { thali: { name: string } }) => t.thali.name),
      dishCount: new Set(m.sabjiOptions.map((s: { productId: string }) => s.productId)).size,
    }));

    return NextResponse.json({
      menus: rows,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
  } catch (error) {
    console.error("[MENU HISTORY GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
