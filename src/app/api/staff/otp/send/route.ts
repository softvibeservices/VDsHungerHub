import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOtp, MessageCentralError } from "@/lib/message-central";
import {
  checkRateLimit,
  checkResendCooldown,
  computeFingerprintHash,
  getClientIp,
  formatRateLimitWaitTime,
} from "@/lib/customer-auth";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function normalizeMobile(raw: string): string {
  const clean = String(raw).replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");
  if (!/^[6-9]\d{9}$/.test(clean)) throw new Error("INVALID_MOBILE");
  return clean;
}

export async function POST(req: NextRequest) {
  try {
    const { mobile: rawMobile, deviceVisitorId = "" } = await req.json();

    let mobile: string;
    try {
      mobile = normalizeMobile(rawMobile);
    } catch {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
    }

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") ?? "";
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    // 1. Device fingerprint blocking check
    if (fingerprintHash) {
      const blockedDevice = await prisma.deviceFingerprint.findFirst({
        where: { fingerprintHash, isBlocked: true },
        select: { blockedReason: true },
      });
      if (blockedDevice) {
        return NextResponse.json(
          { error: blockedDevice.blockedReason ?? "This device has been restricted.", code: "DEVICE_BLOCKED" },
          { status: 403 }
        );
      }
    }

    // 2. Strict Rate Limits on 3 Axes (checked BEFORE calling provider or dummy path)
    const rlAction = "SEND_OTP_STAFF_LOGIN";

    // 60-second cooldown
    await checkResendCooldown(mobile, rlAction);

    // Per-mobile limits (5 sends per hour)
    await checkRateLimit("MOBILE", mobile, rlAction, 60 * 60 * 1000, 5);

    // Per-IP limits (15 sends per hour)
    await checkRateLimit("IP", ip, rlAction, 60 * 60 * 1000, 15);

    // Per-device limits (10 sends per day)
    await checkRateLimit("DEVICE", fingerprintHash, rlAction, 24 * 60 * 60 * 1000, 10);

    // 3. Find staff user
    const staff = await prisma.staffUser.findUnique({ where: { mobile } });

    // Dummy path for invalid/inactive staff to prevent user enumeration
    if (!staff || staff.status !== "ACTIVE") {
      await prisma.staffOtpAttempt.create({
        data: {
          mobile,
          verificationId: "no-account",
          ip,
          userAgent,
          expiresAtUtc: new Date(Date.now() + OTP_TTL_MS),
        },
      });
      return NextResponse.json({ message: "If this number is registered, an OTP has been sent." });
    }

    // 4. Send actual OTP
    const verificationId = await sendOtp(mobile, 6);

    await prisma.staffOtpAttempt.create({
      data: {
        mobile,
        verificationId,
        ip,
        userAgent,
        expiresAtUtc: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    return NextResponse.json({ message: "If this number is registered, an OTP has been sent." });
  } catch (error: any) {
    if (error?.name === "RateLimitExceededError") {
      const waitTime = error.waitTimeMs ? formatRateLimitWaitTime(error.waitTimeMs) : "some time";
      return NextResponse.json(
        { error: `Too many OTP requests. Please try again after ${waitTime}.` },
        { status: 429 }
      );
    }
    if (error instanceof MessageCentralError) {
      console.error("[STAFF OTP SEND] Message Central error:", error.message, error.responseBody);
      return NextResponse.json({ error: "Could not send OTP right now. Please try again." }, { status: 502 });
    }
    console.error("[STAFF OTP SEND]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
