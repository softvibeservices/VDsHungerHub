import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeAndValidateMobile,
  verifyPin,
  computeFingerprintHash,
  createCustomerSession,
  setCustomerCookies,
  checkRateLimit,
  getClientIp,
} from "@/lib/customer-auth";

/**
 * POST /api/customer/login-pin
 *
 * PIN-based login. Works on any device (known or new).
 * Lockout: 5 failures → 15 min. 3 lockouts in 24h → OTP-only for 24h.
 *
 * Body:
 *   mobile          string
 *   pin             string (6 digits)
 *   deviceVisitorId string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mobile: rawMobile, pin, deviceVisitorId = "" } = body;

    // ── Validate mobile ───────────────────────────────────────────────────────
    let mobile: string;
    try {
      mobile = normalizeAndValidateMobile(rawMobile);
    } catch {
      return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
    }

    if (!pin || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ error: "PIN must be 6 digits" }, { status: 400 });
    }

    // ── Rate limit: PIN attempts per IP ───────────────────────────────────────
    const ip = getClientIp(req);
    await checkRateLimit("IP", ip, "LOGIN_PIN_ATTEMPT", 60 * 60 * 1000, 20);

    // ── Fetch user ────────────────────────────────────────────────────────────
    const user = await prisma.user.findFirst({
      where: { number: mobile, isVerified: true },
      select: {
        id: true,
        name: true,
        number: true,
        pinHash: true,
        pinFailedAttempts: true,
        pinLockedUntil: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      // Deliberately vague to prevent number enumeration
      return NextResponse.json({ error: "Invalid number or PIN" }, { status: 401 });
    }

    if (!user.pinHash) {
      return NextResponse.json(
        { error: "No PIN set. Please log in via OTP and set a PIN." },
        { status: 403 }
      );
    }

    // ── Check lockout ─────────────────────────────────────────────────────────
    if (user.pinLockedUntil && user.pinLockedUntil > new Date()) {
      const waitSec = Math.ceil((user.pinLockedUntil.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        { error: `PIN locked. Try again in ${Math.ceil(waitSec / 60)} minute(s).` },
        { status: 429 }
      );
    }

    // ── Check 3-lockout escalation (OTP-only mode) ────────────────────────────
    // Count how many times pinLockedUntil was set in last 24h by checking RateLimitEvents
    const lockoutCount = await prisma.rateLimitEvent.count({
      where: {
        scopeType: "MOBILE",
        scopeKey: mobile,
        action: "LOGIN_PIN_ATTEMPT",
        createdAtUtc: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    // If >= 15 events in 24h (3 lockouts × 5 attempts), force OTP-only
    if (lockoutCount >= 15) {
      return NextResponse.json(
        {
          error: "Too many failed PIN attempts. Please use OTP login for the next 24 hours.",
          forceOtp: true,
        },
        { status: 403 }
      );
    }

    // ── Verify PIN ────────────────────────────────────────────────────────────
    const valid = await verifyPin(pin, user.pinHash);

    if (!valid) {
      const newFailCount = user.pinFailedAttempts + 1;

      if (newFailCount >= 5) {
        // Lock for 15 minutes
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await prisma.user.update({
          where: { id: user.id },
          data: { pinFailedAttempts: newFailCount, pinLockedUntil: lockUntil },
        });
        // Record the lockout event
        await prisma.rateLimitEvent.create({
          data: { scopeType: "MOBILE", scopeKey: mobile, action: "LOGIN_PIN_ATTEMPT" },
        });
        return NextResponse.json(
          { error: "Too many failed attempts. PIN locked for 15 minutes." },
          { status: 429 }
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { pinFailedAttempts: newFailCount },
      });

      return NextResponse.json(
        { error: "Invalid PIN", attemptsRemaining: 5 - newFailCount },
        { status: 401 }
      );
    }

    // ── Success — reset fail counter ──────────────────────────────────────────
    await prisma.user.update({
      where: { id: user.id },
      data: { pinFailedAttempts: 0, pinLockedUntil: null },
    });

    // ── Device fingerprint ────────────────────────────────────────────────────
    const userAgent = req.headers.get("user-agent") ?? "";
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    await prisma.deviceFingerprint.upsert({
      where: { userId_fingerprintHash: { userId: user.id, fingerprintHash } },
      update: { lastSeenAtUtc: new Date() },
      create: {
        userId: user.id,
        fingerprintHash,
        userAgent,
        ipAtFirstSeen: ip,
        isTrusted: false, // PIN alone doesn't auto-trust; becomes trusted after first successful session
      },
    });

    // ── Issue session ─────────────────────────────────────────────────────────
    const { accessToken, refreshToken } = await createCustomerSession(
      user.id,
      user.number,
      user.name,
      fingerprintHash
    );
    await setCustomerCookies(accessToken, refreshToken);

    return NextResponse.json({ loggedIn: true });
  } catch (error: any) {
    if (error?.name === "RateLimitExceededError") {
      return NextResponse.json(
        { error: "Too many attempts from this IP. Please try again later." },
        { status: 429 }
      );
    }
    console.error("[CUSTOMER LOGIN-PIN]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
