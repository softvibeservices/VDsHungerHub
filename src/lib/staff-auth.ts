import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { prisma } from "./prisma";

const JWT_SECRET = process.env.JWT_SECRET!;
export const STAFF_SESSION_COOKIE = "tos_staff_session";

// 100 days in seconds
const TOKEN_MAX_AGE_SECONDS = 100 * 24 * 60 * 60;

export interface StaffSessionPayload {
  staffId: string;
  mobile: string;
  name: string;
  role: "ADMIN" | "STAFF";
  permissions: string[];
}

export function signStaffToken(payload: StaffSessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_MAX_AGE_SECONDS,
  });
}

export function verifyStaffToken(token: string): StaffSessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as StaffSessionPayload;
  } catch {
    return null;
  }
}

export async function setStaffSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(STAFF_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE_SECONDS,
    path: "/",
  });
}

export async function clearStaffSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_SESSION_COOKIE);
  // Also clear legacy cookies for safety
  cookieStore.delete("vdh_token");
  cookieStore.delete("vd_admin_token");
}

export async function getStaffSessionToken(req?: NextRequest): Promise<string | undefined> {
  if (req) {
    return req.cookies.get(STAFF_SESSION_COOKIE)?.value;
  }
  const cookieStore = await cookies();
  return cookieStore.get(STAFF_SESSION_COOKIE)?.value;
}

export async function verifyStaffSession(req?: NextRequest): Promise<StaffSessionPayload | null> {
  const token = await getStaffSessionToken(req);
  if (!token) return null;

  const decoded = verifyStaffToken(token);
  if (!decoded) return null;

  // Active status check (database lookup to support immediate revocation)
  try {
    const staff = await prisma.staffUser.findUnique({
      where: { id: decoded.staffId },
      select: { status: true },
    });

    if (!staff || staff.status !== "ACTIVE") {
      return null;
    }

    return decoded;
  } catch (err) {
    console.error("verifyStaffSession DB check failed:", err);
    return null;
  }
}

export function requirePermission(session: StaffSessionPayload, permission: string): void {
  if (session.role === "ADMIN") return;
  if (!session.permissions.includes(permission)) {
    throw new Error("PERMISSION_DENIED");
  }
}
