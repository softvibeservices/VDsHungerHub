import { NextRequest, NextResponse } from "next/server";
import { verifyStaffSession } from "@/lib/staff-auth";
import { getUserLedgerDetail } from "@/lib/credit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Administrators can access credit ledger" },
        { status: 403 }
      );
    }

    const detail = await getUserLedgerDetail(userId);
    if (!detail) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    console.error("GET /api/admin/credit/[userId] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user ledger details" },
      { status: 500 }
    );
  }
}
