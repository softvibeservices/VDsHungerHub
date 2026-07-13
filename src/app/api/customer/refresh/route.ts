import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashRefreshToken,
  signCustomerAccessToken,
  generateRefreshToken,
  setCustomerCookies,
  computeFingerprintHash,
  CUSTOMER_REFRESH_COOKIE,
} from "@/lib/customer-auth";

/**
 * POST /api/customer/refresh
 *
 * Silent refresh token rotation.
 * - Validates the refresh token cookie
 * - Detects reuse (replayed revoked token → revokes whole session family)
 * - Issues new access + refresh tokens
 */
export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value;

    if (!cookieHeader) {
      return NextResponse.json({ error: "No refresh token" }, { status: 401 });
    }

    const tokenHash = hashRefreshToken(cookieHeader);

    const session = await prisma.customerSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        user: {
          select: { id: true, number: true, name: true, isVerified: true, isActive: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 401 });
    }

    // Reuse detection: revoked token was presented → nuke entire session family
    if (session.revokedAtUtc) {
      await prisma.customerSession.updateMany({
        where: { userId: session.userId, revokedAtUtc: null },
        data: { revokedAtUtc: new Date() },
      });
      return NextResponse.json(
        { error: "Session compromised. Please log in again." },
        { status: 401 }
      );
    }

    if (session.expiresAtUtc < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    if (!session.user.isVerified || !session.user.isActive) {
      return NextResponse.json({ error: "Account not accessible" }, { status: 403 });
    }

    // Compute current fingerprint
    const userAgent = req.headers.get("user-agent") ?? "";
    const visitorId = req.headers.get("x-visitor-id") ?? "";
    const currentFph = visitorId
      ? computeFingerprintHash(visitorId, userAgent)
      : session.deviceFingerprintHash;

    // Rotate: revoke old, create new
    const newRaw = generateRefreshToken();
    const newHash = hashRefreshToken(newRaw);
    const expiresAt = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000);

    const [, newSession] = await prisma.$transaction([
      prisma.customerSession.update({
        where: { id: session.id },
        data: { revokedAtUtc: new Date() },
      }),
      prisma.customerSession.create({
        data: {
          userId: session.userId,
          refreshTokenHash: newHash,
          deviceFingerprintHash: currentFph,
          expiresAtUtc: expiresAt,
        },
      }),
    ]);

    const accessToken = signCustomerAccessToken(
      session.userId,
      session.user.number,
      session.user.name,
      currentFph
    );

    await setCustomerCookies(accessToken, newRaw);

    return NextResponse.json({ refreshed: true });
  } catch (error) {
    console.error("[CUSTOMER REFRESH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
