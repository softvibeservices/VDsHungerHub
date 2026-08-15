// src/lib/rbac.ts
//
// Single source of truth for role-based page/API access in the (admin) route
// group. Imported by src/proxy.ts (server-side enforcement) and
// src/app/(admin)/layout.tsx (client-side defense-in-depth).
//
// RULE: every folder under src/app/(admin)/ MUST have an entry in
// ADMIN_AUTHENTICATED_PAGE_PREFIXES. If it doesn't, proxy.ts will not protect
// it at all and it will silently fall back to relying on the client-side
// check in (admin)/layout.tsx only — which is what caused this bug in the
// first place. Keep this file in sync with Sidebar.tsx's navSections.

export type StaffRole = "ADMIN" | "STAFF";

/**
 * Every page prefix inside src/app/(admin)/ that requires ANY authenticated
 * staff session (ADMIN or STAFF). This must be a superset of
 * ADMIN_ONLY_PAGE_PREFIXES and PERMISSION_GATED_PAGE_PREFIXES below.
 */
export const ADMIN_AUTHENTICATED_PAGE_PREFIXES = [
  "/dashboard",
  "/daily-menu",
  "/orders",
  "/catalog",
  "/settings",
  "/companies",
  "/users",
  "/staff",
  "/credit",
  "/profile",
] as const;

/**
 * Page prefixes that require the ADMIN role, with NO permission able to
 * unlock them for STAFF. These are the two sections with no corresponding
 * entry in the permission catalog on purpose: staff management (you should
 * never be able to delegate "manage who has access" to a non-admin) and the
 * credit/payment ledger (financial data). Enforced at the Edge in proxy.ts
 * using the JWT's `role` field directly — safe to do without a DB round
 * trip because role is immutable after account creation (see the
 * "Updating role is prohibited via API" guard in
 * /api/admin/staff/[id]/route.ts).
 *
 * Mirrors Sidebar.tsx's `roles: ["ADMIN"]` (with no `permission` set) nav
 * items exactly — if you add a new hard-admin-only nav item to the
 * Sidebar, add its prefix here too.
 */
export const ADMIN_ONLY_PAGE_PREFIXES = [
  "/staff",
  "/credit",
] as const;

/**
 * Page prefixes that ANY authenticated staff may load (edge/layout will not
 * block them), but whose content requires a specific permission to be
 * useful/visible. This is intentionally NOT checked inside proxy.ts —
 * Edge middleware only has the JWT to work with, and permissions must be
 * read live from the database (see src/lib/staff-auth.ts#verifyStaffSession)
 * to avoid the exact staleness bug this whole implementation plan fixes.
 * Instead this map is consulted:
 *   1. Client-side in src/app/(admin)/layout.tsx, using permissions fetched
 *      fresh from /api/staff/me (which itself always reads live from the DB).
 *   2. Server-side, independently, inside each API route under
 *      /api/companies and /api/users via requireStaffAuth({ permission }).
 * (2) is what actually protects the data — (1) is UX polish so a STAFF
 * member without the permission is redirected before they see an empty/
 * erroring page instead of after.
 */
export const PERMISSION_GATED_PAGE_PREFIXES: Record<string, string> = {
  "/companies": "companies:moderate",
  "/users": "users:moderate",
};

/**
 * API prefixes (outside of /api/admin/*) that require the ADMIN role,
 * unconditionally, for every method (GET included).
 * NOTE: proxy.ts's generic `isProtectedApi` check already requires SOME
 * valid staff session for every /api/* route that isn't customer/public/auth
 * related. This list only flags which of those additionally require ADMIN
 * for ALL methods. /api/companies and /api/users are intentionally NOT
 * listed here — their GET handlers accept the companies:moderate /
 * users:moderate permission as an alternative to ADMIN (see those route
 * files), while their POST/PUT/DELETE handlers keep their own explicit
 * `requireStaffAuth(req, { roles: ["ADMIN"] })` check inline.
 */
export const ADMIN_ONLY_API_PREFIXES = [
  "/api/admin/staff",
  "/api/admin/credit",
  "/api/admin/settings",
] as const;

/** Boundary-safe prefix match: "/staff" must NOT match "/staff-login". */
function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export function matchesAny(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((p) => matchesPrefix(pathname, p));
}

export function isAdminAuthenticatedPage(pathname: string): boolean {
  return matchesAny(pathname, ADMIN_AUTHENTICATED_PAGE_PREFIXES);
}

export function isAdminOnlyPage(pathname: string): boolean {
  return matchesAny(pathname, ADMIN_ONLY_PAGE_PREFIXES);
}

export function isAdminOnlyApi(pathname: string): boolean {
  return matchesAny(pathname, ADMIN_ONLY_API_PREFIXES);
}

/**
 * Returns the permission string required to use `pathname`'s page, or null
 * if the page has no permission gate (either because it's open to any
 * authenticated staff, or because it's ADMIN_ONLY_PAGE_PREFIXES which is
 * checked separately).
 */
export function requiredPermissionForPage(pathname: string): string | null {
  for (const prefix of Object.keys(PERMISSION_GATED_PAGE_PREFIXES)) {
    if (matchesPrefix(pathname, prefix)) return PERMISSION_GATED_PAGE_PREFIXES[prefix];
  }
  return null;
}
