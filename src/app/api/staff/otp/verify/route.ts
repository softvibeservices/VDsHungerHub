// src\app\api\staff\otp\verify\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWidgetToken } from "@/lib/msg91";
import { signStaffToken, setStaffSessionCookie } from "@/lib/staff-auth";

const MAX_VERIFY_ATTEMPTS = 5;

function normalizeMobile(raw: string): string {
  const clean = String(raw).replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");
  if (!/^[6-9]\d{9}$/.test(clean)) throw new Error("INVALID_MOBILE");
  return clean;
}

export async function POST(req: NextRequest) {
  try {
    const { mobile: rawMobile, widgetToken } = await req.json();

    let mobile: string;
    try {
      mobile = normalizeMobile(rawMobile);
    } catch {
      return NextResponse.json({ error: "Invalid mobile number." }, { status: 400 });
    }

    if (!widgetToken || typeof widgetToken !== "string") {
      return NextResponse.json({ error: "widgetToken is required." }, { status: 400 });
    }

    // Most recent, unconsumed, unexpired attempt for this mobile
    const attempt = await prisma.staffOtpAttempt.findFirst({
      where: { mobile, consumedAtUtc: null, expiresAtUtc: { gt: new Date() } },
      orderBy: { createdAtUtc: "desc" },
    });

    if (!attempt || attempt.providerRef === "no-account") {
      return NextResponse.json({ error: "Invalid or expired code. Please request a new one." }, { status: 400 });
    }

    if (attempt.attempts >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json({ error: "Too many incorrect attempts. Request a new code." }, { status: 429 });
    }

    // ── Validate widget token with MSG91 ──────────────────────────────────
    let verifiedMobile: string;
    try {
      verifiedMobile = await verifyWidgetToken(widgetToken);
    } catch (err: any) {
      console.warn("[STAFF OTP VERIFY] Widget token validation failed:", err.message);
      return NextResponse.json({ error: "Incorrect or expired code." }, { status: 400 });
    }

    if (verifiedMobile !== mobile) {
      console.warn(`[STAFF OTP VERIFY] Mobile mismatch: claimed=${mobile} verified=${verifiedMobile}`);
      return NextResponse.json({ error: "Mobile number mismatch. Please request a new OTP." }, { status: 400 });
    }

    // OTP verified — re-check the staff account is still active
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

    const mustSetPassword = !staff.passwordHash || staff.mustChangePassword;

    return NextResponse.json({
      redirectTo: "/dashboard",
      role: staff.role,
      mustSetPassword,
      hasPassword: Boolean(staff.passwordHash),
    });
  } catch (error) {
    console.error("[STAFF OTP VERIFY]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
