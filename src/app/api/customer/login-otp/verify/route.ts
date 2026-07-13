import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPreAuthToken,
  computeFingerprintHash,
  createCustomerSession,
  setCustomerCookies,
  getClientIp,
} from "@/lib/customer-auth";

/**
 * POST /api/customer/login-otp/verify
 *
 * Final step for OTP-based login.
 * Receives the preAuthToken issued by /api/customer/verify-otp (purpose=LOGIN)
 * and creates a full session.
 *
 * Body:
 *   preAuthToken    string
 *   deviceVisitorId string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { preAuthToken, deviceVisitorId = "" } = body;

    if (!preAuthToken) {
      return NextResponse.json({ error: "preAuthToken is required" }, { status: 400 });
    }

    const preAuth = verifyPreAuthToken(preAuthToken);
    if (!preAuth) {
      return NextResponse.json(
        { error: "Invalid or expired pre-auth token" },
        { status: 401 }
      );
    }

    const userId = preAuth.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, number: true, name: true, isVerified: true, isActive: true },
    });

    if (!user || !user.isVerified || !user.isActive) {
      return NextResponse.json({ error: "User not found or inactive" }, { status: 404 });
    }

    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = getClientIp(req);
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    await prisma.deviceFingerprint.upsert({
      where: { userId_fingerprintHash: { userId, fingerprintHash } },
      update: { isTrusted: true, lastSeenAtUtc: new Date() },
      create: {
        userId,
        fingerprintHash,
        userAgent,
        ipAtFirstSeen: ip,
        isTrusted: true,
      },
    });

    // Reset PIN lock state since user proved identity via OTP
    await prisma.user.update({
      where: { id: userId },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });

    const { accessToken, refreshToken } = await createCustomerSession(
      userId,
      user.number,
      user.name,
      fingerprintHash
    );

    await setCustomerCookies(accessToken, refreshToken);

    return NextResponse.json({ loggedIn: true });
  } catch (error) {
    console.error("[CUSTOMER LOGIN-OTP VERIFY]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
