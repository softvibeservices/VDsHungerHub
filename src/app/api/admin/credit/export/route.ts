import { NextRequest, NextResponse } from "next/server";
import { verifyStaffSession } from "@/lib/staff-auth";
import { getAllUsersLedger, LedgerFilters } from "@/lib/credit";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only Administrators can export credit ledger" },
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

    return NextResponse.json({ rows });
  } catch (error) {
    console.error("GET /api/admin/credit/export error:", error);
    return NextResponse.json(
      { error: "Failed to fetch export data" },
      { status: 500 }
    );
  }
}
