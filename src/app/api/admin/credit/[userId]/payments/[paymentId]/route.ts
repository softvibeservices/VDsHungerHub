import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";
import { getUserLedgerDetail } from "@/lib/credit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; paymentId: string }> }
) {
  try {
    const { userId, paymentId } = await params;
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Administrators can delete payments" },
        { status: 403 }
      );
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!existingPayment || existingPayment.userId !== userId) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.payment.delete({
        where: { id: paymentId },
      }),
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: session.staffId,
          action: "PAYMENT_DELETED",
          targetType: "User",
          targetId: userId,
          metadata: { paymentId, amount: existingPayment.amount },
        },
      }),
    ]);

    const refreshedDetail = await getUserLedgerDetail(userId);

    return NextResponse.json({
      success: true,
      detail: refreshedDetail,
    });
  } catch (error) {
    console.error("DELETE /api/admin/credit/[userId]/payments/[paymentId] error:", error);
    return NextResponse.json(
      { error: "Failed to delete payment" },
      { status: 500 }
    );
  }
}
