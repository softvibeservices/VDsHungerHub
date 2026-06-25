import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get today's date in Indian Standard Time (IST, UTC+5:30) where the service operates
    const now = new Date();
    const istTime = new Date(now.getTime() + (330 * 60 * 1000));
    const today = new Date(Date.UTC(istTime.getUTCFullYear(), istTime.getUTCMonth(), istTime.getUTCDate()));

    const [companies, users, products, thalis, staff, todayMenus] = await Promise.all([
      prisma.company.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.product.count({ where: { isActive: true } }),
      prisma.thali.count({ where: { isActive: true } }),
      prisma.staff.count({ where: { isActive: true } }),
      prisma.dailyMenu.findMany({
        where: { date: today },
        include: {
          thalis: { include: { thali: { select: { name: true, price: true } } } },
          sabjiOptions: { include: { product: { select: { name: true } }, thali: { select: { name: true } } } },
        },
      }),
    ]);

    return NextResponse.json({
      stats: { companies, users, products, thalis, staff },
      todayMenus,
    });
  } catch (error) {
    console.error("[DASHBOARD GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
