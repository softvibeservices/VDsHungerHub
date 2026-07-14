import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeAndValidateMobile,
  checkRateLimit,
  checkResendCooldown,
  computeFingerprintHash,
  getClientIp,
} from "@/lib/customer-auth";
import { sendOtp } from "@/lib/message-central";

/**
 * POST /api/customer/forgot-pin/send-otp
 *
 * Enumeration protection: always returns the same generic 200 regardless of
 * whether the mobile exists, but only dispatches an SMS when it does.
 * Capped at 3 forgot-PIN sends per mobile per 24h (§4.2 / §6.7).
 *
 * Body:
 *   mobile          string  (10-digit Indian)
 *   deviceVisitorId string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mobile: rawMobile, deviceVisitorId = "" } = body;

    let mobile: string;
    try {
      mobile = normalizeAndValidateMobile(rawMobile);
    } catch {
      return NextResponse.json(
        { error: "Invalid mobile number." },
        { status: 400 }
      );
    }

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") ?? "";
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    // Device blocking check
    const blockedDevice = await prisma.deviceFingerprint.findFirst({
      where: { fingerprintHash, isBlocked: true },
      select: { blockedReason: true },
    });
    if (blockedDevice) {
      // Still return generic 200 — enumeration protection (don't leak which devices are blocked)
      return NextResponse.json({ message: "If this number is registered, a code has been sent." });
    }

    // Rate limits
    try {
      await checkResendCooldown(mobile, "SEND_OTP_FORGOT_PIN");
      await checkRateLimit("MOBILE", mobile, "SEND_OTP_FORGOT_PIN", 24 * 60 * 60 * 1000, 3);
      await checkRateLimit("IP", ip, "SEND_OTP_FORGOT_PIN", 60 * 60 * 1000, 5);
      await checkRateLimit("DEVICE", fingerprintHash, "SEND_OTP_FORGOT_PIN", 24 * 60 * 60 * 1000, 5);
    } catch {
      // On rate limit, still return generic message to prevent enumeration
      return NextResponse.json(
        { error: "Too many requests. Please wait before trying again." },
        { status: 429 }
      );
    }

    // Enumeration protection: look up user but don't reveal if found
    const user = await prisma.user.findFirst({
      where: { number: mobile, isVerified: true, status: "ACTIVE" },
      select: { id: true },
    });

    // Only actually dispatch OTP if user exists and is active
    if (user) {
      try {
        const verificationId = await sendOtp(mobile);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        await prisma.otpVerification.create({
          data: {
            mobile,
            purpose: "FORGOT_PIN",
            verificationId,
            userId: user.id,
            expiresAtUtc: expiresAt,
          },
        });
      } catch (err) {
        console.error("[FORGOT-PIN SEND-OTP] Failed to send OTP:", err);
        // Don't surface the error — return generic message
      }
    }

    // Always return the same message regardless (§6.7 enumeration protection)
    return NextResponse.json({
      message: "If this number is registered, a code has been sent.",
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error("[FORGOT-PIN SEND-OTP]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
