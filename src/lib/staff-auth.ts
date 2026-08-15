import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
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

/**
 * Verifies the staff session cookie AND re-derives role/permissions/status
 * live from the database on every call.
 *
 * IMPORTANT (fixes the "runtime permission change doesn't work" bug):
 * the JWT is only ever used to prove WHO is asking (staffId), never to
 * decide WHAT they're allowed to do. role/permissions/status are always
 * read fresh from StaffUser. This means:
 *   - an admin editing a STAFF member's permissions takes effect on that
 *     STAFF member's very next request (API call or page navigation) —
 *     no re-login required.
 *   - deactivating/deleting a staff member (status !== ACTIVE) still
 *     immediately invalidates the session, as before.
 * This costs nothing extra: the previous version already had to hit the
 * DB on every call for the status check, this just widens the `select`.
 */
export async function verifyStaffSession(req?: NextRequest): Promise<StaffSessionPayload | null> {
  const token = await getStaffSessionToken(req);
  if (!token) return null;

  const decoded = verifyStaffToken(token);
  if (!decoded) return null;

  try {
    const staff = await prisma.staffUser.findUnique({
      where: { id: decoded.staffId },
      select: { role: true, permissions: true, status: true, name: true, mobile: true },
    });

    if (!staff || staff.status !== "ACTIVE") {
      return null;
    }

    return {
      staffId: decoded.staffId,
      mobile: staff.mobile,
      name: staff.name,
      role: staff.role,
      permissions: staff.permissions,
    };
  } catch (err) {
    console.error("verifyStaffSession DB check failed:", err);
    return null;
  }
}

export function hasPermission(session: StaffSessionPayload, permission: string): boolean {
  if (session.role === "ADMIN") return true;
  return Array.isArray(session.permissions) && session.permissions.includes(permission);
}

export function requirePermission(session: StaffSessionPayload, permission: string): void {
  if (!hasPermission(session, permission)) {
    throw new Error("PERMISSION_DENIED");
  }
}

export interface RequireStaffAuthOptions {
  /** If set, only these roles may pass. Omit to allow any authenticated staff. */
  roles?: ("ADMIN" | "STAFF")[];
  /** If set, ADMIN always passes; STAFF must have this permission string. */
  permission?: string;
}

export type RequireStaffAuthResult =
  | { session: StaffSessionPayload; error?: undefined }
  | { session?: undefined; error: NextResponse };

/**
 * One-line auth guard for API route handlers. Loads the session (with the
 * DB ACTIVE-status revocation check AND live role/permissions baked in via
 * verifyStaffSession), and optionally enforces a role allow-list and/or a
 * granular permission string.
 *
 * Usage:
 *   const auth = await requireStaffAuth(req, { permission: "menu:manage" });
 *   if (auth.error) return auth.error;
 *   const { session } = auth;
 */
export async function requireStaffAuth(
  req: NextRequest,
  opts: RequireStaffAuthOptions = {}
): Promise<RequireStaffAuthResult> {
  const session = await verifyStaffSession(req);
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (opts.roles && !opts.roles.includes(session.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  if (opts.permission && !hasPermission(session, opts.permission)) {
    return {
      error: NextResponse.json(
        { error: `Forbidden: missing ${opts.permission} permission` },
        { status: 403 }
      ),
    };
  }
  return { session };
}
