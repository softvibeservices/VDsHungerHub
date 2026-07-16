import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import type { TokenPayload } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/register",
  "/verify",
  "/staff-login",
  "/api/staff/otp",
  "/api/staff/me",      // must be callable pre-auth to check session state
  "/api/staff/logout",  // must be callable to clear a stale/invalid cookie
  "/api/auth/login",
  "/api/auth/logout",
  "/menu",          // CUSTOMER ordering page (/menu and /menu/[slug] public share links)
  "/api/public",    // public menu data API
];

// Routes under /api/customer that are allowed to run with NO session
// (they are the auth flows themselves — everything else must be logged in)
const CUSTOMER_PUBLIC_SUBROUTES = [
  "/api/customer/register",
  "/api/customer/send-otp",
  "/api/customer/verify-otp",
  "/api/customer/login-pin",
  "/api/customer/login-otp/verify",
  "/api/customer/forgot-pin",
  "/api/customer/companies",
  "/api/customer/registration/status",
  "/api/customer/products",
];

function isPublicCustomerRoute(pathname: string) {
  return CUSTOMER_PUBLIC_SUBROUTES.some((p) => pathname.startsWith(p));
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

// Pages only ADMIN can access
const ADMIN_ONLY_PREFIXES = ["/companies", "/users", "/api/companies", "/api/users", "/api/admin/staff"];

// Pages both ADMIN and STAFF can access (require authentication)
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/companies",
  "/users",
  "/catalog",
  "/daily-menu",   // Admin menu management page (NOT the customer /menu page)
  "/orders",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
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

  const isProtectedPage = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedApi =
    pathname.startsWith("/api") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/public") &&
    !pathname.startsWith("/api/customer") &&
    !pathname.startsWith("/api/staff/otp");

  if (isProtectedPage || isProtectedApi) {
    const token =
      request.cookies.get("tos_staff_session")?.value ??
      request.cookies.get("vdh_token")?.value ??
      request.cookies.get("vd_admin_token")?.value; // legacy cookie support

    if (!token) {
      if (isProtectedApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return NextResponse.redirect(new URL("/staff-login", request.url));
    }

    const payload: TokenPayload | null = verifyToken(token);
    if (!payload) {
      if (isProtectedApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return NextResponse.redirect(new URL("/staff-login", request.url));
    }

    // Role check: STAFF cannot access admin-only pages/routes
    const isAdminOnly = ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p));
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
