import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashRefreshToken,
  clearCustomerCookies,
  verifyCustomerAccessToken,
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
} from "@/lib/customer-auth";

/**
 * POST /api/customer/logout
 * Revokes the current session's refresh token and clears all auth cookies.
 */
export async function POST(req: NextRequest) {
  try {
    const refreshRaw = req.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value;

    if (refreshRaw) {
      const tokenHash = hashRefreshToken(refreshRaw);
      await prisma.customerSession
        .update({
          where: { refreshTokenHash: tokenHash },
          data: { revokedAtUtc: new Date() },
        })
        .catch(() => {
          // Session may already be gone — ignore
        });
    }

    await clearCustomerCookies();

    return NextResponse.json({ loggedOut: true });
  } catch (error) {
    console.error("[CUSTOMER LOGOUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
