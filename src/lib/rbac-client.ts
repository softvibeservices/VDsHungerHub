// src/lib/rbac-client.ts
//
// Client-side mirror of src/lib/staff-auth.ts#hasPermission. Deliberately
// has ZERO server-only imports (no next/headers, no prisma) so it's safe to
// import from "use client" components. This is a UX convenience layer only —
// the real enforcement is server-side in each API route via
// requireStaffAuth({ permission }). Never trust this on its own for
// anything security-sensitive; only use it to hide/disable controls.

export interface ClientStaffUser {
  role?: string;
  permissions?: string[];
}

export function hasPermission(
  user: ClientStaffUser | null | undefined,
  permission: string
): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}
