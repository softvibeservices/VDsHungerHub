import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;

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

    // Update company in transaction
    const [updatedCompany] = await prisma.$transaction([
      prisma.company.update({
        where: { id: companyId },
        data: {
          status: "CONFIRMED",
          isVerifiedByAdmin: true,
          confirmedAtUtc: new Date(),
        },
      }),
      prisma.adminAuditLog.create({
        data: {
          actedByStaffId: session.staffId,
          action: "COMPANY_VERIFIED",
          targetType: "Company",
          targetId: companyId,
        },
      }),
    ]);

    return NextResponse.json({ success: true, company: updatedCompany });
  } catch (error) {
    console.error("[ADMIN COMPANY VERIFY ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
