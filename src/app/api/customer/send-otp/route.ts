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
 * POST /api/customer/send-otp
 *
 * Step 2 of registration (also shared by login-otp and forgot-pin flows).
 * Validates mobile, rate-limits on 3 axes, calls Message Central, stores OtpVerification row.
 *
 * Body:
 *   draftId         string   (from reg_draft cookie / register response)
 *   mobile          string   (10-digit Indian)
 *   deviceVisitorId string
 *   purpose?        "REGISTER" | "LOGIN" | "FORGOT_PIN"  (default: REGISTER)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      draftId,
      mobile: rawMobile,
      deviceVisitorId = "",
      purpose = "REGISTER",
    } = body;

    // ── Validate mobile first — before any DB write or provider call ─────────
    let mobile: string;
    try {
      mobile = normalizeAndValidateMobile(rawMobile);
    } catch {
      return NextResponse.json(
        { error: "Invalid mobile number. Must be a valid 10-digit Indian number." },
        { status: 400 }
      );
    }

    if (!["REGISTER", "LOGIN", "FORGOT_PIN"].includes(purpose)) {
      return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
    }

    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") ?? "";
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    // Device fingerprint blocking check
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

    // Map purpose to rate limit action
    const rlAction =
      purpose === "REGISTER"
        ? "SEND_OTP_REGISTER"
        : purpose === "LOGIN"
        ? "SEND_OTP_LOGIN"
        : "SEND_OTP_FORGOT_PIN";

    // ── Rate limits (all checked BEFORE calling the OTP provider) ─────────────
    // 60-second resend cooldown
    await checkResendCooldown(mobile, rlAction);

    // Per-mobile limits
    const mobileWindow = purpose === "FORGOT_PIN" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const mobileMax = purpose === "REGISTER" ? 3 : purpose === "LOGIN" ? 5 : 3;
    await checkRateLimit("MOBILE", mobile, rlAction, mobileWindow, mobileMax);

    // Per-IP limits
    const ipMax = purpose === "REGISTER" ? 5 : purpose === "LOGIN" ? 10 : 5;
    await checkRateLimit("IP", ip, rlAction, 60 * 60 * 1000, ipMax);

    // Per-device limits
    const deviceWindow = 24 * 60 * 60 * 1000;
    const deviceMax = purpose === "REGISTER" ? 10 : purpose === "LOGIN" ? 15 : 5;
    await checkRateLimit("DEVICE", fingerprintHash, rlAction, deviceWindow, deviceMax);

    // ── Business rules ────────────────────────────────────────────────────────

    if (purpose === "REGISTER") {
      // Reject if mobile already belongs to a verified customer
      const alreadyVerified = await prisma.user.findFirst({
        where: { number: mobile, isVerified: true },
        select: { id: true },
      });
      if (alreadyVerified) {
        return NextResponse.json(
          {
            error: "MOBILE_ALREADY_REGISTERED",
            message: "This number is already registered. Please use the Login tab.",
          },
          { status: 409 }
        );
      }

      // Validate draft
      if (!draftId) {
        return NextResponse.json({ error: "draftId is required for registration" }, { status: 400 });
      }

      const draft = await prisma.user.findUnique({
        where: { id: draftId, isVerified: false },
        select: { id: true, status: true, statusReason: true },
      });

      if (!draft) {
        return NextResponse.json(
          { error: "Registration draft not found or already verified" },
          { status: 404 }
        );
      }

      if (draft.status !== "ACTIVE") {
        return NextResponse.json(
          { error: draft.statusReason ?? `Account is ${draft.status.toLowerCase()}.`, code: `USER_${draft.status}` },
          { status: 403 }
        );
      }

      // If there is an existing unverified user with this number (stale draft),
      // delete it to avoid unique constraint violations when we update this draft
      const existingUnverified = await prisma.user.findFirst({
        where: { number: mobile, isVerified: false, NOT: { id: draftId } },
        select: { id: true },
      });
      if (existingUnverified) {
        await prisma.$transaction([
          prisma.customerSession.deleteMany({ where: { userId: existingUnverified.id } }),
          prisma.deviceFingerprint.deleteMany({ where: { userId: existingUnverified.id } }),
          prisma.userDevice.deleteMany({ where: { userId: existingUnverified.id } }),
          prisma.order.deleteMany({ where: { userId: existingUnverified.id } }),
          prisma.address.deleteMany({ where: { userId: existingUnverified.id } }),
          prisma.user.delete({ where: { id: existingUnverified.id } }),
        ]);
      }

      // Update the draft's number placeholder with the real mobile
      await prisma.user.update({
        where: { id: draftId },
        data: { number: mobile },
      });
    }

    if (purpose === "LOGIN") {
      // User must already be verified
      const user = await prisma.user.findFirst({
        where: { number: mobile, isVerified: true },
        select: { id: true, status: true, statusReason: true },
      });
      if (!user) {
        return NextResponse.json(
          { error: "No verified account found for this number. Please register first." },
          { status: 404 }
        );
      }
      if (user.status !== "ACTIVE") {
        return NextResponse.json(
          { error: user.statusReason ?? `Account is ${user.status.toLowerCase()}.`, code: `USER_${user.status}` },
          { status: 403 }
        );
      }
    }

    if (purpose === "FORGOT_PIN") {
      const user = await prisma.user.findFirst({
        where: { number: mobile, isVerified: true },
        select: { id: true, status: true, statusReason: true },
      });
      if (!user) {
        return NextResponse.json(
          { error: "No verified account found for this number." },
          { status: 404 }
        );
      }
      if (user.status !== "ACTIVE") {
        return NextResponse.json(
          { error: user.statusReason ?? `Account is ${user.status.toLowerCase()}.`, code: `USER_${user.status}` },
          { status: 403 }
        );
      }
    }

    // ── Call Message Central ──────────────────────────────────────────────────
    const verificationId = await sendOtp(mobile);

    // ── Store OtpVerification row ─────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Link to userId if known
    let linkedUserId: string | undefined;
    if (purpose === "REGISTER" && draftId) {
      linkedUserId = draftId;
    } else if (purpose === "LOGIN" || purpose === "FORGOT_PIN") {
      const user = await prisma.user.findFirst({
        where: { number: mobile, isVerified: true },
        select: { id: true },
      });
      linkedUserId = user?.id;
    }

    await prisma.otpVerification.create({
      data: {
        mobile,
        purpose: purpose as "REGISTER" | "LOGIN" | "FORGOT_PIN",
        verificationId,
        userId: linkedUserId ?? null,
        expiresAtUtc: expiresAt,
      },
    });

    return NextResponse.json({
      otpSent: true,
      expiresInSeconds: 300,
    });
  } catch (error: any) {
    if (error?.name === "RateLimitExceededError") {
      return NextResponse.json(
        { error: "Too many OTP requests. Please wait before trying again." },
        { status: 429 }
      );
    }
    if (error?.name === "MessageCentralError") {
      console.error("[SEND-OTP] Message Central error:", error.message);
      return NextResponse.json(
        { error: "Failed to send OTP. Please try again." },
        { status: 502 }
      );
    }
    console.error("[CUSTOMER SEND-OTP]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
