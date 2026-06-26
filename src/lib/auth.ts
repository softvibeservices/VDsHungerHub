import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = "vdh_token";

// 100 days in seconds
const TOKEN_MAX_AGE_SECONDS = 100 * 24 * 60 * 60;

export type AppRole = "ADMIN" | "STAFF" | "CUSTOMER";

export interface TokenPayload {
  id: string;
  number: string;
  name: string;
  role: AppRole;
}

// Legacy alias for any code still importing AdminTokenPayload
export type AdminTokenPayload = TokenPayload;

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_MAX_AGE_SECONDS,
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE_SECONDS, // 100 days
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  // Also clear legacy cookie if present
  cookieStore.delete("vd_admin_token");
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  // Support new cookie name first, then fall back to legacy
  return (
    cookieStore.get(COOKIE_NAME)?.value ??
    cookieStore.get("vd_admin_token")?.value
  );
}

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return verifyToken(token);
}

// Keep old name as alias so existing code doesn't break during migration
export const getCurrentAdmin = getCurrentUser;
