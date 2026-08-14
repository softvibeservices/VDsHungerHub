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
 * ADMIN_ONLY_PAGE_PREFIXES below.
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
] as const;

/**
 * Page prefixes that additionally require the ADMIN role. A STAFF user
 * hitting one of these gets redirected to /dashboard (page nav) or a 403
 * (page-level API calls made from that page).
 * Mirrors Sidebar.tsx's `roles: ["ADMIN"]` nav items exactly — if you add a
 * new admin-only nav item to the Sidebar, add its prefix here too.
 */
export const ADMIN_ONLY_PAGE_PREFIXES = [
  "/companies",
  "/users",
  "/staff",
  "/credit",
] as const;

/**
 * API prefixes (outside of /api/admin/*) that require the ADMIN role.
 * NOTE: proxy.ts's generic `isProtectedApi` check already requires SOME
 * valid staff session for every /api/* route that isn't customer/public/auth
 * related. This list only flags which of those additionally require ADMIN.
 */
export const ADMIN_ONLY_API_PREFIXES = [
  "/api/companies",
  "/api/users",
  "/api/admin/staff",
  "/api/admin/credit",
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
