import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/customer/companies
 * Returns only CONFIRMED companies, alphabetical, for the registration dropdown.
 * Never leaks PENDING companies.
 */
export async function GET(_req: NextRequest) {
  try {
    const companies = await prisma.company.findMany({
      where: { status: "CONFIRMED", isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ companies });
  } catch (error) {
    console.error("[CUSTOMER COMPANIES GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
