import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

const PROTECTED_PAGE_PREFIXES = [
  "/dashboard",
  "/companies",
  "/users",
  "/products",
  "/thalis",
  "/staff",
  "/menu",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Protect admin pages
  const isProtectedPage = PROTECTED_PAGE_PREFIXES.some((p) =>
    pathname.startsWith(p)
  );

  // Protect API routes (except auth)
  const isProtectedApi =
    pathname.startsWith("/api") && !pathname.startsWith("/api/auth");

  if (isProtectedPage || isProtectedApi) {
    const token = request.cookies.get("vd_admin_token")?.value;

    if (!token || !verifyToken(token)) {
      if (isProtectedApi) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts).*)"],
};
