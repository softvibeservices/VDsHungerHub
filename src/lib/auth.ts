import bcrypt from "bcryptjs";
import { verifyStaffToken, clearStaffSessionCookie } from "@/lib/staff-auth";

export type AppRole = "ADMIN" | "STAFF" | "CUSTOMER";

export interface TokenPayload {
  id: string;
  number: string;
  name: string;
  role: AppRole;
}

export type AdminTokenPayload = TokenPayload;

export function verifyToken(token: string): TokenPayload | null {
  const staffSession = verifyStaffToken(token);
  if (staffSession) {
    return {
      id: staffSession.staffId,
      number: staffSession.mobile || "",
      name: staffSession.name || "",
      role: staffSession.role as AppRole,
    };
  }
  return null;
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

export async function clearAuthCookie() {
  await clearStaffSessionCookie();
}
