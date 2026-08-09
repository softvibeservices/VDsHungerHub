import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth";
import { signStaffToken, setStaffSessionCookie } from "@/lib/staff-auth";
import {
  checkRateLimit,
  getClientIp,
  formatRateLimitWaitTime,
} from "@/lib/customer-auth";

function normalizeMobile(raw: string): string {
  const clean = String(raw).replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");
  if (!/^[6-9]\d{9}$/.test(clean)) throw new Error("INVALID_MOBILE");
  return clean;
}

export async function POST(req: NextRequest) {
  try {
    const { mobile: rawMobile, password } = await req.json();

    let mobile: string;
    try {
      mobile = normalizeMobile(rawMobile);
    } catch {
      return NextResponse.json({ error: "Invalid mobile number." }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    // Rate Limiting (IP: 10 attempts/hr, Mobile: 5 attempts/15min)
    const ip = getClientIp(req);
    await checkRateLimit("IP", ip, "STAFF_PASSWORD_ATTEMPT", 60 * 60 * 1000, 10);
    await checkRateLimit("MOBILE", mobile, "STAFF_PASSWORD_ATTEMPT", 15 * 60 * 1000, 5);

    // Generic error message for both "no such user" and "wrong password"
    // to prevent user enumeration
    const genericError = () =>
      NextResponse.json({ error: "Invalid mobile number or password." }, { status: 401 });

    const staff = await prisma.staffUser.findUnique({ where: { mobile } });
    if (!staff || staff.status !== "ACTIVE" || !staff.passwordHash) {
      return genericError();
    }

    const valid = await comparePassword(password, staff.passwordHash);
    if (!valid) return genericError();

    await prisma.staffUser.update({
      where: { id: staff.id },
      data: { lastLoginAt: new Date() },
    });

    const token = signStaffToken({
      staffId: staff.id,
      mobile: staff.mobile,
      name: staff.name,
      role: staff.role,
      permissions: staff.permissions,
    });
    await setStaffSessionCookie(token);

    return NextResponse.json({
      success: true,
      redirectTo: "/dashboard",
      role: staff.role,
      mustChangePassword: staff.mustChangePassword,
    });
  } catch (error: any) {
    if (error?.name === "RateLimitExceededError") {
      const waitTime = error.waitTimeMs ? formatRateLimitWaitTime(error.waitTimeMs) : "some time";
      return NextResponse.json(
        { error: `Too many login attempts. Please try again after ${waitTime}.` },
        { status: 429 }
      );
    }
    console.error("[STAFF PASSWORD LOGIN ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
