import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signPreAuthToken } from "@/lib/customer-auth";
import { verifyOtp } from "@/lib/message-central";

/**
 * POST /api/customer/verify-otp
 *
 * Step 3 of registration. Also used for login-otp and forgot-pin.
 * Caps at 5 attempts per OtpVerification row; invalidates row on 5th failure.
 *
 * Body:
 *   mobile    string
 *   otp       string (6 digits)
 *   purpose?  "REGISTER" | "LOGIN" | "FORGOT_PIN" (default: REGISTER)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mobile, otp, purpose = "REGISTER" } = body;

    if (!mobile || !otp) {
      return NextResponse.json({ error: "mobile and otp are required" }, { status: 400 });
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "OTP must be exactly 6 digits" }, { status: 400 });
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

    // ── Call Message Central to verify ────────────────────────────────────────
    try {
      await verifyOtp(otpRow.verificationId, otp);
    } catch (err: any) {
      // If this was the 5th attempt, invalidate the row
      const updatedAttempts = otpRow.attempts + 1;
      if (updatedAttempts >= 5) {
        await prisma.otpVerification.update({
          where: { id: otpRow.id },
          data: { consumedAtUtc: new Date() },
        });
        return NextResponse.json(
          { error: "OTP incorrect. Too many attempts. Please request a new OTP." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Incorrect OTP. Please try again.", attemptsRemaining: 5 - updatedAttempts },
        { status: 401 }
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
        select: {
          id: true,
          companyId: true,
          companyNameManual: true,
          workAddress: true,
          company: { select: { id: true, status: true } },
        },
      });

      if (!user) {
        return NextResponse.json({ error: "Draft user not found" }, { status: 404 });
      }

      // ── THIS IS THE CRITICAL MOMENT (§6.4):
      // If the user typed a new company name (companyNameManual), create the Company
      // row HERE — only now that OTP is verified — then link it and clear the field.
      // This is what ensures "company name stored in DB only if user is verified."
      let resolvedCompanyId = user.companyId;

      if (user.companyNameManual && !user.companyId) {
        // Check for existing company with same name (case-insensitive)
        const existing = await prisma.company.findFirst({
          where: { name: { equals: user.companyNameManual, mode: "insensitive" } },
          select: { id: true },
        });

        if (existing) {
          resolvedCompanyId = existing.id;
        } else {
          // Create the Company row now (OTP just verified — user is now confirmed)
          const newCompany = await prisma.company.create({
            data: {
              name: user.companyNameManual,
              location: user.workAddress?.trim() || null,
              status: "CONFIRMED", // will appear in admin Pending tab since isVerifiedByAdmin=false
              addedByUserId: userId,
              isVerifiedByAdmin: false,
              isFlaggedFake: false,
            },
          });
          resolvedCompanyId = newCompany.id;
        }
      }

      // Transaction: verify user + link company + clear companyNameManual
      await prisma.$transaction([
        prisma.user.update({
          where: { id: userId },
          data: {
            isVerified: true,
            verifiedAt: new Date(),
            companyId: resolvedCompanyId,
            companyNameManual: null, // cleared once company row is created
          },
        }),
      ]);

      // Issue a short-lived pre-auth token to gate the set-pin step
      const preAuthToken = signPreAuthToken(userId);

      return NextResponse.json({
        verified: true,
        nextStep: "SET_PIN",
        preAuthToken,
      });
    }

    if (purpose === "LOGIN") {
      const user = await prisma.user.findFirst({
        where: { number: mobile, isVerified: true },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Issue pre-auth token; actual session is created by the caller
      // after a short redirect so the client can call /api/customer/login-otp/verify
      const preAuthToken = signPreAuthToken(user.id);
      return NextResponse.json({ verified: true, preAuthToken });
    }

    if (purpose === "FORGOT_PIN") {
      const user = await prisma.user.findFirst({
        where: { number: mobile, isVerified: true },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const preAuthToken = signPreAuthToken(user.id);
      return NextResponse.json({ verified: true, preAuthToken, nextStep: "RESET_PIN" });
    }

    return NextResponse.json({ error: "Unknown purpose" }, { status: 400 });
  } catch (error) {
    console.error("[CUSTOMER VERIFY-OTP]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
