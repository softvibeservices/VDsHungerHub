import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCustomerAccessToken, CUSTOMER_ACCESS_COOKIE } from "@/lib/customer-auth";

/**
 * GET /api/customer/me
 *
 * Returns the current customer's profile.
 * NEVER includes latitude/longitude — those are admin-only fields.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const claims = verifyCustomerAccessToken(token);
    if (!claims) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        name: true,
        number: true,
        workAddress: true,
        homeAddress: true,
        isVerified: true,
        verifiedAt: true,
        isActive: true,
        // NEVER select latitude / longitude here
        company: {
          select: { id: true, name: true },
        },
        _count: {
          select: { deviceFingerprints: true },
        },
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error("[CUSTOMER ME]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
