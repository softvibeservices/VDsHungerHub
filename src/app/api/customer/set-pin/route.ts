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
} from "@/lib/customer-auth";
import { cookies } from "next/headers";

/**
 * POST /api/customer/set-pin
 *
 * Step 4 of registration. Also used by forgot-pin/reset flow.
 * Requires valid preAuthToken. Creates full session (access + refresh JWT).
 *
 * Body:
 *   preAuthToken   string
 *   pin            string (6 digits)
 *   confirmPin     string (6 digits)
 *   deviceVisitorId string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { preAuthToken, pin, confirmPin, deviceVisitorId = "" } = body;

    if (!preAuthToken) {
      return NextResponse.json({ error: "preAuthToken is required" }, { status: 400 });
    }

    // ── Verify pre-auth token ─────────────────────────────────────────────────
    const preAuth = verifyPreAuthToken(preAuthToken);
    if (!preAuth) {
      return NextResponse.json(
        { error: "Invalid or expired pre-auth token. Please restart the verification flow." },
        { status: 401 }
      );
    }

    const userId = preAuth.sub;

    // ── Validate PIN ──────────────────────────────────────────────────────────
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

    // ── Fetch user ────────────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, number: true, name: true, isVerified: true },
    });

    if (!user || !user.isVerified) {
      return NextResponse.json(
        { error: "User not found or not verified" },
        { status: 404 }
      );
    }

    // ── Hash and store PIN ────────────────────────────────────────────────────
    const pinHash = await hashPin(pin);
    await prisma.user.update({
      where: { id: userId },
      data: { pinHash, pinFailedAttempts: 0, pinLockedUntil: null },
    });

    // ── Device fingerprint ────────────────────────────────────────────────────
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = getClientIp(req);
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    // Mark device as trusted (completed full registration)
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

    // ── Issue full session ────────────────────────────────────────────────────
    const { accessToken, refreshToken } = await createCustomerSession(
      userId,
      user.number,
      user.name,
      fingerprintHash
    );

    await setCustomerCookies(accessToken, refreshToken);

    // Clear the reg_draft cookie
    const cookieStore = await cookies();
    cookieStore.delete("reg_draft");

    return NextResponse.json({ loggedIn: true });
  } catch (error) {
    console.error("[CUSTOMER SET-PIN]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
