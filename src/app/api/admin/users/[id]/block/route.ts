import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: userId } = await params;
    const { reason } = await req.json();

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

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.status === "BANNED") {
      return NextResponse.json({ error: "Cannot block a banned user. Unban them first." }, { status: 400 });
    }

    // Perform database operations in transaction
    const [user] = await prisma.$transaction([
      // 1. Update user status
      prisma.user.update({
        where: { id: userId },
        data: {
          status: "BLOCKED",
          statusReason: reason || null,
          statusChangedAt: new Date(),
        },
      }),
      // 2. Write Ban History
      prisma.banHistory.create({
        data: {
          userId,
          action: "BLOCKED",
          reason: reason || null,
          actedByStaffId: payload.id,
        },
      }),
      // 3. Write Admin Audit Log
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: payload.id,
          action: "USER_BLOCKED",
          targetType: "User",
          targetId: userId,
          metadata: { reason },
        },
      }),
    ]);

    // 4. Cascade block to device fingerprints used uniquely by this user
    const fingerprints = await prisma.deviceFingerprint.findMany({
      where: { userId },
      select: { fingerprintHash: true },
    });

    for (const fp of fingerprints) {
      // Check if this fingerprint is shared with other users
      const sharedUserCount = await prisma.deviceFingerprint.count({
        where: { fingerprintHash: fp.fingerprintHash },
      });

      if (sharedUserCount === 1) {
        // Block fingerprint
        await prisma.deviceFingerprint.updateMany({
          where: { fingerprintHash: fp.fingerprintHash },
          data: {
            isBlocked: true,
            blockedReason: `Associated with blocked user ${userId}`,
          },
        });

        // Audit Log for blocking device
        await prisma.adminAuditLog.create({
          data: {
            actedByStaffId: payload.id,
            action: "DEVICE_BLOCKED",
            targetType: "Device",
            targetId: fp.fingerprintHash,
            metadata: { reason: `Cascade from blocked user ${userId}` },
          },
        });
      }
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("[ADMIN USER BLOCK ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
