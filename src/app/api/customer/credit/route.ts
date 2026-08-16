// src\app\api\customer\credit\route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerAccessToken, CUSTOMER_ACCESS_COOKIE, checkUserAndDeviceStatus } from "@/lib/customer-auth";
import { getUserLedgerDetail, getEffectiveCreditLimit } from "@/lib/credit";

/**
 * GET /api/customer/credit
 *
 * Returns the authenticated customer's credit details:
 * - balance (current outstanding due)
 * - creditLimit (effective credit limit)
 * - remainingCredit (creditLimit - balance)
 * - totalDebit & totalPaid
 * - payments (history of payments recorded by admin)
 * - timeline (chronological statement of debits and credits)
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claims = verifyCustomerAccessToken(token);
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = claims.sub;

    const statusCheck = await checkUserAndDeviceStatus(userId, claims.fph);
    if (!statusCheck.allowed) {
      return NextResponse.json({ error: statusCheck.message, code: statusCheck.code }, { status: 403 });
    }

    const [ledger, creditLimitInfo] = await Promise.all([
      getUserLedgerDetail(userId),
      getEffectiveCreditLimit(userId),
    ]);

    if (!ledger) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const remainingCredit = Math.max(0, Math.round((creditLimitInfo.limit - ledger.balance) * 100) / 100);

    return NextResponse.json({
      balance: ledger.balance,
      creditLimit: creditLimitInfo.limit,
      remainingCredit,
      totalDebit: ledger.totalDebit,
      totalPaid: ledger.totalPaid,
      payments: ledger.payments,
      timeline: ledger.timeline,
    });
  } catch (error) {
    console.error("[CUSTOMER CREDIT GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
