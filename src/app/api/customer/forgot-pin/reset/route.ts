import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPreAuthToken,
  validatePin,
  hashPin,
  computeFingerprintHash,
  createCustomerSession,
  setCustomerCookies,
  getClientIp,
  checkRateLimit,
  formatRateLimitWaitTime,
} from "@/lib/customer-auth";

/**
 * POST /api/customer/forgot-pin/reset
 *
 * Final step of forgot-PIN flow.
 * Requires valid preAuthToken (issued by verify-otp with purpose=FORGOT_PIN).
 * Overwrites the existing pinHash. Capped at 3 resets per mobile per day.
 *
 * Body:
 *   preAuthToken    string
 *   pin             string (6 digits)
 *   confirmPin      string (6 digits)
 *   deviceVisitorId string
 *   mobile          string (needed to rate-limit)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { preAuthToken, pin, confirmPin, deviceVisitorId = "", mobile } = body;

    if (!preAuthToken) {
      return NextResponse.json({ error: "preAuthToken is required" }, { status: 400 });
    }

    const preAuth = verifyPreAuthToken(preAuthToken);
    if (!preAuth) {
      return NextResponse.json(
        { error: "Invalid or expired token. Please restart the forgot-PIN flow." },
        { status: 401 }
      );
    }

    const userId = preAuth.sub;

    // Rate limit: 3 resets per mobile per day
    if (mobile) {
      await checkRateLimit("MOBILE", mobile, "SEND_OTP_FORGOT_PIN", 24 * 60 * 60 * 1000, 3);
    }

    // Validate PINs
    if (!pin || !confirmPin) {
      return NextResponse.json({ error: "pin and confirmPin are required" }, { status: 400 });
    }
    if (pin !== confirmPin) {
      return NextResponse.json({ error: "PINs do not match" }, { status: 400 });
    }
    try {
      validatePin(pin);
    } catch {
      return NextResponse.json(
        { error: "PIN is too simple. Choose a less predictable 6-digit number." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, number: true, name: true, isVerified: true, isActive: true },
    });

    if (!user || !user.isVerified || !user.isActive) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const pinHash = await hashPin(pin);

    await prisma.user.update({
      where: { id: userId },
      data: { pinHash, pinFailedAttempts: 0, pinLockedUntil: null },
    });

    // Issue a new session
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = getClientIp(req);
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    await prisma.deviceFingerprint.upsert({
      where: { userId_fingerprintHash: { userId, fingerprintHash } },
      update: { isTrusted: true, lastSeenAtUtc: new Date() },
      create: { userId, fingerprintHash, userAgent, ipAtFirstSeen: ip, isTrusted: true },
    });

    const { accessToken, refreshToken } = await createCustomerSession(
      userId,
      user.number,
      user.name,
      fingerprintHash
    );
    await setCustomerCookies(accessToken, refreshToken);

    return NextResponse.json({ pinReset: true, loggedIn: true });
  } catch (error: any) {
    if (error?.name === "RateLimitExceededError") {
      const waitTime = error.waitTimeMs ? formatRateLimitWaitTime(error.waitTimeMs) : "some time";
      return NextResponse.json(
        { error: `Too many PIN reset attempts. Please try again after ${waitTime}.` },
        { status: 429 }
      );
    }
    console.error("[FORGOT-PIN RESET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
