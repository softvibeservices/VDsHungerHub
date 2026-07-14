import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeFingerprintHash,
  setDraftCookie,
  checkRateLimit,
  getClientIp,
  formatRateLimitWaitTime,
} from "@/lib/customer-auth";

/**
 * POST /api/customer/register
 *
 * Step 1 of registration: collect name, addresses, company.
 *
 * CRITICAL SPEC RULE (§6.2, §6.4):
 * - If user picks a company from the dropdown (companyId), link it immediately
 *   since dropdown-listed companies are already admin-verified — no fake-company risk.
 * - If user types a NEW company name (newCompanyName), do NOT create a Company row
 *   here. Store the text in User.companyNameManual only. The real Company row is
 *   created in verify-otp (§6.4) only if/when OTP succeeds. This ensures the
 *   company name only enters the DB if the user is verified.
 *
 * Body:
 *   fullName        string (2-80)
 *   workAddress     string (10-300)
 *   homeAddress?    string (10-300)
 *   companyId?      string   — existing admin-verified company
 *   newCompanyName? string   — typed company name (NOT created until OTP verify)
 *   deviceVisitorId string (from FingerprintJS)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullName,
      workAddress,
      homeAddress,
      companyId,
      newCompanyName,
      deviceVisitorId = "",
    } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!fullName?.trim() || fullName.trim().length < 2 || fullName.trim().length > 80) {
      return NextResponse.json({ error: "Full name must be 2-80 characters" }, { status: 400 });
    }

    if (!workAddress?.trim() || workAddress.trim().length < 10 || workAddress.trim().length > 300) {
      return NextResponse.json(
        { error: "Work address must be 10-300 characters" },
        { status: 400 }
      );
    }

    if (homeAddress && (homeAddress.trim().length < 10 || homeAddress.trim().length > 300)) {
      return NextResponse.json(
        { error: "Home address must be 10-300 characters if provided" },
        { status: 400 }
      );
    }

    if (!companyId && !newCompanyName?.trim()) {
      return NextResponse.json(
        { error: "Either companyId or newCompanyName must be provided" },
        { status: 400 }
      );
    }

    if (companyId && newCompanyName?.trim()) {
      return NextResponse.json(
        { error: "Provide either companyId or newCompanyName, not both" },
        { status: 400 }
      );
    }

    if (newCompanyName?.trim() && (newCompanyName.trim().length < 2 || newCompanyName.trim().length > 100)) {
      return NextResponse.json(
        { error: "Company name must be 2-100 characters" },
        { status: 400 }
      );
    }

    // ── Device fingerprint ────────────────────────────────────────────────────
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = getClientIp(req);
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    // ── Rate limit ────────────────────────────────────────────────────────────
    await checkRateLimit("DEVICE", fingerprintHash, "SEND_OTP_REGISTER", 24 * 60 * 60 * 1000, 3);
    await checkRateLimit("IP", ip, "SEND_OTP_REGISTER", 24 * 60 * 60 * 1000, 8);

    // ── If companyId given — validate it exists and is admin-verified ─────────
    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, isVerifiedByAdmin: true, isFlaggedFake: true, isActive: true },
      });
      if (!company || !company.isVerifiedByAdmin || company.isFlaggedFake || !company.isActive) {
        return NextResponse.json({ error: "Selected company is not available" }, { status: 400 });
      }
    }

    // ── Create User draft (NO Company row for typed names — stored in companyNameManual) ──
    const draft = await prisma.user.create({
      data: {
        name: fullName.trim(),
        number: `DRAFT_${Date.now()}`, // temporary placeholder, replaced in send-otp
        companyId: companyId || null,
        companyNameManual: newCompanyName?.trim() || null,
        workAddress: workAddress.trim(),
        homeAddress: homeAddress?.trim() || null,
        isVerified: false,
      },
    });

    // ── Device fingerprint upsert ─────────────────────────────────────────────
    await prisma.deviceFingerprint.upsert({
      where: { userId_fingerprintHash: { userId: draft.id, fingerprintHash } },
      update: { lastSeenAtUtc: new Date() },
      create: {
        userId: draft.id,
        fingerprintHash,
        userAgent,
        ipAtFirstSeen: ip,
      },
    });

    // ── Set reg_draft cookie (30-min httpOnly) ────────────────────────────────
    await setDraftCookie(draft.id);

    return NextResponse.json({
      draftId: draft.id,
      nextStep: "MOBILE_OTP",
    });
  } catch (error: any) {
    if (error?.name === "RateLimitExceededError") {
      const waitTime = error.waitTimeMs ? formatRateLimitWaitTime(error.waitTimeMs) : "some time";
      return NextResponse.json(
        { error: `Too many registration attempts. Please try again after ${waitTime}.` },
        { status: 429 }
      );
    }
    console.error("[CUSTOMER REGISTER]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
