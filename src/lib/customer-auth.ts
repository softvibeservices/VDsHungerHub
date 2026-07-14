/**
 * Customer Auth Utilities
 *
 * All functions are server-side only — never import from client components.
 * Covers: JWT, cookies, rate limiting, device fingerprinting, mobile validation, PIN hashing.
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ACCESS_SECRET = process.env.CUSTOMER_JWT_ACCESS_SECRET!;
const REFRESH_SECRET = process.env.CUSTOMER_JWT_REFRESH_SECRET!;
const ACCESS_TTL_MIN = parseInt(process.env.CUSTOMER_ACCESS_TOKEN_TTL_MIN ?? "15", 10);
const REFRESH_TTL_DAYS = parseInt(process.env.CUSTOMER_REFRESH_TOKEN_TTL_DAYS ?? "100", 10);
const FP_SALT = process.env.DEVICE_FINGERPRINT_SERVER_SALT ?? "default_salt";
const PIN_ROUNDS = parseInt(process.env.PIN_HASH_ROUNDS ?? "12", 10);

export const CUSTOMER_ACCESS_COOKIE = "customer_access";
export const CUSTOMER_REFRESH_COOKIE = "customer_refresh";
export const REG_DRAFT_COOKIE = "reg_draft";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface CustomerAccessClaims {
  sub: string;          // userId
  number: string;
  name: string;
  fph: string;          // deviceFingerprintHash
  role: "CUSTOMER";
  iat?: number;
  exp?: number;
}

export type CustomerAuthState =
  | { state: "VERIFIED_SESSION"; userId: string; fph: string }
  | { state: "DRAFT_PENDING_VERIFICATION"; draftId: string }
  | { state: "ANONYMOUS" };

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Number Validation
// ─────────────────────────────────────────────────────────────────────────────

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export class InvalidMobileNumberError extends Error {
  constructor() {
    super("Invalid Indian mobile number. Must be 10 digits starting with 6-9.");
    this.name = "InvalidMobileNumberError";
  }
}

/** Strip formatting and validate. Returns bare 10-digit string or throws. */
export function normalizeAndValidateMobile(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, "");
  const stripped =
    digitsOnly.startsWith("91") && digitsOnly.length === 12
      ? digitsOnly.slice(2)
      : digitsOnly;

  if (!INDIAN_MOBILE_REGEX.test(stripped)) {
    throw new InvalidMobileNumberError();
  }
  return stripped;
}

// ─────────────────────────────────────────────────────────────────────────────
// Device Fingerprinting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the server-side fingerprint hash from the client-supplied visitorId + userAgent.
 * The DEVICE_FINGERPRINT_SERVER_SALT is a secret pepper so the hash can't be reversed from
 * leaked client data alone.
 */
export function computeFingerprintHash(
  visitorId: string,
  userAgent: string
): string {
  return createHash("sha256")
    .update(`${visitorId}|${userAgent}|${FP_SALT}`)
    .digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// PIN Hashing
// ─────────────────────────────────────────────────────────────────────────────

/** Trivial PINs that must be rejected regardless of format. */
const TRIVIAL_PINS = new Set([
  "000000", "111111", "222222", "333333", "444444",
  "555555", "666666", "777777", "888888", "999999",
  "123456", "654321", "012345", "098765",
]);

export class WeakPinError extends Error {
  constructor() {
    super("PIN is too simple. Choose a less predictable 6-digit number.");
    this.name = "WeakPinError";
  }
}

export function validatePin(pin: string): void {
  if (!/^\d{6}$/.test(pin)) throw new WeakPinError();
  if (TRIVIAL_PINS.has(pin)) throw new WeakPinError();
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, PIN_ROUNDS);
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

// ─────────────────────────────────────────────────────────────────────────────
// JWT — Access Token
// ─────────────────────────────────────────────────────────────────────────────

export function signCustomerAccessToken(
  userId: string,
  number: string,
  name: string,
  fph: string
): string {
  return jwt.sign(
    { sub: userId, number, name, fph, role: "CUSTOMER" } as Omit<CustomerAccessClaims, "iat" | "exp">,
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL_MIN * 60 }
  );
}

export function verifyCustomerAccessToken(token: string): CustomerAccessClaims | null {
  try {
    return jwt.verify(token, ACCESS_SECRET) as CustomerAccessClaims;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh Token (opaque, 256-bit random)
// ─────────────────────────────────────────────────────────────────────────────

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex"); // 256 bits
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Cookie Management
// ─────────────────────────────────────────────────────────────────────────────

const SECURE = process.env.NODE_ENV === "production";

export async function setCustomerCookies(
  accessToken: string,
  refreshToken: string
) {
  const cookieStore = await cookies();
  cookieStore.set(CUSTOMER_ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    maxAge: ACCESS_TTL_MIN * 60,
    path: "/",
  });
  cookieStore.set(CUSTOMER_REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60,
    path: "/",
  });
}

export async function clearCustomerCookies() {
  const cookieStore = await cookies();
  cookieStore.delete(CUSTOMER_ACCESS_COOKIE);
  cookieStore.delete(CUSTOMER_REFRESH_COOKIE);
  cookieStore.delete(REG_DRAFT_COOKIE);
}

export async function setDraftCookie(userId: string) {
  const cookieStore = await cookies();
  cookieStore.set(REG_DRAFT_COOKIE, userId, {
    httpOnly: true,
    secure: SECURE,
    sameSite: "lax",
    maxAge: 30 * 60, // 30 minutes
    path: "/",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth State Machine (resolves on every /menu request)
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveCustomerAuthState(
  req: NextRequest
): Promise<CustomerAuthState> {
  // 1. Try access token first (fast path)
  const accessToken = req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
  if (accessToken) {
    const claims = verifyCustomerAccessToken(accessToken);
    if (claims) {
      // Check user status
      const user = await prisma.user.findUnique({
        where: { id: claims.sub },
        select: { status: true },
      });
      const blockedDevice = await prisma.deviceFingerprint.findFirst({
        where: { fingerprintHash: claims.fph, isBlocked: true },
      });
      if (user && user.status === "ACTIVE" && !blockedDevice) {
        return { state: "VERIFIED_SESSION", userId: claims.sub, fph: claims.fph };
      } else {
        // Clear cookies to force logout if blocked/banned
        await clearCustomerCookies();
        return { state: "ANONYMOUS" };
      }
    }
  }

  // 2. Access token missing/expired — try silent refresh
  const refreshToken = req.cookies.get(CUSTOMER_REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const rotated = await tryRotateRefreshToken(refreshToken, req);
    if (rotated) {
      return { state: "VERIFIED_SESSION", userId: rotated.userId, fph: rotated.fph };
    }
  }

  // 3. Check for a pending registration draft
  const draftId = req.cookies.get(REG_DRAFT_COOKIE)?.value;
  if (draftId) {
    const draft = await prisma.user.findUnique({
      where: { id: draftId, isVerified: false },
      select: { id: true },
    });
    if (draft) {
      return { state: "DRAFT_PENDING_VERIFICATION", draftId: draft.id };
    }
  }

  return { state: "ANONYMOUS" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh Token Rotation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates + rotates a refresh token.
 * - Returns new token pair on success.
 * - If a REVOKED token is presented, nukes the entire session family (reuse detection).
 * - Returns null if the token simply doesn't exist or is expired.
 */
export async function tryRotateRefreshToken(
  rawToken: string,
  req: NextRequest
): Promise<{ userId: string; fph: string; accessToken: string; refreshToken: string } | null> {
  const tokenHash = hashRefreshToken(rawToken);

  const session = await prisma.customerSession.findUnique({
    where: { refreshTokenHash: tokenHash },
    include: { user: { select: { id: true, number: true, name: true, isVerified: true } } },
  });

  if (!session) return null;

  // Reuse detection: token was already revoked → revoke entire session family
  if (session.revokedAtUtc) {
    await prisma.customerSession.updateMany({
      where: { userId: session.userId },
      data: { revokedAtUtc: new Date() },
    });
    return null;
  }

  // Expired?
  if (session.expiresAtUtc < new Date()) {
    return null;
  }

  // User must still be verified
  if (!session.user.isVerified) return null;

  // Device binding check: compute current fingerprint from request headers
  const userAgent = req.headers.get("user-agent") ?? "";
  const visitorId = req.headers.get("x-visitor-id") ?? "";
  const currentFph = visitorId
    ? computeFingerprintHash(visitorId, userAgent)
    : session.deviceFingerprintHash; // allow if no visitor-id header (graceful)

  // Issue new tokens
  const newRaw = generateRefreshToken();
  const newHash = hashRefreshToken(newRaw);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    // Revoke old session
    prisma.customerSession.update({
      where: { id: session.id },
      data: { revokedAtUtc: new Date(), replacedBySessionId: "pending" },
    }),
    // Create new session
    prisma.customerSession.create({
      data: {
        userId: session.userId,
        refreshTokenHash: newHash,
        deviceFingerprintHash: currentFph,
        expiresAtUtc: expiresAt,
      },
    }),
  ]);

  const fph = currentFph;
  const accessToken = signCustomerAccessToken(
    session.userId,
    session.user.number,
    session.user.name,
    fph
  );

  return { userId: session.userId, fph, accessToken, refreshToken: newRaw };
}

/**
 * Create a brand-new session for a user (after PIN or OTP login).
 */
export async function createCustomerSession(
  userId: string,
  number: string,
  name: string,
  fingerprintHash: string
): Promise<{ accessToken: string; refreshToken: string }> {
  const rawRefresh = generateRefreshToken();
  const refreshHash = hashRefreshToken(rawRefresh);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.customerSession.create({
    data: {
      userId,
      refreshTokenHash: refreshHash,
      deviceFingerprintHash: fingerprintHash,
      expiresAtUtc: expiresAt,
    },
  });

  const accessToken = signCustomerAccessToken(userId, number, name, fingerprintHash);
  return { accessToken, refreshToken: rawRefresh };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting (sliding window, Postgres-backed)
// ─────────────────────────────────────────────────────────────────────────────

export class RateLimitExceededError extends Error {
  constructor(public readonly action: string) {
    super(`Rate limit exceeded for action: ${action}`);
    this.name = "RateLimitExceededError";
  }
}

export async function checkRateLimit(
  scopeType: "MOBILE" | "IP" | "DEVICE",
  scopeKey: string,
  action:
    | "SEND_OTP_REGISTER"
    | "SEND_OTP_LOGIN"
    | "SEND_OTP_FORGOT_PIN"
    | "VERIFY_OTP"
    | "LOGIN_PIN_ATTEMPT"
    | "ADD_COMPANY",
  windowMs: number,
  maxEvents: number
): Promise<void> {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitEvent.count({
    where: { scopeType, scopeKey, action, createdAtUtc: { gte: since } },
  });

  if (count >= maxEvents) {
    throw new RateLimitExceededError(action);
  }

  // Record this event
  await prisma.rateLimitEvent.create({
    data: { scopeType, scopeKey, action },
  });
}

/** Check resend cooldown (60 seconds between OTP requests for same mobile) */
export async function checkResendCooldown(mobile: string, action: "SEND_OTP_REGISTER" | "SEND_OTP_LOGIN" | "SEND_OTP_FORGOT_PIN"): Promise<void> {
  const since = new Date(Date.now() - 60 * 1000);
  const recent = await prisma.rateLimitEvent.count({
    where: { scopeType: "MOBILE", scopeKey: mobile, action, createdAtUtc: { gte: since } },
  });
  if (recent > 0) {
    throw new RateLimitExceededError(`${action}_COOLDOWN`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-auth token (issued after OTP verify, before PIN is set)
// Used only to gate the /api/customer/set-pin route
// ─────────────────────────────────────────────────────────────────────────────

export function signPreAuthToken(userId: string): string {
  return jwt.sign({ sub: userId, type: "PRE_AUTH" }, ACCESS_SECRET, {
    expiresIn: 10 * 60, // 10 minutes to complete PIN setup
  });
}

export function verifyPreAuthToken(token: string): { sub: string } | null {
  try {
    const payload = jwt.verify(token, ACCESS_SECRET) as { sub: string; type: string };
    if (payload.type !== "PRE_AUTH") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Limits Helper
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_THALI = 10;
const DEFAULT_MAX_ADDON = 30;

export async function getOrderLimit(
  key: "MAX_THALI_PER_ORDER" | "MAX_ADDON_PER_ORDER",
  fallback: number
): Promise<number> {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row ? parseInt(row.value, 10) : fallback;
}

export { DEFAULT_MAX_THALI, DEFAULT_MAX_ADDON };

// ─────────────────────────────────────────────────────────────────────────────
// IP extraction helper
// ─────────────────────────────────────────────────────────────────────────────

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Block & Ban Checker Helper
// ─────────────────────────────────────────────────────────────────────────────

export async function checkUserAndDeviceStatus(
  userId: string,
  fingerprintHash?: string
): Promise<{ allowed: boolean; code?: string; message?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, statusReason: true },
  });

  if (!user) {
    return { allowed: false, code: "USER_NOT_FOUND", message: "User not found" };
  }

  if (user.status === "BLOCKED") {
    return {
      allowed: false,
      code: "USER_BLOCKED",
      message: user.statusReason ?? "Your account is temporarily restricted.",
    };
  }

  if (user.status === "BANNED") {
    return {
      allowed: false,
      code: "USER_BANNED",
      message: user.statusReason ?? "Your account is permanently restricted.",
    };
  }

  if (fingerprintHash) {
    const blockedDevice = await prisma.deviceFingerprint.findFirst({
      where: { fingerprintHash, isBlocked: true },
      select: { blockedReason: true },
    });
    if (blockedDevice) {
      return {
        allowed: false,
        code: "DEVICE_BLOCKED",
        message: blockedDevice.blockedReason ?? "This device has been restricted.",
      };
    }
  }

  return { allowed: true };
}

export async function resolveAuthState(): Promise<CustomerAuthState> {
  const cookieStore = await cookies();

  // 1. Try access token (fast path)
  const accessToken = cookieStore.get(CUSTOMER_ACCESS_COOKIE)?.value;
  if (accessToken) {
    const claims = verifyCustomerAccessToken(accessToken);
    if (claims) {
      return { state: "VERIFIED_SESSION", userId: claims.sub, fph: claims.fph };
    }
  }

  // 2. Try refresh token (if access token expired)
  const refreshToken = cookieStore.get(CUSTOMER_REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await prisma.customerSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      select: { userId: true, revokedAtUtc: true, expiresAtUtc: true, deviceFingerprintHash: true },
    });
    if (
      session &&
      !session.revokedAtUtc &&
      session.expiresAtUtc > new Date()
    ) {
      return { state: "VERIFIED_SESSION", userId: session.userId, fph: session.deviceFingerprintHash };
    }
  }

  // 3. Check for a pending registration draft
  const draftId = cookieStore.get(REG_DRAFT_COOKIE)?.value;
  if (draftId) {
    const draft = await prisma.user.findUnique({
      where: { id: draftId, isVerified: false },
      select: { id: true },
    });
    if (draft) {
      return { state: "DRAFT_PENDING_VERIFICATION", draftId: draft.id };
    }
  }

  return { state: "ANONYMOUS" };
}
