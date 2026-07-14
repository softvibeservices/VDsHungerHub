import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  normalizeAndValidateMobile,
  signPreAuthToken,
} from "@/lib/customer-auth";
import { verifyOtp } from "@/lib/message-central";

/**
 * POST /api/customer/forgot-pin/verify-otp
 *
 * Step 2 of forgot-PIN flow. Verifies the OTP sent by send-otp.
 * On success issues a short-lived `preAuthToken` (10-min JWT) required
 * to call /api/customer/forgot-pin/reset.
 *
 * Body:
 *   mobile  string  (10-digit Indian)
 *   otp     string  (6 digits)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mobile: rawMobile, otp } = body;

    if (!rawMobile || !otp) {
      return NextResponse.json(
        { error: "mobile and otp are required" },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: "OTP must be exactly 6 digits" },
        { status: 400 }
      );
    }

    let mobile: string;
    try {
      mobile = normalizeAndValidateMobile(rawMobile);
    } catch {
      return NextResponse.json(
        { error: "Invalid mobile number." },
        { status: 400 }
      );
    }

    // Find the active OTP verification row for FORGOT_PIN
    const otpRow = await prisma.otpVerification.findFirst({
      where: {
        mobile,
        purpose: "FORGOT_PIN",
        consumedAtUtc: null,
        expiresAtUtc: { gte: new Date() },
      },
      orderBy: { createdAtUtc: "desc" },
    });

    if (!otpRow) {
      return NextResponse.json(
        {
          error: "No active OTP found. Please request a new code.",
          code: "OTP_EXPIRED",
        },
        { status: 404 }
      );
    }

    // Attempt cap: max 5 per OTP row
    if (otpRow.attempts >= 5) {
      await prisma.otpVerification.update({
        where: { id: otpRow.id },
        data: { consumedAtUtc: new Date() },
      });
      return NextResponse.json(
        {
          error: "Too many incorrect attempts. Please request a new OTP.",
          code: "OTP_MAX_ATTEMPTS",
        },
        { status: 429 }
      );
    }

    // Increment attempt counter before calling provider
    await prisma.otpVerification.update({
      where: { id: otpRow.id },
      data: { attempts: { increment: 1 } },
    });

    // Verify with Message Central
    try {
      await verifyOtp(otpRow.verificationId, otp);
    } catch {
      const updatedAttempts = otpRow.attempts + 1;
      if (updatedAttempts >= 5) {
        await prisma.otpVerification.update({
          where: { id: otpRow.id },
          data: { consumedAtUtc: new Date() },
        });
        return NextResponse.json(
          {
            error: "Incorrect OTP. Too many attempts. Please request a new OTP.",
            code: "OTP_MAX_ATTEMPTS",
          },
          { status: 429 }
        );
      }
      return NextResponse.json(
        {
          error: "Incorrect OTP. Please try again.",
          code: "OTP_INVALID",
          attemptsRemaining: 5 - updatedAttempts,
        },
        { status: 401 }
      );
    }

    // Mark OTP as consumed
    await prisma.otpVerification.update({
      where: { id: otpRow.id },
      data: { consumedAtUtc: new Date() },
    });

    // Find the user
    const user = await prisma.user.findFirst({
      where: { number: mobile, isVerified: true },
      select: { id: true, status: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: `Account is ${user.status.toLowerCase()}.`, code: `USER_${user.status}` },
        { status: 403 }
      );
    }

    // Issue short-lived pre-auth token (10 min) gating the reset step
    const preAuthToken = signPreAuthToken(user.id);

    return NextResponse.json({
      verified: true,
      preAuthToken,
      nextStep: "RESET_PIN",
    });
  } catch (error) {
    console.error("[FORGOT-PIN VERIFY-OTP]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
