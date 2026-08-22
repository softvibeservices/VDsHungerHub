// src\app\api\customer\send-otp\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeAndValidateMobile,
  checkRateLimit,
  checkResendCooldown,
  computeFingerprintHash,
  getClientIp,
  formatRateLimitWaitTime,
} from "@/lib/customer-auth";
// No MSG91 import needed here — the Widget JS on the frontend sends the OTP directly.
// This route is a rate-limiter / preflight validator only.

/**
 * POST /api/customer/send-otp
 *
 * Preflight step for OTP flows (REGISTER / FORGOT_PIN). Does NOT call MSG91 —
 * the MSG91 Widget JS on the frontend triggers the SMS via window.sendOTP().
 *
 * Responsibilities: validate mobile, enforce 3-axis rate limits, check registration
 * state, create OtpVerification row. Returns { otpSent: true } on success so the
 * frontend knows it can proceed to call window.sendOTP().
 *
 * Body:
 *   draftId?        string   (optional — auto-resolved by mobile if omitted for REGISTER)
 *   mobile          string   (10-digit Indian)
 *   deviceVisitorId string
 *   purpose?        "REGISTER" | "FORGOT_PIN"  (default: REGISTER; LOGIN is disabled)
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

    if (purpose === "LOGIN") {
      return NextResponse.json(
        { error: "OTP login is disabled. Please log in with your PIN or use Forgot PIN to reset." },
        { status: 400 }
      );
    }

    if (!["REGISTER", "FORGOT_PIN"].includes(purpose)) {
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
        : "SEND_OTP_FORGOT_PIN";

    // ── Rate limits (all checked BEFORE calling the OTP provider) ─────────────
    // 60-second resend cooldown per mobile
    await checkResendCooldown(mobile, rlAction);

    // Per-mobile limits — generous thresholds for smooth user experience
    const mobileWindow = purpose === "FORGOT_PIN" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
    const mobileMax = purpose === "REGISTER" ? 30 : 20;
    await checkRateLimit("MOBILE", mobile, rlAction, mobileWindow, mobileMax);

    // Per-IP limits (Registration: 30 / hr, Forgot PIN: 100 / hr)
    const ipMax = purpose === "REGISTER" ? 30 : 100;
    await checkRateLimit("IP", ip, rlAction, 60 * 60 * 1000, ipMax);

    // Per-device limits (Registration: 50 / day, Forgot PIN: 15 / day)
    const deviceWindow = 24 * 60 * 60 * 1000;
    const deviceMax = purpose === "REGISTER" ? 50 : 15;
    await checkRateLimit("DEVICE", fingerprintHash, rlAction, deviceWindow, deviceMax);



    // ── Business rules ────────────────────────────────────────────────────────
    // resolvedDraftId is declared here (outer scope) so it is accessible when
    // building the OtpVerification row after the purpose-specific blocks.
    let resolvedDraftId: string | undefined;

    if (purpose === "REGISTER") {
      // Reject if mobile already belongs to a fully verified customer WITH a PIN
      const alreadyComplete = await prisma.user.findFirst({
        where: { number: mobile, isVerified: true, NOT: { pinHash: null } },
        select: { id: true },
      });
      if (alreadyComplete) {
        return NextResponse.json(
          {
            error: "MOBILE_ALREADY_REGISTERED",
            message: "This number is already registered. Please use the Login tab.",
          },
          { status: 409 }
        );
      }

      // If verified but NO PIN yet, reject with a specific code so frontend can redirect to PIN setup
      const verifiedNoPIN = await prisma.user.findFirst({
        where: { number: mobile, isVerified: true, pinHash: null },
        select: { id: true },
      });
      if (verifiedNoPIN) {
        return NextResponse.json(
          {
            error: "MOBILE_ALREADY_REGISTERED",
            code: "VERIFIED_NO_PIN",
            message: "Your mobile is already verified. Please set your PIN to complete registration.",
          },
          { status: 409 }
        );
      }

      // Resolve draftId — either from request body or auto-found by mobile number
      resolvedDraftId = draftId;
      if (!resolvedDraftId) {
        const draftByMobile = await prisma.user.findFirst({
          where: { number: mobile, isVerified: false },
          select: { id: true, status: true, statusReason: true },
        });
        if (!draftByMobile) {
          return NextResponse.json(
            { error: "No pending registration found for this number. Please start a new registration." },
            { status: 404 }
          );
        }
        resolvedDraftId = draftByMobile.id;
      }

      const draft = await prisma.user.findUnique({
        where: { id: resolvedDraftId, isVerified: false },
        select: { id: true, status: true, statusReason: true },
      });

      if (!draft) {
        return NextResponse.json(
          { error: "No pending registration found for this number. Please start a new registration." },
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
        where: { number: mobile, isVerified: false, NOT: { id: resolvedDraftId } },
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
        where: { id: resolvedDraftId },
        data: { number: mobile },
      });
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

    // ── Store OtpVerification row (Widget sends SMS from frontend) ───────────────
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Link to userId if known.
    // IMPORTANT: resolvedDraftId is hoisted from the REGISTER block above so we can
    // reference it here. Using the raw `draftId` from the request body was wrong —
    // that value is often "" when the user navigates to /verify directly, which caused
    // userId=null on the OtpVerification row and verify-otp returning 404 "Draft user not found".
    let linkedUserId: string | undefined;
    if (purpose === "REGISTER" && resolvedDraftId) {
      linkedUserId = resolvedDraftId;
    } else if (purpose === "FORGOT_PIN") {
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
        providerRef: null, // Widget sends OTP from frontend; no server-side send reference
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
      const waitTime = error.waitTimeMs ? formatRateLimitWaitTime(error.waitTimeMs) : "a moment";
      const waitSec = error.waitTimeMs ? Math.ceil(error.waitTimeMs / 1000) : 60;
      return NextResponse.json(
        {
          error: `Please wait ${waitTime} before requesting another OTP.`,
          waitSeconds: waitSec,
        },
        { status: 429 }
      );
    }
    // No MSG91 error to catch here — widget sends OTP from frontend.
    console.error("[CUSTOMER SEND-OTP]", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
