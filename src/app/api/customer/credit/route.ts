// src\app\api\customer\credit\route.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyCustomerAccessToken, CUSTOMER_ACCESS_COOKIE, checkUserAndDeviceStatus } from "@/lib/customer-auth";
import { getUserLedgerDetail, getEffectiveCreditLimit } from "@/lib/credit";

/**
 * GET /api/customer/credit
 *
 * Query Params:
 * - startDate? string (YYYY-MM-DD)
 * - endDate? string (YYYY-MM-DD)
 * - type? "ALL" | "DEBIT" | "CREDIT"
 * - page? number (default 1)
 * - limit? number (default 10)
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

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const type = (searchParams.get("type")?.toUpperCase() || "ALL") as "ALL" | "DEBIT" | "CREDIT";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") || "10", 10)));

    const [ledger, creditLimitInfo] = await Promise.all([
      getUserLedgerDetail(userId, startDate, endDate),
      getEffectiveCreditLimit(userId),
    ]);

    if (!ledger) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let filteredTimeline = ledger.timeline;
    if (type === "DEBIT") {
      filteredTimeline = filteredTimeline.filter((item) => item.type === "DEBIT");
    } else if (type === "CREDIT") {
      filteredTimeline = filteredTimeline.filter((item) => item.type === "CREDIT");
    }

    const totalItems = filteredTimeline.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));
    const startIndex = (page - 1) * limit;
    const paginatedTimeline = filteredTimeline.slice(startIndex, startIndex + limit);

    const remainingCredit = Math.max(0, Math.round((creditLimitInfo.limit - ledger.balance) * 100) / 100);

    return NextResponse.json({
      balance: ledger.balance,
      creditLimit: creditLimitInfo.limit,
      remainingCredit,
      totalDebit: ledger.totalDebit,
      totalPaid: ledger.totalPaid,
      payments: ledger.payments,
      timeline: paginatedTimeline,
      pagination: {
        page,
        limit,
        totalItems,
        totalPages,
      },
    });
  } catch (error) {
    console.error("[CUSTOMER CREDIT GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
