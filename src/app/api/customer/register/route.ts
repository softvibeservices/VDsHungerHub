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
 * Step 1 of registration: collect name, ordering mode, addresses, company.
 *
 * CRITICAL SPEC RULE (§6.2, §6.4):
 * - If user picks a company from the dropdown (companyId), link it immediately
 *   since dropdown-listed companies are already admin-verified — no fake-company risk.
 * - If user types a NEW company name (newCompanyName), do NOT create a Company row
 *   here. Store the text in User.companyNameManual only. The real Company row is
 *   created in verify-otp (§6.4) only if/when OTP succeeds. This ensures the
 *   company name only enters the DB if the user is verified.
 *
 * CUSTOMER PANEL FIX #1 / #2 (registration overhaul):
 * - orderingMode: "WORK" | "HOME_ONLY" (default "WORK" for backward compatibility
 *   with any stale client build that doesn't send this field).
 *     - "HOME_ONLY": company must NOT be supplied at all. workAddress must NOT be
 *       supplied. homeAddress becomes REQUIRED (10-300 chars).
 *     - "WORK": company IS required (companyId XOR newCompanyName), same as before.
 * - Company address locking: when companyId is supplied AND that company already
 *   has a canonical Company.address on file, the server IGNORES whatever
 *   workAddress the client sent and overwrites it with Company.address. This is
 *   enforced HERE (server-side), not just hidden/disabled in the UI, so the
 *   delivery address can never diverge across different employees of the same
 *   company. If the company has NO canonical address yet, the client-submitted
 *   workAddress is required and used as-is (existing pre-fix behavior) — it is
 *   NOT written back onto Company.address; only an admin sets that, via the
 *   existing CompanyModal in the admin panel.
 *
 * Body:
 *   fullName        string (2-80)
 *   orderingMode?   "WORK" | "HOME_ONLY"  (default "WORK")
 *   workAddress?    string (10-300)        — required for WORK mode unless the
 *                                              selected company already has a
 *                                              canonical address on file
 *   homeAddress?    string (10-300)        — required for HOME_ONLY, optional for WORK
 *   companyId?      string   — existing admin-verified company (WORK mode only)
 *   newCompanyName? string   — typed company name (WORK mode only, not created
 *                              until OTP verify)
 *   deviceVisitorId string (from FingerprintJS)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullName,
      orderingMode: orderingModeRaw,
      workAddress,
      homeAddress,
      companyId,
      newCompanyName,
      deviceVisitorId = "",
    } = body;

    const orderingMode: "WORK" | "HOME_ONLY" =
      orderingModeRaw === "HOME_ONLY" ? "HOME_ONLY" : "WORK";

    // ── Validation: full name (unchanged) ───────────────────────────────────
    if (!fullName?.trim() || fullName.trim().length < 2 || fullName.trim().length > 80) {
      return NextResponse.json({ error: "Full name must be 2-80 characters" }, { status: 400 });
    }

    // ── Validation: mode-specific rules ─────────────────────────────────────
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

    // ── Rate limit ────────────────────────────────────────────────────────────────────────────────────
    // NOTE: Device-level rate limit is intentionally omitted here. It is already
    // enforced inside /api/customer/send-otp. Double-checking here was causing false
    // 429 errors for users making their first registration attempt.
    await checkRateLimit("IP", ip, "SEND_OTP_REGISTER", 24 * 60 * 60 * 1000, 100);

    // ── Resolve work address (WORK mode only) — Fix #1 lock enforcement ────────
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
          // LOCKED: ignore whatever the client sent — the DB value is authoritative.
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
        // New company (typed name) — no canonical address exists yet.
        if (!workAddress?.trim() || workAddress.trim().length < 5 || workAddress.trim().length > 300) {
          return NextResponse.json(
            { error: "Work / Delivery Address must be between 5 and 300 characters." },
            { status: 400 }
          );
        }
        resolvedWorkAddress = workAddress.trim();
      }
    }

    // ── Create User draft (NO Company row for typed names — stored in companyNameManual) ──
    const draft = await prisma.user.create({
      data: {
        name: fullName.trim(),
        number: `DRAFT_${Date.now()}`, // temporary placeholder, replaced in send-otp
        companyId: orderingMode === "WORK" ? (companyId || null) : null,
        companyNameManual: orderingMode === "WORK" ? (newCompanyName?.trim() || null) : null,
        workAddress: resolvedWorkAddress,
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
