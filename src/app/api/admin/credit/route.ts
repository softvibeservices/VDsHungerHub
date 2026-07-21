import { NextRequest, NextResponse } from "next/server";
import { verifyStaffSession } from "@/lib/staff-auth";
import { getAllUsersLedger, LedgerFilters } from "@/lib/credit";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Administrators can access credit ledger" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const filters: LedgerFilters = {
      search: searchParams.get("search") || undefined,
      companyId: searchParams.get("companyId") || undefined,
      balanceFilter: (searchParams.get("balanceFilter") as LedgerFilters["balanceFilter"]) || undefined,
      sortBy: (searchParams.get("sortBy") as LedgerFilters["sortBy"]) || undefined,
    };

    const rows = await getAllUsersLedger(filters);

    const totalOwed = rows.reduce(
      (sum, r) => sum + (r.balance > 0 ? r.balance : 0),
      0
    );
    const totalCollected = rows.reduce((sum, r) => sum + r.totalPaid, 0);
    const customersOwing = rows.filter((r) => r.balance > 0).length;

    return NextResponse.json({
      rows,
      totals: {
        totalOwed: Math.round(totalOwed * 100) / 100,
        totalCollected: Math.round(totalCollected * 100) / 100,
        customersOwing,
        userCount: rows.length,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/credit error:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit ledger data" },
      { status: 500 }
    );
  }
}
