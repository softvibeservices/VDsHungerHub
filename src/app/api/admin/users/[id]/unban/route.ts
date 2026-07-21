import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;

    // Staff/Admin Authentication - Requires ADMIN role
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Administrators can unban accounts" },
        { status: 403 }
      );
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.status !== "BANNED") {
      return NextResponse.json({ error: "User is not banned" }, { status: 400 });
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
          action: "UNBANNED",
          reason: null,
          actedByStaffId: session.staffId,
        },
      }),
      // 3. Write Admin Audit Log
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: session.staffId,
          action: "USER_UNBANNED",
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
    console.error("[ADMIN USER UNBANNED ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
