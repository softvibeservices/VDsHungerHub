// src\app\api\admin\settings\credit-limit\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";
import { getGlobalCreditLimit, DEFAULT_CREDIT_LIMIT } from "@/lib/credit";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
    }
    const limit = await getGlobalCreditLimit();
    return NextResponse.json({ limit, default: DEFAULT_CREDIT_LIMIT });
  } catch (error) {
    console.error("[ADMIN CREDIT LIMIT GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
    }

    const { limit } = await req.json();
    const numLimit = parseFloat(limit);
    if (!Number.isFinite(numLimit) || numLimit <= 0) {
      return NextResponse.json(
        { error: "Credit limit must be a positive number." },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.systemSetting.upsert({
        where: { key: "CREDIT_LIMIT_GLOBAL_DEFAULT" },
        update: { value: String(numLimit) },
        create: { key: "CREDIT_LIMIT_GLOBAL_DEFAULT", value: String(numLimit) },
      }),
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: session.staffId,
          action: "CREDIT_LIMIT_GLOBAL_UPDATED",
          targetType: "SystemSetting",
          targetId: "CREDIT_LIMIT_GLOBAL_DEFAULT",
          metadata: { newLimit: numLimit },
        },
      }),
    ]);

    return NextResponse.json({ success: true, limit: numLimit });
  } catch (error) {
    console.error("[ADMIN CREDIT LIMIT PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
