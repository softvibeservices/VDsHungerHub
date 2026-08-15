import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";
import { getEffectiveCreditLimit } from "@/lib/credit";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetUser) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const body = await req.json();
    // `limit: null` (or omitted) clears the override and reverts to the global default.
    let overrideValue: number | null = null;
    if (body.limit !== null && body.limit !== undefined && body.limit !== "") {
      const numLimit = parseFloat(body.limit);
      if (!Number.isFinite(numLimit) || numLimit <= 0) {
        return NextResponse.json(
          { error: "Credit limit must be a positive number, or null to reset to the default." },
          { status: 400 }
        );
      }
      overrideValue = numLimit;
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { creditLimitOverride: overrideValue } }),
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: session.staffId,
          action: "CREDIT_LIMIT_OVERRIDE_UPDATED",
          targetType: "User",
          targetId: userId,
          metadata: { newOverride: overrideValue },
        },
      }),
    ]);

    const effective = await getEffectiveCreditLimit(userId);
    return NextResponse.json({ success: true, ...effective });
  } catch (error) {
    console.error("[ADMIN CREDIT LIMIT OVERRIDE PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
