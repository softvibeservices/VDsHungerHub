import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";

const USER_JWT_SECRET = process.env.USER_JWT_SECRET!;
const USER_JWT_EXPIRES_IN = process.env.USER_JWT_EXPIRES_IN ?? "180d";

export interface UserTokenPayload {
  sub: string;       // userId (User.id from DB)
  number: string;    // 10-digit mobile number
  name: string;
  companyId: string;
  companyName: string;
  role: "USER";
  iat?: number;
  exp?: number;
}

export function signUserToken(
  payload: Omit<UserTokenPayload, "role">
): string {
  return jwt.sign(
    { ...payload, role: "USER" },
    USER_JWT_SECRET,
    { expiresIn: USER_JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

export function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, USER_JWT_SECRET) as UserTokenPayload;
  } catch {
    return null;
  }
}

export function getUserFromRequest(req: NextRequest): UserTokenPayload | null {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return null;
  return verifyUserToken(token);
}

/**
 * Build a deterministic device fingerprint from browser signals.
 * Called client-side; result is sent to server with each auth request.
 * NOT a security control — only used for UX session persistence.
 */
export async function getDeviceHash(): Promise<string> {
  const raw = [
    navigator.userAgent,
    screen.width.toString(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}


