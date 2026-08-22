// src\app\api\admin\users\bulk-action\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireStaffAuth } from "@/lib/staff-auth";

export async function POST(req: NextRequest) {
  try {
    const { userIds, action, reason } = await req.json();

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "No user IDs provided" }, { status: 400 });
    }

    if (!["DELETE", "BLOCK", "UNBLOCK", "BAN", "UNBAN"].includes(action)) {
      return NextResponse.json({ error: "Invalid bulk action" }, { status: 400 });
    }

    // Permission checks
    let auth;
    if (action === "DELETE" || action === "BAN" || action === "UNBAN") {
      auth = await requireStaffAuth(req, { roles: ["ADMIN"] });
    } else {
      auth = await requireStaffAuth(req, { permission: "users:moderate" });
    }
    if (auth.error) return auth.error;
    const session = auth.session;

    let count = 0;

    if (action === "DELETE") {
      await prisma.$transaction([
        prisma.company.updateMany({
          where: { addedByUserId: { in: userIds } },
          data: { addedByUserId: null },
        }),
        prisma.otpVerification.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.customerSession.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.deviceFingerprint.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.userDevice.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.address.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.banHistory.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.order.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.payment.deleteMany({ where: { userId: { in: userIds } } }),
        prisma.user.deleteMany({ where: { id: { in: userIds } } }),
      ]);
      count = userIds.length;
    } else if (action === "BLOCK" || action === "BAN") {
      const newStatus = action === "BLOCK" ? "BLOCKED" : "BANNED";
      const auditAction = action === "BLOCK" ? "USER_BLOCKED" : "USER_BANNED";

      for (const userId of userIds) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: {
              status: newStatus,
              statusReason: reason || null,
              statusChangedAt: new Date(),
            },
          }),
          prisma.banHistory.create({
            data: {
              userId,
              action: newStatus,
              reason: reason || null,
              actedByStaffId: session.staffId,
            },
          }),
          prisma.adminAuditLog.create({
            data: {
              actedByStaffId: session.staffId,
              action: auditAction,
              targetType: "User",
              targetId: userId,
              metadata: { reason, bulk: true },
            },
          }),
        ]);

        // Device fingerprints cascade
        const fingerprints = await prisma.deviceFingerprint.findMany({
          where: { userId },
          select: { fingerprintHash: true },
        });

        for (const fp of fingerprints) {
          const sharedUserCount = await prisma.deviceFingerprint.count({
            where: { fingerprintHash: fp.fingerprintHash },
          });

          if (sharedUserCount === 1) {
            await prisma.deviceFingerprint.updateMany({
              where: { fingerprintHash: fp.fingerprintHash },
              data: {
                isBlocked: true,
                blockedReason: `Associated with ${action.toLowerCase()}ed user ${userId}`,
              },
            });
          }
        }
        count++;
      }
    } else if (action === "UNBLOCK" || action === "UNBAN") {
      for (const userId of userIds) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: userId },
            data: {
              status: "ACTIVE",
              statusReason: null,
              statusChangedAt: new Date(),
            },
          }),
          prisma.banHistory.create({
            data: {
              userId,
              action: "ACTIVE",
              reason: reason || "Bulk unblocked/unbanned",
              actedByStaffId: session.staffId,
            },
          }),
          prisma.adminAuditLog.create({
            data: {
              actedByStaffId: session.staffId,
              action: action === "UNBLOCK" ? "USER_UNBLOCKED" : "USER_UNBANNED",
              targetType: "User",
              targetId: userId,
              metadata: { bulk: true },
            },
          }),
        ]);

        const fingerprints = await prisma.deviceFingerprint.findMany({
          where: { userId },
          select: { fingerprintHash: true },
        });

        for (const fp of fingerprints) {
          await prisma.deviceFingerprint.updateMany({
            where: { fingerprintHash: fp.fingerprintHash },
            data: { isBlocked: false, blockedReason: null },
          });
        }
        count++;
      }
    }

    return NextResponse.json({ success: true, count });
  } catch (error) {
    console.error("[BULK USER ACTION ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
