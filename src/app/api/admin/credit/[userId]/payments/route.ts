import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";
import { getUserLedgerDetail } from "@/lib/credit";
import { PaymentMethod } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Administrators can record payments" },
        { status: 403 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await req.json();
    const { amount, method = "CASH", note, paidAtUtc } = body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "Payment amount must be greater than 0" },
        { status: 400 }
      );
    }

    const validMethods: PaymentMethod[] = ["CASH", "UPI", "BANK_TRANSFER", "OTHER"];
    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { error: "Invalid payment method" },
        { status: 400 }
      );
    }

    const paymentDate = paidAtUtc ? new Date(paidAtUtc) : new Date();

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          userId,
          amount: numAmount,
          method,
          note: note ? String(note).trim() : null,
          recordedByStaffId: session.staffId,
          paidAtUtc: paymentDate,
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: session.staffId,
          action: "PAYMENT_RECORDED",
          targetType: "User",
          targetId: userId,
          metadata: { amount: numAmount, method, note },
        },
      }),
    ]);

    const refreshedDetail = await getUserLedgerDetail(userId);

    return NextResponse.json({
      payment,
      detail: refreshedDetail,
    });
  } catch (error) {
    console.error("POST /api/admin/credit/[userId]/payments error:", error);
    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}
