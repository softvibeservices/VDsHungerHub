// src\app\api\customer\set-pin\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPreAuthToken,
  validatePin,
  hashPin,
  computeFingerprintHash,
  createCustomerSession,
  setCustomerCookies,
  getClientIp,
} from "@/lib/customer-auth";
import { cookies } from "next/headers";

/**
 * POST /api/customer/set-pin
 *
 * Handles two flows (discriminated by the `flow` field inside preAuthToken):
 *
 * flow="REGISTER" — Final step of new registration:
 *   Sets isVerified=true, verifiedAt, pinHash, company link, and addresses
 *   ALL in a single atomic transaction. A user's mobile is only marked as
 *   verified when they have BOTH passed OTP verification AND created a PIN.
 *
 * flow="RESET_PIN" — Forgot-pin reset:
 *   User is already verified. Just updates pinHash and resets lockout counters.
 *
 * Body:
 *   preAuthToken   string  (JWT with sub=userId, flow="REGISTER"|"RESET_PIN")
 *   pin            string  (6 digits)
 *   confirmPin     string  (6 digits)
 *   deviceVisitorId string
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { preAuthToken, pin, confirmPin, deviceVisitorId = "" } = body;

    if (!preAuthToken) {
      return NextResponse.json({ error: "preAuthToken is required" }, { status: 400 });
    }

    // ── Verify pre-auth token ─────────────────────────────────────────────────
    const preAuth = verifyPreAuthToken(preAuthToken);
    if (!preAuth) {
      return NextResponse.json(
        { error: "Invalid or expired pre-auth token. Please restart the verification flow." },
        { status: 401 }
      );
    }

    const userId = preAuth.sub;
    const flow = preAuth.flow; // "REGISTER" | "RESET_PIN"

    // ── Validate PIN ──────────────────────────────────────────────────────────
    if (!pin || !confirmPin) {
      return NextResponse.json({ error: "pin and confirmPin are required" }, { status: 400 });
    }

    if (pin !== confirmPin) {
      return NextResponse.json({ error: "PINs do not match" }, { status: 400 });
    }

    try {
      validatePin(pin);
    } catch {
      return NextResponse.json(
        { error: "PIN is too simple. Choose a less predictable 6-digit number." },
        { status: 400 }
      );
    }

    // ── Shared: device fingerprint ────────────────────────────────────────────
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip = getClientIp(req);
    const fingerprintHash = computeFingerprintHash(deviceVisitorId, userAgent);

    const pinHash = await hashPin(pin);

    // ─────────────────────────────────────────────────────────────────────────
    // REGISTRATION FLOW
    // isVerified + verifiedAt + pinHash + company + addresses — all in one tx.
    // This is the ONLY place a user becomes "verified". OTP verification alone
    // does NOT set isVerified — this ensures atomicity between OTP and PIN.
    // ─────────────────────────────────────────────────────────────────────────
    if (flow === "REGISTER") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          number: true,
          name: true,
          isVerified: true,
          companyId: true,
          companyNameManual: true,
          workAddress: true,
          homeAddress: true,
        },
      });

      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Guard: if user somehow already verified (e.g. double-submit), still let them set PIN
      // but do not re-run the verification logic.
      if (user.isVerified && user.companyId === null && !user.companyNameManual) {
        // Fully clean verified state but no PIN yet — just set the PIN.
        await prisma.user.update({
          where: { id: userId },
          data: { pinHash, pinFailedAttempts: 0, pinLockedUntil: null },
        });
      } else {
        // ── Company resolution (moved from verify-otp §6.4) ───────────────────
        // Company row is created HERE — only when the user completes BOTH OTP + PIN.
        // This ensures a typed company name only enters the DB for real users.
        let resolvedCompanyId = user.companyId;

        if (user.companyNameManual && !user.companyId) {
          const existing = await prisma.company.findFirst({
            where: { name: { equals: user.companyNameManual, mode: "insensitive" } },
            select: { id: true },
          });

          if (existing) {
            resolvedCompanyId = existing.id;
          } else {
            const newCompany = await prisma.company.create({
              data: {
                name: user.companyNameManual,
                location: user.workAddress?.trim() || null,
                address: user.workAddress?.trim() || null,
                status: "CONFIRMED",
                addedByUserId: userId,
                isVerifiedByAdmin: false,
                isFlaggedFake: false,
              },
            });
            resolvedCompanyId = newCompany.id;
          }
        }

        // ── Atomic transaction: verify + PIN + company + addresses ────────────
        await prisma.$transaction(async (tx: any) => {
          // Set isVerified=true AND pinHash in ONE write — these two are inseparable.
          await tx.user.update({
            where: { id: userId },
            data: {
              isVerified: true,
              verifiedAt: new Date(),
              pinHash,
              pinFailedAttempts: 0,
              pinLockedUntil: null,
              companyId: resolvedCompanyId,
              companyNameManual: null, // cleared once company row is created
            },
          });

          // Seed canonical company address if company has none
          if (resolvedCompanyId && user.workAddress?.trim()) {
            const comp = await tx.company.findUnique({
              where: { id: resolvedCompanyId },
              select: { address: true },
            });
            if (comp && (!comp.address || !comp.address.trim())) {
              await tx.company.update({
                where: { id: resolvedCompanyId },
                data: { address: user.workAddress.trim() },
              });
            }
          }

          // Auto-create WORK address
          if (user.workAddress?.trim()) {
            const existingAddr = await tx.address.findFirst({
              where: { userId, type: "WORK" },
            });
            if (!existingAddr) {
              await tx.address.create({
                data: {
                  userId,
                  type: "WORK",
                  line1: user.workAddress.trim(),
                  isDefault: true,
                },
              });
            }
          }

          // Auto-create HOME address
          if (user.homeAddress?.trim()) {
            const existingHome = await tx.address.findFirst({
              where: { userId, type: "HOME" },
            });
            if (!existingHome) {
              await tx.address.create({
                data: {
                  userId,
                  type: "HOME",
                  line1: user.homeAddress.trim(),
                  isDefault: false,
                },
              });
            }
          }
        });
      }

      // Mark device as trusted (completed full registration)
      await prisma.deviceFingerprint.upsert({
        where: { userId_fingerprintHash: { userId, fingerprintHash } },
        update: { isTrusted: true, lastSeenAtUtc: new Date() },
        create: {
          userId,
          fingerprintHash,
          userAgent,
          ipAtFirstSeen: ip,
          isTrusted: true,
        },
      });

      // Re-fetch number + name for the session token (might have changed during draft)
      const freshUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { number: true, name: true },
      });

      const { accessToken, refreshToken } = await createCustomerSession(
        userId,
        freshUser!.number,
        freshUser!.name,
        fingerprintHash
      );

      await setCustomerCookies(accessToken, refreshToken);

      // Clear the reg_draft cookie
      const cookieStore = await cookies();
      cookieStore.delete("reg_draft");

      return NextResponse.json({ loggedIn: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RESET_PIN FLOW (forgot-pin)
    // User is already verified — just update the PIN hash.
    // ─────────────────────────────────────────────────────────────────────────
    if (flow === "RESET_PIN") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, number: true, name: true, isVerified: true },
      });

      if (!user || !user.isVerified) {
        return NextResponse.json(
          { error: "User not found or not verified" },
          { status: 404 }
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: { pinHash, pinFailedAttempts: 0, pinLockedUntil: null },
      });

      await prisma.deviceFingerprint.upsert({
        where: { userId_fingerprintHash: { userId, fingerprintHash } },
        update: { isTrusted: true, lastSeenAtUtc: new Date() },
        create: {
          userId,
          fingerprintHash,
          userAgent,
          ipAtFirstSeen: ip,
          isTrusted: true,
        },
      });

      const { accessToken, refreshToken } = await createCustomerSession(
        userId,
        user.number,
        user.name,
        fingerprintHash
      );

      await setCustomerCookies(accessToken, refreshToken);

      return NextResponse.json({ loggedIn: true });
    }

    // Should never reach here given verifyPreAuthToken validates flow
    return NextResponse.json({ error: "Invalid flow" }, { status: 400 });
  } catch (error) {
    console.error("[CUSTOMER SET-PIN]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
