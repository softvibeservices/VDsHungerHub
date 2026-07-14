import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

// Helper to seed defaults if settings do not exist
async function getOrCreateSettings() {
  let settings = await prisma.mealSettings.findMany();
  
  if (settings.length === 0) {
    await prisma.mealSettings.createMany({
      data: [
        { mealType: "LUNCH", cutoffTime: "10:30", menuVisibleFrom: "18:00", isOrderingOpen: true },
        { mealType: "DINNER", cutoffTime: "16:00", menuVisibleFrom: "21:00", isOrderingOpen: true },
      ],
    });
    settings = await prisma.mealSettings.findMany();
  }
  return settings;
}

export async function GET(req: NextRequest) {
  try {
    // Staff/Admin Authentication
    const token =
      req.cookies.get("vdh_token")?.value ??
      req.cookies.get("vd_admin_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || (payload.role !== "ADMIN" && payload.role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await getOrCreateSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[ADMIN MEAL SETTINGS GET ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Staff/Admin Authentication
    const token =
      req.cookies.get("vdh_token")?.value ??
      req.cookies.get("vd_admin_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || (payload.role !== "ADMIN" && payload.role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { mealType, cutoffTime, menuVisibleFrom, isOrderingOpen } = body;

    if (!mealType || (mealType !== "LUNCH" && mealType !== "DINNER")) {
      return NextResponse.json({ error: "Invalid mealType" }, { status: 400 });
    }

    if (!cutoffTime || !/^\d{2}:\d{2}$/.test(cutoffTime)) {
      return NextResponse.json({ error: "Cutoff time must be in HH:MM format" }, { status: 400 });
    }

    if (!menuVisibleFrom || !/^\d{2}:\d{2}$/.test(menuVisibleFrom)) {
      return NextResponse.json({ error: "Menu visible from must be in HH:MM format" }, { status: 400 });
    }

    const updatedSetting = await prisma.$transaction([
      prisma.mealSettings.upsert({
        where: { mealType },
        update: {
          cutoffTime,
          menuVisibleFrom,
          isOrderingOpen: !!isOrderingOpen,
        },
        create: {
          mealType,
          cutoffTime,
          menuVisibleFrom,
          isOrderingOpen: !!isOrderingOpen,
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: payload.id,
          action: "MEAL_SETTINGS_UPDATED",
          targetType: "MealSettings",
          targetId: mealType,
          metadata: { cutoffTime, menuVisibleFrom, isOrderingOpen },
        },
      }),
    ]);

    return NextResponse.json({ success: true, setting: updatedSetting[0] });
  } catch (error) {
    console.error("[ADMIN MEAL SETTINGS PUT ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
