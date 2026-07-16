import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, formatRateLimitWaitTime } from "@/lib/customer-auth";

/**
 * GET /api/customer/registration/status?mobile=9825012345
 *
 * §6.8 — Resume / Verify Account
 * Handles the "closed the tab mid-registration" case.
 *
 * Rate-limited to prevent mobile enumeration attacks.
 * Always returns generic 200 if mobile not found (enumeration protection).
 *
 * Returns:
 *   { registrationStep, nextAction }
 *   - nextAction: "OTP_VERIFY" | "PIN_SETUP" | "LOGIN" | "REGISTER"
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mobile = searchParams.get("mobile")?.trim() ?? "";
    const draftId = searchParams.get("draftId")?.trim() ?? "";

    // Basic mobile validation
    if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
      return NextResponse.json(
        { error: "Valid 10-digit Indian mobile number required" },
        { status: 400 }
      );
    }

    // Rate limit per IP to prevent enumeration
    const ip = getClientIp(req);
    await checkRateLimit("IP", ip, "VERIFY_OTP", 15 * 60 * 1000, 10);

    // If no draftId is provided, do not query the DB. Return a generic response (enumeration protection)
    if (!draftId) {
      return NextResponse.json({
        registrationStep: null,
        nextAction: "REGISTER",
        message: "No active registration draft found.",
      });
    }

    // Look up user by mobile and draftId (proves intent/ownership)
    const user = await prisma.user.findFirst({
      where: { number: mobile, id: draftId },
      select: {
        id: true,
        isVerified: true,
        pinHash: true,
        status: true,
        statusReason: true,
      },
    });

    // If no user found: return generic response (enumeration protection)
    if (!user) {
      return NextResponse.json({
        registrationStep: null,
        nextAction: "REGISTER",
        message: "No account found for this number. Please register.",
      });
    }

    // If user is blocked/banned: reject clearly
    if (user.status === "BLOCKED") {
      return NextResponse.json(
        {
          error: user.statusReason ?? "Your account is temporarily restricted.",
          code: "USER_BLOCKED",
        },
        { status: 403 }
      );
    }

    if (user.status === "BANNED") {
      return NextResponse.json(
        {
          error: user.statusReason ?? "Your account is permanently restricted.",
          code: "USER_BANNED",
        },
        { status: 403 }
      );
    }

    // PIN_SET = fully registered, go to login
    if (user.isVerified && user.pinHash) {
      return NextResponse.json(
        {
          registrationStep: "PIN_SET",
          nextAction: "LOGIN",
          code: "ALREADY_VERIFIED",
          message: "Account is fully registered. Please log in.",
        },
        { status: 409 }
      );
    }

    // OTP_VERIFIED but no PIN yet — go to PIN setup
    if (user.isVerified && !user.pinHash) {
      return NextResponse.json({
        registrationStep: "OTP_VERIFIED",
        nextAction: "PIN_SETUP",
        message: "OTP already verified. Please set your PIN.",
      });
    }

    // DETAILS_SUBMITTED — mobile not yet OTP-verified
    if (!user.isVerified) {
      return NextResponse.json({
        registrationStep: "DETAILS_SUBMITTED",
        nextAction: "OTP_VERIFY",
        message: "Please verify your mobile number via OTP.",
      });
    }

    return NextResponse.json({ registrationStep: null, nextAction: "REGISTER" });
  } catch (error: any) {
    if (error?.name === "RateLimitExceededError") {
      const waitTime = error.waitTimeMs ? formatRateLimitWaitTime(error.waitTimeMs) : "some time";
      return NextResponse.json(
        { error: `Too many status checks. Please try again after ${waitTime}.` },
        { status: 429 }
      );
    }
    console.error("[REGISTRATION STATUS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
