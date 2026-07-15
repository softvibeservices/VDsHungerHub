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

    // Staff/Admin Authentication - Requires ADMIN role
    const token =
      req.cookies.get("tos_staff_session")?.value ??
      req.cookies.get("vdh_token")?.value ??
      req.cookies.get("vd_admin_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = verifyToken(token);
    if (!payload || payload.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Administrators can ban accounts" },
        { status: 403 }
      );
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Perform database operations in transaction
    const [user] = await prisma.$transaction([
      // 1. Update user status
      prisma.user.update({
        where: { id: userId },
        data: {
          status: "BANNED",
          statusReason: reason || null,
          statusChangedAt: new Date(),
        },
      }),
      // 2. Write Ban History
      prisma.banHistory.create({
        data: {
          userId,
          action: "BANNED",
          reason: reason || null,
          actedByStaffId: payload.id,
        },
      }),
      // 3. Write Admin Audit Log
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: payload.id,
          action: "USER_BANNED",
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
      const sharedUserCount = await prisma.deviceFingerprint.count({
        where: { fingerprintHash: fp.fingerprintHash },
      });

      if (sharedUserCount === 1) {
        // Block fingerprint
        await prisma.deviceFingerprint.updateMany({
          where: { fingerprintHash: fp.fingerprintHash },
          data: {
            isBlocked: true,
            blockedReason: `Associated with banned user ${userId}`,
          },
        });

        // Audit Log for blocking device
        await prisma.adminAuditLog.create({
          data: {
            actedByStaffId: payload.id,
            action: "DEVICE_BLOCKED",
            targetType: "Device",
            targetId: fp.fingerprintHash,
            metadata: { reason: `Cascade from banned user ${userId}` },
          },
        });
      } else {
        // Flag shared device for manual review
        await prisma.adminAuditLog.create({
          data: {
            actedByStaffId: payload.id,
            action: "DEVICE_FLAGGED_FOR_REVIEW",
            targetType: "Device",
            targetId: fp.fingerprintHash,
            metadata: { reason: `Shared device used by banned user ${userId} and others` },
          },
        });
      }
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("[ADMIN USER BAN ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
