import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  computeFingerprintHash,
  setDraftCookie,
  checkRateLimit,
  getClientIp,
} from "@/lib/customer-auth";

/**
 * POST /api/customer/register
 *
 * Step 1 of registration: collect name, addresses, company.
 * Creates an unverified User draft + optional PENDING Company.
 * Sets reg_draft cookie so the user can resume at the Verify tab.
 *
 * Body:
 *   fullName        string (2-80)
 *   workAddress     string (10-300)
 *   homeAddress?    string (10-300)
 *   companyId?      string
 *   newCompanyName? string
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

    // ── Device fingerprint ────────────────────────────────────────────────────
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = getClientIp(req);
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    // ── Rate limit: company creation (2 per device per day) ─────────────────
    if (newCompanyName?.trim()) {
      await checkRateLimit("DEVICE", fingerprintHash, "ADD_COMPANY", 24 * 60 * 60 * 1000, 2);
    }

    // ── Transaction: create Company (if new) + User draft ───────────────────
    let resolvedCompanyId = companyId;

    if (newCompanyName?.trim()) {
      // Check for existing (case-insensitive match)
      const normalized = newCompanyName.trim().toLowerCase();
      const existing = await prisma.company.findFirst({
        where: { name: { equals: newCompanyName.trim(), mode: "insensitive" } },
        select: { id: true, status: true },
      });

      if (existing) {
        if (existing.status === "CONFIRMED") {
          // Already confirmed company — just use it
          resolvedCompanyId = existing.id;
        } else {
          // Pending duplicate — use the existing pending one
          resolvedCompanyId = existing.id;
        }
      } else {
        // Create new PENDING company (placeholder user ID, updated in transaction below)
        const newCompany = await prisma.company.create({
          data: {
            name: newCompanyName.trim(),
            status: "PENDING",
          },
        });
        resolvedCompanyId = newCompany.id;
      }
    }

    if (!resolvedCompanyId) {
      return NextResponse.json({ error: "Company resolution failed" }, { status: 500 });
    }

    // Validate the chosen company exists and is CONFIRMED (if pre-existing)
    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, status: true },
      });
      if (!company || company.status !== "CONFIRMED") {
        return NextResponse.json({ error: "Selected company is not available" }, { status: 400 });
      }
    }

    // Create the User draft (isVerified=false, no mobile yet, no PIN)
    const draft = await prisma.user.create({
      data: {
        name: fullName.trim(),
        number: `DRAFT_${Date.now()}`, // temporary placeholder, replaced in send-otp
        companyId: resolvedCompanyId,
        workAddress: workAddress.trim(),
        homeAddress: homeAddress?.trim() || null,
        isVerified: false,
      },
    });

    // If we created a new company, backfill addedByUserId
    if (newCompanyName?.trim()) {
      await prisma.company.update({
        where: { id: resolvedCompanyId },
        data: { addedByUserId: draft.id },
      });
    }

    // Create untrusted DeviceFingerprint entry
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

    // Set reg_draft cookie (30-min httpOnly)
    await setDraftCookie(draft.id);

    return NextResponse.json({
      draftId: draft.id,
      nextStep: "MOBILE_OTP",
    });
  } catch (error: any) {
    if (error?.name === "RateLimitExceededError") {
      return NextResponse.json(
        { error: "Too many company additions. Please try again later." },
        { status: 429 }
      );
    }
    console.error("[CUSTOMER REGISTER]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
