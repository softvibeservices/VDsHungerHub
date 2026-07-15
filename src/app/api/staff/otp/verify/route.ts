import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOtp, MessageCentralError } from "@/lib/message-central";
import { signStaffToken, setStaffSessionCookie } from "@/lib/staff-auth";

const MAX_VERIFY_ATTEMPTS = 5;

function normalizeMobile(raw: string): string {
  const clean = String(raw).replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");
  if (!/^[6-9]\d{9}$/.test(clean)) throw new Error("INVALID_MOBILE");
  return clean;
}

export async function POST(req: NextRequest) {
  try {
    const { mobile: rawMobile, otpCode } = await req.json();

    let mobile: string;
    try {
      mobile = normalizeMobile(rawMobile);
    } catch {
      return NextResponse.json({ error: "Invalid mobile number." }, { status: 400 });
    }

    if (!otpCode || String(otpCode).length !== 4) {
      return NextResponse.json({ error: "Enter the 4-digit code." }, { status: 400 });
    }

    // Most recent, unconsumed, unexpired attempt for this mobile
    const attempt = await prisma.staffOtpAttempt.findFirst({
      where: { mobile, consumedAtUtc: null, expiresAtUtc: { gt: new Date() } },
      orderBy: { createdAtUtc: "desc" },
    });

    if (!attempt || attempt.verificationId === "no-account") {
      return NextResponse.json({ error: "Invalid or expired code. Please request a new one." }, { status: 400 });
    }

    if (attempt.attempts >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json({ error: "Too many incorrect attempts. Request a new code." }, { status: 429 });
    }

    try {
      await verifyOtp(attempt.verificationId, String(otpCode));
    } catch (err) {
      await prisma.staffOtpAttempt.update({
        where: { id: attempt.id },
        data: { attempts: { increment: 1 } },
      });
      if (err instanceof MessageCentralError) {
        return NextResponse.json({ error: "Incorrect or expired code." }, { status: 400 });
      }
      throw err;
    }

    // OTP verified — re-check the staff account is still active (it
    // could have been deactivated in the seconds between send and verify)
    const staff = await prisma.staffUser.findUnique({ where: { mobile } });
    if (!staff || staff.status !== "ACTIVE") {
      return NextResponse.json({ error: "This account is not active. Contact an administrator." }, { status: 403 });
    }

    await prisma.$transaction([
      prisma.staffOtpAttempt.update({
        where: { id: attempt.id },
        data: { consumedAtUtc: new Date() },
      }),
      prisma.staffUser.update({
        where: { id: staff.id },
        data: { lastLoginAt: new Date() },
      }),
    ]);

    const token = signStaffToken({
      staffId: staff.id,
      mobile: staff.mobile,
      name: staff.name,
      role: staff.role,
      permissions: staff.permissions,
    });
    await setStaffSessionCookie(token);

    return NextResponse.json({
      redirectTo: "/dashboard",
      role: staff.role,
    });
  } catch (error) {
    console.error("[STAFF OTP VERIFY]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
