import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import type { TokenPayload } from "@/lib/auth";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/menu",          // public menu pages (/menu/[slug], /menu/orders)
  "/api/public",    // public menu data API
  "/api/user-auth", // user OTP auth — uses Bearer JWT, not admin cookie
  "/api/orders",    // user order placement/history — uses Bearer JWT
];

// Pages only ADMIN can access
const ADMIN_ONLY_PREFIXES = ["/companies", "/users", "/api/companies", "/api/users"];

// Pages both ADMIN and STAFF can access (require authentication)
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/companies",
  "/users",
  "/catalog",
  "/menu",
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

  const isProtectedPage = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isProtectedApi =
    pathname.startsWith("/api") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.startsWith("/api/public");

  if (isProtectedPage || isProtectedApi) {
    const token =
      request.cookies.get("vdh_token")?.value ??
      request.cookies.get("vd_admin_token")?.value; // legacy cookie support

    if (!token) {
      if (isProtectedApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const payload: TokenPayload | null = verifyToken(token);
    if (!payload) {
      if (isProtectedApi) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      return NextResponse.redirect(new URL("/login", request.url));
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
