// src\proxy.ts

import { NextRequest, NextResponse } from "next/server";
import { verifyStaffToken, STAFF_SESSION_COOKIE } from "@/lib/staff-auth";
import {
  ADMIN_AUTHENTICATED_PAGE_PREFIXES,
  ADMIN_ONLY_PAGE_PREFIXES,
  ADMIN_ONLY_API_PREFIXES,
  matchesAny,
} from "@/lib/rbac";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/verify",
  "/staff-login",
  "/api/staff/otp",
  "/api/staff/login-password",
  "/api/staff/set-password",
  "/api/staff/me",      // must be callable pre-auth to check session state
  "/api/staff/logout",  // must be callable to clear a stale/invalid cookie
  "/api/auth/login",
  "/api/auth/logout",
  "/menu",          // CUSTOMER ordering page (/menu and /menu/[slug] public share links)
  "/api/public",    // public menu data API
] as const;

// Routes under /api/customer that are allowed to run with NO session
// (they are the auth flows themselves — everything else must be logged in)
const CUSTOMER_PUBLIC_SUBROUTES = [
  "/api/customer/register",
  "/api/customer/send-otp",
  "/api/customer/verify-otp",
  "/api/customer/set-pin",   // self-authenticated via preAuthToken JWT — no session cookie needed
  "/api/customer/login-pin",
  "/api/customer/forgot-pin",
  "/api/customer/companies",
  "/api/customer/registration/status",
  "/api/customer/products",
  "/api/customer/refresh", // CRITICAL: must be reachable when access token is expired
] as const;

function isPublicCustomerRoute(pathname: string) {
  return matchesAny(pathname, CUSTOMER_PUBLIC_SUBROUTES);
}

function isJwtSyntacticallyValid(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1]));
    if (payload.exp && typeof payload.exp === "number") {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (payload.exp < nowSeconds) {
        return false; // expired
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Every page under src/app/(admin)/ requiring auth is listed in rbac.ts —
// see src/lib/rbac.ts for the single source of truth and the rule that
// every new admin page folder MUST be added there.
const PROTECTED_PREFIXES = ADMIN_AUTHENTICATED_PAGE_PREFIXES;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (pathname === "/" || matchesAny(pathname, PUBLIC_PATHS)) {
    return NextResponse.next();
  }

  // Allow static assets
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Check customer routes
  if (pathname.startsWith("/api/customer")) {
    if (!isPublicCustomerRoute(pathname)) {
      const cookie = request.cookies.get("customer_access")?.value;
      if (!cookie || !isJwtSyntacticallyValid(cookie)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  const isProtectedPage = matchesAny(pathname, PROTECTED_PREFIXES);
  const isProtectedApi =
    pathname.startsWith("/api") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/public") &&
    !pathname.startsWith("/api/customer") &&
    !pathname.startsWith("/api/staff/otp") &&
    !pathname.startsWith("/api/staff/login-password") &&
    !pathname.startsWith("/api/staff/set-password") &&
    !pathname.startsWith("/api/staff/me") &&
    !pathname.startsWith("/api/staff/logout");

  if (isProtectedPage || isProtectedApi) {
    const token = request.cookies.get(STAFF_SESSION_COOKIE)?.value;

    if (!token) {
      if (isProtectedApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return NextResponse.redirect(new URL("/staff-login", request.url));
    }

    const payload = verifyStaffToken(token);
    if (!payload) {
      if (isProtectedApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return NextResponse.redirect(new URL("/staff-login", request.url));
    }

    // Role check: STAFF cannot access admin-only pages/routes.
    // Page paths (e.g. "/staff") and API paths (e.g. "/api/admin/staff") are
    // checked against separate lists on purpose — they're unrelated strings.
    const isAdminOnly = isProtectedPage
      ? matchesAny(pathname, ADMIN_ONLY_PAGE_PREFIXES)
      : matchesAny(pathname, ADMIN_ONLY_API_PREFIXES);

    if (isAdminOnly && payload.role !== "ADMIN") {
      if (isProtectedApi) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts).*)"],
};
