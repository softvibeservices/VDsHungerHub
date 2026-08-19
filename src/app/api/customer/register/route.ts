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
 * Step 1 of registration: collect name, mobile, ordering mode, addresses, company.
 *
 * CRITICAL FIX — mobile number is now accepted and stored HERE, not as a placeholder.
 * Previously this route stored `DRAFT_${Date.now()}` as the mobile number, and
 * relied on send-otp to update it later. If send-otp failed (rate limit, network,
 * etc.) the draft row was left in the DB with a corrupted garbage number.
 *
 * New behaviour:
 *  1. Accept mobile in the register body and validate it immediately.
 *  2. Reject if the mobile already belongs to a verified user (409).
 *  3. If an unverified draft already exists for this mobile, REUSE it by
 *     updating its details — never create duplicates.
 *  4. Clean up any OTHER stale unverified drafts for the same device fingerprint
 *     so they never pollute the Users table.
 *
 * SPEC RULE (§6.2, §6.4):
 *  - companyId (dropdown pick) → link immediately (admin-verified companies are safe).
 *  - newCompanyName (typed text) → store in companyNameManual ONLY; the real
 *    Company row is created in set-pin only after both OTP + PIN succeed.
 *
 * Body:
 *   fullName        string (2-80)
 *   mobile          string (10-digit Indian)
 *   orderingMode?   "WORK" | "HOME_ONLY"  (default "WORK")
 *   workAddress?    string (5-300)        — required for WORK mode
 *   homeAddress?    string (5-300)        — required for HOME_ONLY, optional for WORK
 *   companyId?      string
 *   newCompanyName? string
 *   deviceVisitorId string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullName,
      mobile,
      orderingMode: orderingModeRaw,
      workAddress,
      homeAddress,
      companyId,
      newCompanyName,
      deviceVisitorId = "",
    } = body;

    const orderingMode: "WORK" | "HOME_ONLY" =
      orderingModeRaw === "HOME_ONLY" ? "HOME_ONLY" : "WORK";

    // ── Validation: full name ─────────────────────────────────────────────────
    if (!fullName?.trim() || fullName.trim().length < 2 || fullName.trim().length > 80) {
      return NextResponse.json({ error: "Full name must be 2-80 characters" }, { status: 400 });
    }

    // ── Validation: mobile — required and stored here, never as a placeholder ─
    const mobileRegex = /^[6-9]\d{9}$/;
    if (!mobile || !mobileRegex.test(mobile.trim())) {
      return NextResponse.json(
        { error: "Please enter a valid 10-digit Indian mobile number." },
        { status: 400 }
      );
    }
    const cleanMobile = mobile.trim();

    // ── Validation: mode-specific rules ──────────────────────────────────────
    if (orderingMode === "HOME_ONLY") {
      if (!homeAddress?.trim() || homeAddress.trim().length < 5 || homeAddress.trim().length > 300) {
        return NextResponse.json(
          { error: "Home address must be 5-300 characters" },
          { status: 400 }
        );
      }
      if (companyId || newCompanyName?.trim()) {
        return NextResponse.json(
          { error: "Company should not be provided for home-only registration" },
          { status: 400 }
        );
      }
    } else {
      // WORK mode
      if (homeAddress && (homeAddress.trim().length < 5 || homeAddress.trim().length > 300)) {
        return NextResponse.json(
          { error: "Home address must be 5-300 characters if provided" },
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
    }

    // ── Device fingerprint ────────────────────────────────────────────────────
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = getClientIp(req);
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    // ── Rate limit ────────────────────────────────────────────────────────────
    await checkRateLimit("IP", ip, "SEND_OTP_REGISTER", 24 * 60 * 60 * 1000, 100);

    // ── Reject if mobile already fully registered (verified + has PIN) ────────
    const alreadyComplete = await prisma.user.findFirst({
      where: { number: cleanMobile, isVerified: true, NOT: { pinHash: null } },
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

    // ── Reject if mobile is verified but has no PIN (VERIFIED_NO_PIN) ─────────
    const verifiedNoPin = await prisma.user.findFirst({
      where: { number: cleanMobile, isVerified: true, pinHash: null },
      select: { id: true },
    });
    if (verifiedNoPin) {
      return NextResponse.json(
        {
          error: "MOBILE_ALREADY_REGISTERED",
          code: "VERIFIED_NO_PIN",
          message: "Your mobile is already verified. Please set your PIN to complete registration.",
        },
        { status: 409 }
      );
    }

    // ── Resolve work address (WORK mode) — enforce company address lock ───────
    let resolvedWorkAddress: string | null = null;

    if (orderingMode === "WORK") {
      if (companyId) {
        const company = await prisma.company.findUnique({
          where: { id: companyId },
          select: { id: true, isVerifiedByAdmin: true, isFlaggedFake: true, isActive: true, address: true },
        });
        if (!company || !company.isVerifiedByAdmin || company.isFlaggedFake || !company.isActive) {
          return NextResponse.json({ error: "Selected company is not available" }, { status: 400 });
        }

        const hasCanonicalAddress = !!company.address && company.address.trim().length >= 5;

        if (hasCanonicalAddress) {
          resolvedWorkAddress = company.address!.trim();
        } else {
          if (!workAddress?.trim() || workAddress.trim().length < 5 || workAddress.trim().length > 300) {
            return NextResponse.json(
              { error: "Work / Delivery Address must be between 5 and 300 characters." },
              { status: 400 }
            );
          }
          resolvedWorkAddress = workAddress.trim();
        }
      } else {
        if (!workAddress?.trim() || workAddress.trim().length < 5 || workAddress.trim().length > 300) {
          return NextResponse.json(
            { error: "Work / Delivery Address must be between 5 and 300 characters." },
            { status: 400 }
          );
        }
        resolvedWorkAddress = workAddress.trim();
      }
    }

    // ── Clean up stale drafts for this device that have DIFFERENT mobile numbers ─
    // This prevents orphaned DRAFT rows accumulating when the user retries with
    // corrected details or switches mobile numbers during a session.
    const deviceDrafts = await prisma.deviceFingerprint.findMany({
      where: { fingerprintHash },
      select: { userId: true },
    });
    const deviceUserIds = deviceDrafts.map((d: { userId: string }) => d.userId);
    if (deviceUserIds.length > 0) {
      const staleDrafts = await prisma.user.findMany({
        where: {
          id: { in: deviceUserIds },
          isVerified: false,
          NOT: { number: cleanMobile },
        },
        select: { id: true },
      });
      if (staleDrafts.length > 0) {
        const staleIds = staleDrafts.map((d: { id: string }) => d.id);
        await prisma.$transaction([
          prisma.otpVerification.deleteMany({ where: { userId: { in: staleIds } } }),
          prisma.customerSession.deleteMany({ where: { userId: { in: staleIds } } }),
          prisma.deviceFingerprint.deleteMany({ where: { userId: { in: staleIds } } }),
          prisma.address.deleteMany({ where: { userId: { in: staleIds } } }),
          prisma.user.deleteMany({ where: { id: { in: staleIds } } }),
        ]);
      }
    }

    // ── Reuse or create draft ─────────────────────────────────────────────────
    // If an unverified draft already exists for this exact mobile, update it
    // with the latest details (user may have corrected name/address) and reuse it.
    // NEVER create duplicate drafts for the same mobile number.
    const existingDraft = await prisma.user.findFirst({
      where: { number: cleanMobile, isVerified: false },
      select: { id: true },
    });

    let draftId: string;

    if (existingDraft) {
      // Update in place — keep the same ID so any existing OTP rows still link correctly
      await prisma.user.update({
        where: { id: existingDraft.id },
        data: {
          name: fullName.trim(),
          number: cleanMobile,
          companyId: orderingMode === "WORK" ? (companyId || null) : null,
          companyNameManual: orderingMode === "WORK" ? (newCompanyName?.trim() || null) : null,
          workAddress: resolvedWorkAddress,
          homeAddress: homeAddress?.trim() || null,
        },
      });
      draftId = existingDraft.id;
    } else {
      // Create a fresh draft — number is the REAL mobile, no placeholder
      const draft = await prisma.user.create({
        data: {
          name: fullName.trim(),
          number: cleanMobile, // REAL number — no more DRAFT_${Date.now()} corruption
          companyId: orderingMode === "WORK" ? (companyId || null) : null,
          companyNameManual: orderingMode === "WORK" ? (newCompanyName?.trim() || null) : null,
          workAddress: resolvedWorkAddress,
          homeAddress: homeAddress?.trim() || null,
          isVerified: false,
        },
      });
      draftId = draft.id;
    }

    // ── Device fingerprint upsert ─────────────────────────────────────────────
    await prisma.deviceFingerprint.upsert({
      where: { userId_fingerprintHash: { userId: draftId, fingerprintHash } },
      update: { lastSeenAtUtc: new Date() },
      create: {
        userId: draftId,
        fingerprintHash,
        userAgent,
        ipAtFirstSeen: ip,
      },
    });

    // ── Set reg_draft cookie (30-min httpOnly) ────────────────────────────────
    await setDraftCookie(draftId);

    return NextResponse.json({
      draftId,
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
