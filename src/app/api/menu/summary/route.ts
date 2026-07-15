import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";

/**
 * GET /api/menu/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * Lightweight lookup that returns configured daily menu states (Lunch/Dinner)
 * for a date range, used by the WeekStrip calendar view.
 * Authenticated to staff/admin sessions.
 */
export async function GET(req: NextRequest) {
  // Enforce staff authentication
  const session = await verifyStaffSession(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to parameters are required" }, { status: 400 });
  }

  try {
    const menus = await prisma.dailyMenu.findMany({
      where: {
        date: {
          gte: new Date(from + "T00:00:00.000Z"),
          // Include the entire end day up to 23:59:59.999Z to catch late records
          lte: new Date(to + "T23:59:59.999Z"),
        },
      },
      select: { date: true, mealType: true },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({
      days: menus.map((m: { date: Date; mealType: string }) => ({
        date: m.date.toISOString().split("T")[0],
        mealType: m.mealType,
      })),
    });
  } catch (error) {
    console.error("[MENU SUMMARY GET ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
