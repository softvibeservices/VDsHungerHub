import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOtp, MessageCentralError } from "@/lib/message-central";

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_SENDS_PER_MOBILE_PER_HOUR = 5;
const MAX_SENDS_PER_IP_PER_HOUR = 15;

function normalizeMobile(raw: string): string {
  const clean = String(raw).replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");
  if (!/^[6-9]\d{9}$/.test(clean)) throw new Error("INVALID_MOBILE");
  return clean;
}

export async function POST(req: NextRequest) {
  try {
    const { mobile: rawMobile } = await req.json();

    let mobile: string;
    try {
      mobile = normalizeMobile(rawMobile);
    } catch {
      return NextResponse.json({ error: "Enter a valid 10-digit mobile number." }, { status: 400 });
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    // ── Deliberately generic: do NOT reveal whether this mobile is a
    //    registered staff account. Send OTP the same way regardless —
    //    the "not a staff account" check happens at VERIFY time only,
    //    so a probing attacker can't enumerate valid staff numbers by
    //    watching which numbers get an OTP and which get an error here.
    const staff = await prisma.staffUser.findUnique({ where: { mobile } });

    // Rate limit BEFORE calling Message Central, so we don't burn OTP
    // credits on abuse, and so repeated probing gets slowed down even
    // for mobile numbers that don't correspond to any staff account.
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [mobileCount, ipCount] = await Promise.all([
      prisma.staffOtpAttempt.count({ where: { mobile, createdAtUtc: { gte: oneHourAgo } } }),
      prisma.staffOtpAttempt.count({ where: { ip, createdAtUtc: { gte: oneHourAgo } } }),
    ]);

    if (mobileCount >= MAX_SENDS_PER_MOBILE_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many OTP requests for this number. Try again later." },
        { status: 429 }
      );
    }
    if (ipCount >= MAX_SENDS_PER_IP_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many OTP requests from this network. Try again later." },
        { status: 429 }
      );
    }

    // If this mobile isn't a staff account at all, or is INACTIVE, we
    // still return a generic success-shaped response to avoid leaking
    // which numbers are valid staff accounts — but we skip the actual
    // Message Central call to avoid wasting OTP credits on numbers that
    // can never log in anyway.
    if (!staff || staff.status !== "ACTIVE") {
      // Log the attempt anyway for audit/rate-limit purposes, with a
      // dummy verificationId — verify will simply always fail for it.
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

    const verificationId = await sendOtp(mobile);

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
  } catch (error) {
    if (error instanceof MessageCentralError) {
      console.error("[STAFF OTP SEND] Message Central error:", error.message, error.responseBody);
      return NextResponse.json({ error: "Could not send OTP right now. Please try again." }, { status: 502 });
    }
    console.error("[STAFF OTP SEND]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
