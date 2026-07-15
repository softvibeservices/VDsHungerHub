import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    // Staff/Admin Authentication
    const token =
      req.cookies.get("tos_staff_session")?.value ??
      req.cookies.get("vdh_token")?.value ??
      req.cookies.get("vd_admin_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || (payload.role !== "ADMIN" && payload.role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.status !== "BLOCKED") {
      return NextResponse.json({ error: "User is not blocked" }, { status: 400 });
    }

    // Perform database operations in transaction
    const [user] = await prisma.$transaction([
      // 1. Update user status
      prisma.user.update({
        where: { id: userId },
        data: {
          status: "ACTIVE",
          statusReason: null,
          statusChangedAt: new Date(),
        },
      }),
      // 2. Write Ban History
      prisma.banHistory.create({
        data: {
          userId,
          action: "UNBLOCKED",
          reason: null,
          actedByStaffId: payload.id,
        },
      }),
      // 3. Write Admin Audit Log
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: payload.id,
          action: "USER_UNBLOCKED",
          targetType: "User",
          targetId: userId,
        },
      }),
      // 4. Unblock associated device fingerprints
      prisma.deviceFingerprint.updateMany({
        where: { userId },
        data: {
          isBlocked: false,
          blockedReason: null,
        },
      }),
    ]);

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("[ADMIN USER UNBLOCK ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
