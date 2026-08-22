// src\app\api\customer\verify-otp\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signPreAuthToken } from "@/lib/customer-auth";
import { verifyWidgetToken, Msg91Error } from "@/lib/msg91";

/**
 * POST /api/customer/verify-otp
 *
 * Step 3 of registration. Also used for forgot-pin.
 * Accepts the JWT access token returned by the MSG91 OTP Widget (window.verifyOTP)
 * and validates it with MSG91's verifyAccessToken endpoint.
 *
 * Body:
 *   mobile       string   (10-digit Indian)
 *   widgetToken  string   (JWT from MSG91 widget success callback)
 *   purpose?     "REGISTER" | "FORGOT_PIN" (default: REGISTER; LOGIN disabled)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mobile, widgetToken, purpose = "REGISTER" } = body;

    if (!mobile || !widgetToken) {
      return NextResponse.json({ error: "mobile and widgetToken are required" }, { status: 400 });
    }

    if (typeof widgetToken !== "string" || widgetToken.trim() === "") {
      return NextResponse.json({ error: "widgetToken must be a non-empty string" }, { status: 400 });
    }

    // ── Find the active OtpVerification row ───────────────────────────────────
    const otpRow = await prisma.otpVerification.findFirst({
      where: {
        mobile,
        purpose: purpose as "REGISTER" | "LOGIN" | "FORGOT_PIN",
        consumedAtUtc: null,
        expiresAtUtc: { gte: new Date() },
      },
      orderBy: { createdAtUtc: "desc" },
    });

    if (!otpRow) {
      return NextResponse.json(
        { error: "No active OTP found. Please request a new one." },
        { status: 404 }
      );
    }

    // ── Attempt cap: max 5 per OTP row ────────────────────────────────────────
    if (otpRow.attempts >= 5) {
      // Already exhausted — mark consumed to prevent further use
      await prisma.otpVerification.update({
        where: { id: otpRow.id },
        data: { consumedAtUtc: new Date() },
      });
      return NextResponse.json(
        { error: "Too many incorrect attempts. Please request a new OTP." },
        { status: 429 }
      );
    }

    // Increment attempt counter before calling provider
    await prisma.otpVerification.update({
      where: { id: otpRow.id },
      data: { attempts: { increment: 1 } },
    });

    // ── Validate widget token with MSG91 ──────────────────────────────────
    // MSG91 validates the token and returns the verified mobile number.
    // We cross-check it matches the claimed mobile to prevent token hijacking.
    let verifiedMobile: string;
    try {
      verifiedMobile = await verifyWidgetToken(widgetToken);
    } catch (err: any) {
      console.warn("[CUSTOMER VERIFY-OTP] Widget token validation failed:", err.message);
      return NextResponse.json(
        { error: "Invalid or expired OTP. Please request a new code." },
        { status: 401 }
      );
    }

    if (verifiedMobile !== mobile) {
      console.warn(
        `[CUSTOMER VERIFY-OTP] Mobile mismatch: claimed=${mobile} verified=${verifiedMobile}`
      );
      return NextResponse.json(
        { error: "Mobile number mismatch. Please request a new OTP." },
        { status: 400 }
      );
    }

    // ── OTP verified! Now handle each purpose ─────────────────────────────────

    // Mark OTP as consumed
    await prisma.otpVerification.update({
      where: { id: otpRow.id },
      data: { consumedAtUtc: new Date() },
    });

    if (purpose === "REGISTER") {
      // Find the draft user linked to this OTP
      const userId = otpRow.userId;
      if (!userId) {
        return NextResponse.json({ error: "Draft user not found" }, { status: 404 });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });

      if (!user) {
        return NextResponse.json({ error: "Draft user not found" }, { status: 404 });
      }

      // OTP is verified and consumed above.
      // isVerified is NOT set here — it is set atomically in /api/customer/set-pin
      // together with the PIN hash. This guarantees a user is never marked as
      // verified unless they have completed BOTH OTP verification AND PIN creation.
      const preAuthToken = signPreAuthToken(userId, "REGISTER");

      return NextResponse.json({
        verified: true,
        nextStep: "SET_PIN",
        preAuthToken,
      });
    }

    if (purpose === "LOGIN") {
      return NextResponse.json(
        { error: "OTP login is disabled. Please log in with your PIN or use Forgot PIN to reset." },
        { status: 400 }
      );
    }

    if (purpose === "FORGOT_PIN") {
      const user = await prisma.user.findFirst({
        where: { number: mobile, isVerified: true },
        select: { id: true, status: true },
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (user.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Account is blocked or inactive. Please contact support." },
          { status: 403 }
        );
      }

      const preAuthToken = signPreAuthToken(user.id, "RESET_PIN");
      return NextResponse.json({ verified: true, preAuthToken, nextStep: "RESET_PIN" });
    }

    return NextResponse.json({ error: "Unknown purpose" }, { status: 400 });
  } catch (error) {
    console.error("[CUSTOMER VERIFY-OTP]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
