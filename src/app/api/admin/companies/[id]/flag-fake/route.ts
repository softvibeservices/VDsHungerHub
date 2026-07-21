import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const { reason, alsoBlockReporter } = await req.json();

    // Staff/Admin Authentication
    const session = await verifyStaffSession(req);
    if (!session || (session.role !== "ADMIN" && session.role !== "STAFF")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify company exists
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Update company status to flagged as fake
    await prisma.$transaction([
      prisma.company.update({
        where: { id: companyId },
        data: {
          isFlaggedFake: true,
          flaggedReason: reason || null,
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: session.staffId,
          action: "COMPANY_FLAGGED_FAKE",
          targetType: "Company",
          targetId: companyId,
          metadata: { reason, alsoBlockReporter },
        },
      }),
    ]);

    // If block reporter option is checked and we know who added it
    if (alsoBlockReporter && company.addedByUserId) {
      const reporterId = company.addedByUserId;

      // Check if reporter is active and not already blocked/banned
      const reporter = await prisma.user.findUnique({
        where: { id: reporterId },
        select: { status: true },
      });

      if (reporter && reporter.status === "ACTIVE") {
        const blockReason = `Submitted fake company: ${company.name}. Reason: ${reason}`;
        
        await prisma.$transaction([
          prisma.user.update({
            where: { id: reporterId },
            data: {
              status: "BLOCKED",
              statusReason: blockReason,
              statusChangedAt: new Date(),
            },
          }),
          prisma.banHistory.create({
            data: {
              userId: reporterId,
              action: "BLOCKED",
              reason: blockReason,
              actedByStaffId: session.staffId,
            },
          }),
          prisma.adminAuditLog.create({
            data: {
              actedByStaffId: session.staffId,
              action: "USER_BLOCKED",
              targetType: "User",
              targetId: reporterId,
              metadata: { reason: blockReason },
            },
          }),
        ]);

        // Cascade block to unique device fingerprints
        const fingerprints = await prisma.deviceFingerprint.findMany({
          where: { userId: reporterId },
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
                blockedReason: `Associated with blocked user ${reporterId}`,
              },
            });

            await prisma.adminAuditLog.create({
              data: {
                actedByStaffId: session.staffId,
                action: "DEVICE_BLOCKED",
                targetType: "Device",
                targetId: fp.fingerprintHash,
                metadata: { reason: `Cascade from blocked user ${reporterId}` },
              },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN COMPANY FLAG FAKE ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
