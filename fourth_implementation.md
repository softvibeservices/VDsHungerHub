# VD's Hunger Hub — Fourth Implementation Plan

**Prepared for:** SoftVibe Services · VD's Hunger Hub  
**Scope:** Auth role unification, UTC/IST time, Template redesign, Sabji-at-menu-time, Bulk Product upload, 100-day JWT, Login page cleanup  
**Codebase state going in:** Reflects everything built through `third_implementation.md`

---

## Table of Contents

1. [Change Summary](#1-change-summary)
2. [Phase A — Auth & Roles Overhaul](#2-phase-a--auth--roles-overhaul)
   - A1. Schema: Unified `AppUser` table (Admin / Staff / Customer)
   - A2. JWT: 100-day token, role in payload
   - A3. Login page: Remove "Admin Login" label, single unified form
   - A4. Middleware (`proxy.ts`): Role-aware protection
   - A5. Sidebar: Show role badge, dynamic name from JWT
   - A6. Staff management: Admin creates Staff via Catalog tab
3. [Phase B — UTC Storage / IST Display](#3-phase-b--utc-storage--ist-display)
   - B1. `src/lib/time.ts` — Central time utility
   - B2. DB: `cutoffTime` column migration (string → `DateTime`)
   - B3. API routes: Store UTC, return UTC ISO strings
   - B4. UI everywhere: Display in IST
4. [Phase C — Templates Redesign](#4-phase-c--templates-redesign)
   - C1. What templates actually do (clear definition)
   - C2. New UX: Save-as-template inline on menu page
   - C3. New UX: Load template as one-click autocomplete
   - C4. Template management modal (list / rename / delete)
   - C5. API: `menu-templates` route (already exists, extend it)
5. [Phase D — Sabji Selection Moved to Menu Creation](#5-phase-d--sabji-selection-moved-to-menu-creation)
   - D1. What changes (current state vs target state)
   - D2. Thali creation: Remove sabji picker, keep `maxSabjiCount` only
   - D3. Menu creation: Sabji selection with fast DB search
   - D4. `0-sabji` thalis: Automatic skip of sabji section
   - D5. API changes
6. [Phase E — Bulk Product Upload](#6-phase-e--bulk-product-upload)
   - E1. New `BulkProductModal` component
   - E2. Row-by-row preview table before DB insert
   - E3. API route `POST /api/products/bulk`
   - E4. CSV format + sample file
7. [Phase F — UX Polish](#7-phase-f--ux-polish)
8. [Schema Migration SQL](#8-schema-migration-sql)
9. [File-by-File Change Index](#9-file-by-file-change-index)
10. [Environment Variables](#10-environment-variables)
11. [Build Order](#11-build-order)

---

## 1. Change Summary

| # | Change | Why |
|---|---|---|
| A | Unified login for Admin + Staff (same `/login` page, DB decides role) | Staff needs to log in |
| A | JWT lasts 100 days | Admin hates logging in daily |
| A | Remove "Admin Login" text from login page | Staff uses same page |
| A | 3 roles in DB: `ADMIN`, `STAFF`, `CUSTOMER` | Future-proof; customer unused for now |
| A | `proxy.ts` reads role from JWT, protects accordingly | Staff should not access Companies / Users |
| B | All times stored as UTC `DateTime` in DB | Correctness |
| B | All UI displays in IST (UTC+5:30) | India-only product |
| B | Single `src/lib/time.ts` utility for all conversions | Consistency |
| C | Templates redesigned: clear "Save current menu as template → Load template" flow | Old button-in-dropdown was confusing |
| D | Sabji selection removed from Thali creation, moved to Menu creation | Correct UX — sabji changes daily, thali structure does not |
| D | Thalis with `maxSabjiCount = 0` auto-skip the sabji section | Clean UX for no-sabji thalis |
| E | Bulk product upload with CSV preview before insert | Requested feature |

---

## 2. Phase A — Auth & Roles Overhaul

### A1. Prisma Schema — Unified `AppUser` Table

**Current state:** `Admin` model handles login. `Staff` model has no login column (no password). Login is only for admins.

**Target state:** One `AppUser` table handles all logins. The existing `Admin` record becomes an `AppUser` with role `ADMIN`. Staff added via the Catalog tab also get an `AppUser` record with role `STAFF`. `CUSTOMER` role exists in enum but no login UI is built for them yet.

The old `Admin` model and old `Staff` model are kept as-is for now — we add `AppUser` alongside them and migrate login to it. This is safer than dropping tables.

```prisma
// ─────────────────────────────────────────
// APP USER (unified login)
// ─────────────────────────────────────────
enum AppRole {
  ADMIN
  STAFF
  CUSTOMER
}

model AppUser {
  id        String   @id @default(cuid())
  name      String
  number    String   @unique   // 10-digit mobile, used as username
  password  String             // bcrypt hashed — null-safe: CUSTOMER rows have no password
  role      AppRole  @default(STAFF)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Migration steps:**

1. Run migration to create `AppUser` table and `AppRole` enum.
2. Run a one-time data migration in `seed.ts` (or a standalone script) that:
   - Copies the existing `Admin` row → new `AppUser` with `role = ADMIN`, same `number` and `password`.
   - Copies every `Staff` row → new `AppUser` with `role = STAFF`, same `number`, and a temporary hashed password (`VDStaff@2024` or admin sets it manually later).

```ts
// prisma/seed.ts additions (run after schema migration)

// Migrate existing Admin → AppUser ADMIN
const existingAdmin = await prisma.admin.findFirst();
if (existingAdmin) {
  await prisma.appUser.upsert({
    where: { number: existingAdmin.number },
    update: {},
    create: {
      name: existingAdmin.name,
      number: existingAdmin.number,
      password: existingAdmin.password, // already bcrypt hashed
      role: "ADMIN",
    },
  });
}

// Migrate existing Staff → AppUser STAFF
const staffMembers = await prisma.staff.findMany();
const defaultPassword = await bcrypt.hash("VDStaff@2024", 12);
for (const s of staffMembers) {
  await prisma.appUser.upsert({
    where: { number: s.number },
    update: {},
    create: {
      name: s.name,
      number: s.number,
      password: defaultPassword,
      role: "STAFF",
    },
  });
}
```

---

### A2. `src/lib/auth.ts` — 100-Day JWT, Role in Payload

**Full replacement of `auth.ts`:**

```ts
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = "vdh_token";

// 100 days in seconds
const TOKEN_MAX_AGE_SECONDS = 100 * 24 * 60 * 60;

export type AppRole = "ADMIN" | "STAFF" | "CUSTOMER";

export interface TokenPayload {
  id: string;
  number: string;
  name: string;
  role: AppRole;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: TOKEN_MAX_AGE_SECONDS,
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_MAX_AGE_SECONDS, // 100 days
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  // Support both old cookie name (vd_admin_token) and new (vdh_token) during migration
  return (
    cookieStore.get(COOKIE_NAME)?.value ??
    cookieStore.get("vd_admin_token")?.value
  );
}

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const token = await getAuthToken();
  if (!token) return null;
  return verifyToken(token);
}

// Keep old name as alias so existing code doesn't break during migration
export const getCurrentAdmin = getCurrentUser;
```

**Why 100 days:** `maxAge: TOKEN_MAX_AGE_SECONDS` on the cookie and `expiresIn: TOKEN_MAX_AGE_SECONDS` on the JWT both set to `100 * 24 * 60 * 60 = 8,640,000 seconds`. The cookie will survive browser restarts and the admin/staff never needs to log in again until the token expires. Add `JWT_EXPIRES_IN` env variable to `.env.example` as `"8640000"` (or simply hardcode in auth.ts as done above for clarity).

---

### A3. `src/app/api/auth/login/route.ts` — Query `AppUser` Instead of `Admin`

**Full replacement:**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, setAuthCookie } from "@/lib/auth";
import { cleanMobileNumber } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { number, password } = await req.json();

    if (!number || !password) {
      return NextResponse.json(
        { error: "Mobile number and password are required" },
        { status: 400 }
      );
    }

    const cleanNumber = cleanMobileNumber(String(number));

    // Look up in unified AppUser table
    const user = await prisma.appUser.findUnique({
      where: { number: cleanNumber },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid mobile number or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Contact the admin." },
        { status: 403 }
      );
    }

    const passwordValid = await comparePassword(password, user.password);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid mobile number or password" },
        { status: 401 }
      );
    }

    const token = signToken({
      id: user.id,
      number: user.number,
      name: user.name,
      role: user.role,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        number: user.number,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
```

---

### A4. `src/app/(auth)/login/page.tsx` — Remove "Admin Login" Label

The login page currently says "Admin Login" prominently. Replace all "Admin Login" / "Admin" text with generic branding. Staff use the exact same form.

**Changes to `login/page.tsx`:**

```tsx
// BEFORE:
<h1 className="text-xl font-bold text-gray-900">Admin Login</h1>
<p className="text-sm text-gray-500 mt-1">Sign in to manage VD&apos;s Hunger Hub</p>

// AFTER:
<h1 className="text-xl font-bold text-gray-900">Welcome Back</h1>
<p className="text-sm text-gray-500 mt-1">Sign in to VD&apos;s Hunger Hub</p>
```

Also update the redirect after login — check the role from the API response:

```tsx
const handleLogin = async (data: FormData) => {
  setIsSubmitting(true);
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Login failed");
    
    // Both ADMIN and STAFF go to /dashboard after login
    router.push("/dashboard");
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : "Login failed");
  } finally {
    setIsSubmitting(false);
  }
};
```

Also update the form field label from "Admin Mobile Number" → "Mobile Number":

```tsx
// BEFORE:
<Input label="Admin Mobile Number" ... />

// AFTER:
<Input label="Mobile Number" ... />
```

---

### A5. `src/proxy.ts` — Role-Aware Middleware

Currently the middleware only checks if a token is present. It must also read the `role` from the token and block `STAFF` from pages they shouldn't access.

**ADMIN can access:** Everything  
**STAFF can access:** `/dashboard`, `/menu`, `/catalog` (read-only view)  
**STAFF cannot access:** `/companies`, `/users`  

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, TokenPayload } from "@/lib/auth";

const PUBLIC_PATHS = ["/", "/login", "/api/auth/login", "/api/auth/logout", "/menu", "/api/public"];

// Pages only ADMIN can access
const ADMIN_ONLY_PREFIXES = ["/companies", "/users"];

// Pages both ADMIN and STAFF can access
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/companies",
  "/users",
  "/catalog",
  "/menu",
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
  const isProtectedApi = pathname.startsWith("/api") && !pathname.startsWith("/api/auth") && !pathname.startsWith("/api/public");

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

    // Role check: STAFF cannot access admin-only pages
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
```

---

### A6. `src/components/admin/Sidebar.tsx` — Show Role & Dynamic Name

The sidebar currently hardcodes "VD Admin" and "+91 63563 50086". It must read from the JWT.

**Add a hook `src/hooks/useCurrentUser.ts`:**

```ts
"use client";
import { useEffect, useState } from "react";
import type { TokenPayload } from "@/lib/auth";

export function useCurrentUser(): TokenPayload | null {
  const [user, setUser] = useState<TokenPayload | null>(null);

  useEffect(() => {
    // Read from a non-httpOnly cookie or an /api/auth/me endpoint
    // Since our cookie is httpOnly, we use a lightweight /api/auth/me endpoint
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  return user;
}
```

**New API route `src/app/api/auth/me/route.ts`:**

```ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({ user });
}
```

**Update `Sidebar.tsx` bottom section:**

```tsx
// At top of component:
const currentUser = useCurrentUser();

// In JSX (replace hardcoded name/number):
<div className="flex items-center gap-3 mb-3 px-1">
  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
    {currentUser?.name?.charAt(0)?.toUpperCase() ?? "?"}
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-gray-200 text-xs font-semibold truncate">
      {currentUser?.name ?? "Loading..."}
    </p>
    <p className="text-gray-500 text-xs truncate">
      {currentUser?.role === "ADMIN" ? "🔑 Admin" : "👤 Staff"}
    </p>
  </div>
</div>
```

**Hide Companies + Users from the nav for STAFF:**

```tsx
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["ADMIN", "STAFF"] },
  { href: "/companies", icon: Building2, label: "Companies", roles: ["ADMIN"] },
  { href: "/users", icon: Users, label: "Users", roles: ["ADMIN"] },
  { href: "/catalog", icon: ShoppingBasket, label: "Catalog", roles: ["ADMIN", "STAFF"] },
  { href: "/menu", icon: CalendarDays, label: "Daily Menu", roles: ["ADMIN", "STAFF"] },
];

// In render:
{navItems
  .filter(item => !currentUser || item.roles.includes(currentUser.role))
  .map(({ href, icon: Icon, label }) => (
    // ...existing link JSX unchanged
  ))
}
```

---

### A7. Staff Creation Flow — Admin Sets Password

When Admin creates a Staff via **Catalog → Staff → Add Staff**, the modal now shows a password field. This creates an `AppUser` row alongside the `Staff` row.

**Update `StaffModal.tsx` to include a password field when creating new staff:**

```tsx
const schema = z.object({
  name: z.string().min(2, "Name required"),
  number: z.string().min(10, "10-digit mobile required"),
  // Password only required on create, not edit
  password: z.string().min(6, "Min 6 characters").optional(),
});
```

Show the password field only when `!staff` (create mode):

```tsx
{!isEdit && (
  <Input
    label="Password"
    type="password"
    placeholder="Minimum 6 characters"
    required
    error={errors.password?.message}
    {...register("password")}
  />
)}
```

**Update `src/app/api/staff/route.ts` POST handler** — when creating staff, also create an `AppUser`:

```ts
// In POST handler, after creating Staff record:
if (password) {
  const hashedPw = await bcrypt.hash(password, 12);
  await prisma.appUser.upsert({
    where: { number: cleanNumber },
    update: { name, isActive: true },
    create: {
      name,
      number: cleanNumber,
      password: hashedPw,
      role: "STAFF",
    },
  });
}
```

**Update `src/app/api/staff/[id]/route.ts` DELETE handler** — when deleting staff, also deactivate the `AppUser`:

```ts
// After deleting Staff record:
await prisma.appUser.updateMany({
  where: { number: staff.number },
  data: { isActive: false },
});
```

---

## 3. Phase B — UTC Storage / IST Display

### B1. `src/lib/time.ts` — Central Time Utility (NEW FILE)

Create this file. Every part of the app that touches time must use functions from here.

```ts
// src/lib/time.ts

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/**
 * Convert a UTC Date object to the equivalent IST Date object.
 * Use only for display — do not store the returned Date in DB.
 */
export function toIST(utcDate: Date): Date {
  return new Date(utcDate.getTime() + IST_OFFSET_MS);
}

/**
 * Get today's date string (YYYY-MM-DD) in IST.
 * Replaces the old getTodayIST() in utils.ts.
 */
export function getTodayIST(): string {
  const ist = toIST(new Date());
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format a UTC Date for display in IST.
 * e.g. "26 Jun 2026, 11:30 AM"
 */
export function formatDateTimeIST(utcDate: Date | string): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format only the time part of a UTC Date in IST.
 * e.g. "11:30 AM"
 */
export function formatTimeIST(utcDate: Date | string): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format only the date part of a UTC Date in IST.
 * e.g. "26 Jun 2026"
 */
export function formatDateIST(utcDate: Date | string): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Convert a "HH:MM" IST time string + a date string (YYYY-MM-DD IST)
 * into a UTC DateTime object for DB storage.
 *
 * Example: cutoffTime = "11:30", date = "2026-06-26" (IST)
 * → stores as 2026-06-26T06:00:00.000Z in DB
 */
export function istTimeToUTC(istTimeHHMM: string, istDateYYYYMMDD: string): Date {
  const [h, m] = istTimeHHMM.split(":").map(Number);
  const [y, mo, d] = istDateYYYYMMDD.split("-").map(Number);
  // Build an IST moment as a UTC timestamp
  const utcMs =
    Date.UTC(y, mo - 1, d, h, m, 0, 0) - IST_OFFSET_MS;
  return new Date(utcMs);
}

/**
 * Convert a UTC DateTime back to a "HH:MM" IST string for display.
 */
export function utcToISTTimeString(utcDate: Date | string): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  const ist = toIST(d);
  const h = String(ist.getUTCHours()).padStart(2, "0");
  const m = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Parse a YYYY-MM-DD IST date string and return a UTC Date
 * that represents midnight IST on that day.
 */
export function istDateToUTC(istDateYYYYMMDD: string): Date {
  const [y, m, d] = istDateYYYYMMDD.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - IST_OFFSET_MS);
}
```

**Update `src/lib/utils.ts`:** Remove the old `getTodayIST()` and `getTodayString()`. Both are now in `time.ts`. Keep all other functions (`formatCurrency`, `formatMobileNumber`, etc.) in `utils.ts`. Update all imports throughout the codebase.

---

### B2. DB: `cutoffTime` Column — String → DateTime

Currently `DailyMenu.cutoffTime` is `String?` storing values like `"11:30"`. This is not timezone-aware. Migrate it to `DateTime?`.

**Schema change:**

```prisma
model DailyMenu {
  // ...existing fields...
  cutoffTime  DateTime?   // WAS: String? — now UTC DateTime
  // ...
}
```

**Migration SQL:**

```sql
-- Step 1: Add new column
ALTER TABLE "DailyMenu" ADD COLUMN "cutoffTimeUTC" TIMESTAMP(3);

-- Step 2: Convert existing "HH:MM" strings to UTC DateTime
-- The stored strings are assumed to be IST times on the menu's date.
-- IST = UTC + 5:30, so subtract 5h30m = 330 minutes
UPDATE "DailyMenu"
SET "cutoffTimeUTC" = (
  date::timestamp
  + (SPLIT_PART("cutoffTime", ':', 1)::int * 60 + SPLIT_PART("cutoffTime", ':', 2)::int) * INTERVAL '1 minute'
  - INTERVAL '330 minutes'
)
WHERE "cutoffTime" IS NOT NULL;

-- Step 3: Drop old column, rename new column
ALTER TABLE "DailyMenu" DROP COLUMN "cutoffTime";
ALTER TABLE "DailyMenu" RENAME COLUMN "cutoffTimeUTC" TO "cutoffTime";
```

Run as: `npx prisma migrate dev --name v4_utc_cutoff_time`

---

### B3. API Routes — Store UTC, Return UTC ISO Strings

**`src/app/api/menu/route.ts` (POST) and `src/app/api/menu/[id]/route.ts` (PUT):**

The client sends `cutoffTime` as an `"HH:MM"` string (IST). The API converts it to UTC before storing.

```ts
import { istTimeToUTC } from "@/lib/time";

// In POST handler:
const { date, mealType, cutoffTime, thaliIds, sabjiOptions, minSabjiMap } = await req.json();

// date is "YYYY-MM-DD" in IST
// cutoffTime is "HH:MM" in IST

const cutoffTimeUTC = cutoffTime
  ? istTimeToUTC(cutoffTime, date)
  : null;

// Use cutoffTimeUTC when creating/updating DailyMenu
await prisma.dailyMenu.create({
  data: {
    date: new Date(date + "T00:00:00+05:30"), // IST midnight → correct UTC
    mealType,
    cutoffTime: cutoffTimeUTC,
    // ...
  },
});
```

**Important note on `date` field:** The `DailyMenu.date` is stored as `@db.Date` (date-only, no time). Prisma stores `Date` columns as midnight UTC. To ensure "June 26 IST" maps to `2026-06-26` in the DB (not `2026-06-25` due to UTC offset), always construct the date with IST midnight:

```ts
// Correct: parse "2026-06-26" as IST midnight
const menuDate = new Date(date + "T00:00:00+05:30");
```

**`GET /api/menu?date=YYYY-MM-DD` response:** Return `cutoffTime` as an ISO UTC string. The client uses `utcToISTTimeString()` to display it.

---

### B4. UI — Display IST Everywhere

**`src/app/(admin)/menu/page.tsx`:**

```tsx
import { getTodayIST, utcToISTTimeString, istTimeToUTC } from "@/lib/time";

// Show cutoff time:
<span>{menu.cutoffTime ? utcToISTTimeString(menu.cutoffTime) : "No cutoff"}</span>

// Time input (user enters IST):
<input
  type="time"
  defaultValue={menu.cutoffTime ? utcToISTTimeString(menu.cutoffTime) : "11:30"}
  // When saving, the API receives this HH:MM string and converts to UTC
/>
```

**`src/app/(admin)/dashboard/page.tsx`:** Any displayed time (e.g., "Cutoff: 11:30") must call `utcToISTTimeString(menu.cutoffTime)` if the value is a DateTime, not a raw string.

**`src/app/menu/[slug]/page.tsx` (public menu):** Same — display cutoff in IST.

---

## 4. Phase C — Templates Redesign

### C1. What Templates Are (Clear Definition)

**A template is a saved snapshot of a menu configuration** — specifically: which thalis are selected + which sabji products are assigned to each thali + the cutoff time. Templates exist so the admin doesn't have to re-pick the same 3 thalis + 5 sabji items every single day.

**Typical workflow:**
1. Monday: Admin sets up Lunch menu manually (picked 3 thalis, assigned sabji to each).
2. Admin clicks "💾 Save as Template" → names it "Standard Lunch".
3. Tuesday: Admin opens the menu page, clicks "📋 Load Template → Standard Lunch".
4. The entire Lunch section auto-fills. Admin only changes what's different today (e.g., swap one sabji).
5. Admin hits Save.

This is the **only** purpose of templates. It is not a "scheduled auto-publish" — admin must still review and save each day.

---

### C2. New Template UX on `menu/page.tsx`

**Old confusing UX:** A "Templates" dropdown button sits next to "Copy Yesterday" and "Unconfigured/Published" badge. It's unclear what it does.

**New UX — Two clearly labelled actions per meal column:**

```
┌─────────────────────────────────────────────────┐
│  🌅 Lunch Menu                      [Published] │
│  ─────────────────────────────────────────────  │
│  [ 📋 Load Template ▼ ]  [ 💾 Save as Template ]│  ← NEW: clear labels
│  [ ↩ Copy Yesterday ]                           │
│  ─────────────────────────────────────────────  │
│  Cutoff Time: [11:30]                          │
│  ...thali selection...                          │
│  ...sabji pickers...                            │
└─────────────────────────────────────────────────┘
```

**Remove:** The old `Templates ▼` dropdown button that opens a sub-dropdown. It was confusing because clicking "Templates" showed another level "Templates" option inside.

**Replace with:**

```tsx
{/* Load Template button — dropdown showing saved templates */}
<div className="relative">
  <button
    onClick={() => setShowTemplateMenu(prev => prev === mealType ? null : mealType)}
    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 
               border border-gray-200 rounded-lg hover:border-orange-300 hover:text-orange-600 
               bg-white transition-all"
  >
    <ClipboardList size={13} />
    Load Template
    <ChevronDown size={12} />
  </button>
  
  {showTemplateMenu === mealType && (
    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl 
                    shadow-lg z-20 min-w-[200px] py-1">
      {templates.filter(t => t.mealType === mealType).length === 0 ? (
        <p className="text-xs text-gray-400 px-3 py-2">No templates saved yet</p>
      ) : (
        templates
          .filter(t => t.mealType === mealType)
          .map(template => (
            <button
              key={template.id}
              onClick={() => { handleLoadTemplate(mealType, template.id); setShowTemplateMenu(null); }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs 
                         text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors"
            >
              <span>{template.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                className="text-gray-300 hover:text-red-400 ml-2"
              >
                <Trash2 size={11} />
              </button>
            </button>
          ))
      )}
    </div>
  )}
</div>

{/* Save as Template button */}
<button
  onClick={() => handleSaveAsTemplate(mealType)}
  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 
             border border-gray-200 rounded-lg hover:border-orange-300 hover:text-orange-600 
             bg-white transition-all"
>
  <Save size={13} />
  Save as Template
</button>
```

---

### C3. `handleSaveAsTemplate` Logic

```tsx
const handleSaveAsTemplate = async (mealType: "LUNCH" | "DINNER") => {
  const name = prompt(`Name this ${mealType.toLowerCase()} template:`);
  if (!name?.trim()) return;

  const thaliIds = mealType === "LUNCH" ? lunchThalis : dinnerThalis;
  const sabjiMap = mealType === "LUNCH" ? lunchSabjiMap : dinnerSabjiMap;
  const minMap = mealType === "LUNCH" ? lunchMinSabjiMap : dinnerMinSabjiMap;
  const cutoffTime = mealType === "LUNCH" ? lunchCutoff : dinnerCutoff;

  if (thaliIds.length === 0) {
    toast.error("Select at least one thali before saving as template");
    return;
  }

  const sabjiConfig = Object.entries(sabjiMap).map(([thaliId, productIds]) => ({
    thaliId,
    productIds,
    minRequired: minMap[thaliId] ?? 1,
  }));

  try {
    const res = await fetch("/api/menu-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        mealType,
        cutoffTime, // HH:MM string in IST — template stores IST strings (not UTC), since they're re-applied at menu save time
        thaliIds,
        sabjiConfig,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed");
    toast.success(`Template "${name}" saved!`);
    fetchTemplates(); // refresh template list
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : "Failed to save template");
  }
};
```

---

### C4. `handleLoadTemplate` Logic

```tsx
const handleLoadTemplate = (mealType: "LUNCH" | "DINNER", templateId: string) => {
  const template = templates.find(t => t.id === templateId);
  if (!template) return;

  const sabjiConfig = Array.isArray(template.sabjiConfig)
    ? template.sabjiConfig
    : JSON.parse(template.sabjiConfig as string ?? "[]");

  const sabjis: Record<string, string[]> = {};
  const mins: Record<string, number> = {};

  sabjiConfig.forEach((cfg: { thaliId: string; productIds: string[]; minRequired?: number }) => {
    sabjis[cfg.thaliId] = cfg.productIds;
    mins[cfg.thaliId] = cfg.minRequired ?? 1;
  });

  if (mealType === "LUNCH") {
    setLunchCutoff(template.cutoffTime ?? "11:30");
    setLunchThalis(template.thaliIds);
    setLunchSabjiMap(sabjis);
    setLunchMinSabjiMap(mins);
  } else {
    setDinnerCutoff(template.cutoffTime ?? "18:30");
    setDinnerThalis(template.thaliIds);
    setDinnerSabjiMap(sabjis);
    setDinnerMinSabjiMap(mins);
  }

  toast.success(`Template "${template.name}" loaded! Review and save.`);
};
```

---

### C5. `src/app/api/menu-templates/route.ts` — Extend Existing Route

The route already exists. Ensure it has:

- `GET` — return all templates, ordered by `createdAt DESC`
- `POST` — create template
- `DELETE` at `src/app/api/menu-templates/[id]/route.ts` — delete by ID

```ts
// src/app/api/menu-templates/[id]/route.ts — NEW FILE

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.menuTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[template/delete]", err);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
```

---

## 5. Phase D — Sabji Selection Moved to Menu Creation

### D1. Current State vs Target State

| Aspect | Current (Wrong) | Target (Correct) |
|---|---|---|
| Where sabji pool is defined | Thali creation (ThaliSabjiProduct table) | Only at menu creation time |
| What Thali stores | `maxSabjiCount` + `sabjiPool` (which products are eligible) | Only `maxSabjiCount` (how many the customer must pick) |
| What Menu stores | `DailyMenuSabjiOption` (which products are available today per thali) | Same — but now populated from ALL active products, not from a pre-approved pool |
| Thali creation modal | Has sabji picker | No sabji picker |
| Menu creation | Sabji picker filtered by thali's pre-approved pool | Sabji picker shows ALL active products — admin picks for today |

**Why the old approach is wrong:** Thalis don't change daily — their structure (4 Roti, Dal, Rice, etc.) is fixed. But the sabji available on Monday is different from Thursday. The admin needs to pick sabji every day at menu-creation time, not once during thali setup. The `ThaliSabjiProduct` join table adds complexity without value.

**What to do with `ThaliSabjiProduct`:** Keep the table in the DB (don't drop it to avoid a risky migration), but stop populating it and stop reading from it. The `SabjiPicker` in the menu page will search ALL active products instead of filtering by `thali.sabjiPool`.

---

### D2. `ThaliModal.tsx` — Remove Sabji Pool Picker

Remove the entire `SabjiPicker` section from `ThaliModal`. The modal becomes simpler:

**Fields that remain:**
- Thali Name (English)
- Thali Name (Gujarati) — optional
- Price
- Max Sabji Count (0–3 slider or select)
- Description
- Fixed Items (ThaliItem list — 4 Roti, Dal, etc.)

**Fields removed:**
- ~~"Sabji Pool (choose which sabji items are allowed)"~~

Add a small hint text under `maxSabjiCount` so admin understands what it means:

```tsx
<div className="space-y-1">
  <label className="text-sm font-medium text-gray-700">
    Max Sabji Count <span className="text-red-500">*</span>
  </label>
  <select
    {...register("maxSabjiCount", { valueAsNumber: true })}
    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg 
               focus:outline-none focus:ring-2 focus:ring-orange-500/30"
  >
    <option value={0}>0 — No sabji (fixed thali)</option>
    <option value={1}>1 sabji choice</option>
    <option value={2}>2 sabji choices</option>
    <option value={3}>3 sabji choices</option>
  </select>
  <p className="text-xs text-gray-400">
    How many sabji items the customer must select from today&apos;s menu options.
    0 means this thali has no sabji choice.
  </p>
</div>
```

---

### D3. Menu Creation — Sabji Picker Searches ALL Active Products

The `SabjiPicker` component (already built in `src/components/admin/SabjiPicker.tsx`) is already good. The only change: on the menu page, instead of passing `thali.sabjiPool` as the `products` prop, pass ALL active products.

**In `menu/page.tsx`:**

```tsx
// BEFORE (reading from thali's sabji pool):
const sabjiProducts = thali.sabjiPool.map(sp => sp.product);
<SabjiPicker products={sabjiProducts} ... />

// AFTER (all active products):
// allProducts is fetched once: GET /api/products?isActive=true
<SabjiPicker products={allProducts} ... />
```

**Fetch all active products on page load:**

```tsx
// In fetchMenuData():
const productsRes = await fetch("/api/products?isActive=true&limit=200");
const productsJson = await productsRes.json();
setAllProducts(productsJson.products ?? []);
```

The `SabjiPicker` already supports fast client-side search with debounce + frequency tracking — it will handle 200 products without issues.

---

### D4. Thalis with `maxSabjiCount = 0` — Auto-Skip Sabji Section

If a thali has `maxSabjiCount === 0`, the `SabjiPicker` for that thali is completely hidden.

```tsx
{selectedThalisForMeal.map(thali => (
  <div key={thali.id} className="border border-gray-100 rounded-xl p-3 space-y-2">
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-gray-800">{thali.name}</p>
      <span className="text-xs text-orange-600 font-medium">{formatCurrency(thali.price)}</span>
    </div>
    
    {thali.maxSabjiCount === 0 ? (
      // No sabji required for this thali
      <p className="text-xs text-gray-400 italic flex items-center gap-1">
        <span>✓</span> No sabji required for this thali
      </p>
    ) : (
      // Show sabji picker
      <SabjiPicker
        products={allProducts}
        selected={sabjiMap[thali.id] ?? []}
        onChange={(ids) => setSabjiMap(prev => ({ ...prev, [thali.id]: ids }))}
        maxCount={thali.maxSabjiCount}
        minRequired={minSabjiMap[thali.id] ?? 1}
        onMinChange={(n) => setMinSabjiMap(prev => ({ ...prev, [thali.id]: n }))}
        label={`Sabji options for ${thali.name}`}
      />
    )}
  </div>
))}
```

---

### D5. API Changes for Phase D

**`src/app/api/thalis/route.ts` (POST):**
Remove the `sabjiProductIds` field from the body and from the DB write. No longer creates `ThaliSabjiProduct` rows.

**`src/app/api/thalis/[id]/route.ts` (PUT/PATCH):**
Same — do not update `ThaliSabjiProduct`.

**`src/app/api/thalis/route.ts` (GET):**
Stop including `sabjiPool` in the `include` clause. This removes a JOIN that was only needed for the old thali-level sabji pool.

```ts
// BEFORE:
const thalis = await prisma.thali.findMany({
  include: { items: true, sabjiPool: { include: { product: true } } },
});

// AFTER:
const thalis = await prisma.thali.findMany({
  include: { items: true },
  // sabjiPool no longer included
});
```

**`src/app/api/products/route.ts` (GET):**
No change needed — already returns active products with `?isActive=true`.

---

## 6. Phase E — Bulk Product Upload

### E1. New `BulkProductModal` Component

Create `src/components/modals/BulkProductModal.tsx`. This follows the exact same 2-step pattern as `BulkUserModal`:

- **Step 1:** Paste CSV or upload file → parse client-side → validate rows
- **Step 2:** Show row-by-row preview table (✅ valid / ❌ error) → Admin reviews → clicks "Import Valid Rows"

```tsx
"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Upload, Download, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";

interface ProductRow {
  name: string;
  nameGu?: string;
  quantity: string;
  price: string;
  valid: boolean;
  error?: string;
}

interface BulkProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkProductModal({ isOpen, onClose, onSuccess }: BulkProductModalProps) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const handleClose = () => {
    setStep(1);
    setCsvText("");
    setRows([]);
    onClose();
  };

  const downloadTemplate = () => {
    const csv = [
      "name,nameGu,quantity,price",
      "Palak Paneer,પાલક પનીર,1 bowl,50",
      "Aloo Gobi,આલુ ગોબી,1 bowl,25",
      "Mix Veg,મિક્સ વેજ,1 bowl,30",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string);
    reader.readAsText(file);
  };

  const parseAndValidate = () => {
    if (!csvText.trim()) {
      toast.error("Please paste CSV data or upload a file");
      return;
    }

    const result = Papa.parse<{ name: string; nameGu?: string; quantity: string; price: string }>(
      csvText.trim(),
      { header: true, skipEmptyLines: true }
    );

    const headers = result.meta.fields ?? [];
    const required = ["name", "quantity", "price"];
    const missing = required.filter(h => !headers.includes(h));
    if (missing.length > 0) {
      toast.error(`CSV missing required columns: ${missing.join(", ")}`);
      return;
    }

    if (result.data.length > 200) {
      toast.error("Maximum 200 products per import. Split into smaller files.");
      return;
    }

    const seen = new Set<string>();
    const validated: ProductRow[] = result.data.map((row) => {
      const name = row.name?.trim();
      const nameGu = row.nameGu?.trim() || undefined;
      const quantity = row.quantity?.trim();
      const price = row.price?.toString().trim();

      if (!name) return { ...row, valid: false, error: "Name is empty" };
      if (!quantity) return { name, nameGu, quantity: "", price, valid: false, error: "Quantity is empty" };

      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum < 0) {
        return { name, nameGu, quantity, price, valid: false, error: `Invalid price: "${price}"` };
      }

      if (seen.has(name.toLowerCase())) {
        return { name, nameGu, quantity, price, valid: false, error: `Duplicate name in CSV: "${name}"` };
      }
      seen.add(name.toLowerCase());

      return { name, nameGu, quantity, price, valid: true };
    });

    setRows(validated);
    setStep(2);
  };

  const handleImport = async () => {
    const validRows = rows.filter(r => r.valid);
    if (validRows.length === 0) {
      toast.error("No valid rows to import");
      return;
    }
    setIsImporting(true);
    try {
      const res = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          products: validRows.map(r => ({
            name: r.name,
            nameGu: r.nameGu,
            quantity: r.quantity,
            price: parseFloat(r.price),
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      toast.success(
        `Import complete: ${json.created} created, ${json.updated} updated, ${json.skipped} skipped`
      );
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = rows.filter(r => r.valid).length;
  const errorCount = rows.filter(r => !r.valid).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Bulk Upload Products"
      size="lg"
      footer={
        <>
          {step === 1 ? (
            <>
              <Button variant="secondary" onClick={handleClose}>Cancel</Button>
              <Button variant="primary" onClick={parseAndValidate} disabled={!csvText.trim()}>
                Validate CSV
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button
                variant="primary"
                onClick={handleImport}
                isLoading={isImporting}
                disabled={validCount === 0}
              >
                Import {validCount} Valid Row{validCount !== 1 ? "s" : ""}
              </Button>
            </>
          )}
        </>
      }
    >
      {step === 1 && (
        <div className="space-y-4">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Required CSV columns:</p>
            <p><code className="bg-blue-100 px-1 rounded">name</code> (required) — English product name</p>
            <p><code className="bg-blue-100 px-1 rounded">quantity</code> (required) — e.g. "1 bowl", "250ml"</p>
            <p><code className="bg-blue-100 px-1 rounded">price</code> (required) — number in ₹, e.g. 50</p>
            <p><code className="bg-blue-100 px-1 rounded">nameGu</code> (optional) — Gujarati name</p>
          </div>

          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-xs text-orange-500 hover:text-orange-600 font-medium"
          >
            <Download size={13} /> Download Sample CSV Template
          </button>

          {/* File upload */}
          <label className="flex items-center gap-2 cursor-pointer px-3 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors">
            <Upload size={14} />
            Upload .csv file
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
          </label>

          {/* Or paste */}
          <div>
            <p className="text-xs text-gray-500 mb-1">Or paste CSV content directly:</p>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={6}
              placeholder={"name,nameGu,quantity,price\nPalak Paneer,પાલક પનીર,1 bowl,50"}
              className="w-full text-xs font-mono border border-gray-200 rounded-xl p-3 
                         focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <CheckCircle2 size={13} /> {validCount} ready to import
            </span>
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-red-500 font-semibold">
                <XCircle size={13} /> {errorCount} will be skipped
              </span>
            )}
          </div>

          {errorCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex gap-2 text-xs text-amber-700">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              Rows with errors will be skipped. Fix the CSV and re-upload to include them.
            </div>
          )}

          {/* Row-by-row preview */}
          <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
            {rows.map((row, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 px-3 py-2.5 text-xs ${
                  row.valid ? "bg-white" : "bg-red-50"
                }`}
              >
                {row.valid
                  ? <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                  : <XCircle size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-800">{row.name || "(empty)"}</span>
                    {row.nameGu && <span className="text-gray-400">{row.nameGu}</span>}
                    {row.quantity && <span className="text-gray-500">· {row.quantity}</span>}
                    {row.price && <span className="text-orange-600 font-medium">· ₹{row.price}</span>}
                  </div>
                  {row.error && (
                    <p className="text-red-500 mt-0.5">{row.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
```

---

### E2. API Route `src/app/api/products/bulk/route.ts`

The file already exists (created in the third implementation). Verify it handles upsert correctly:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface ProductInput {
  name: string;
  nameGu?: string;
  quantity: string;
  price: number;
}

export async function POST(req: NextRequest) {
  try {
    const { products }: { products: ProductInput[] } = await req.json();

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: "No products provided" }, { status: 400 });
    }

    if (products.length > 200) {
      return NextResponse.json({ error: "Maximum 200 products per import" }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const p of products) {
      if (!p.name?.trim() || !p.quantity?.trim() || typeof p.price !== "number") {
        skipped++;
        errors.push(`Skipped invalid row: ${JSON.stringify(p)}`);
        continue;
      }

      try {
        const existing = await prisma.product.findUnique({ where: { name: p.name.trim() } });
        if (existing) {
          await prisma.product.update({
            where: { name: p.name.trim() },
            data: {
              nameGu: p.nameGu?.trim() || null,
              quantity: p.quantity.trim(),
              price: p.price,
            },
          });
          updated++;
        } else {
          await prisma.product.create({
            data: {
              name: p.name.trim(),
              nameGu: p.nameGu?.trim() || null,
              quantity: p.quantity.trim(),
              price: p.price,
              isActive: true,
            },
          });
          created++;
        }
      } catch (err) {
        skipped++;
        errors.push(`Error on "${p.name}": ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    return NextResponse.json({ created, updated, skipped, errors });
  } catch (err) {
    console.error("[products/bulk]", err);
    return NextResponse.json({ error: "Bulk import failed" }, { status: 500 });
  }
}
```

---

### E3. Wire Up Bulk Upload Button in `_ProductsTab.tsx`

Add a "Bulk Upload" button next to "Add Product":

```tsx
import BulkProductModal from "@/components/modals/BulkProductModal";

// In state:
const [bulkModalOpen, setBulkModalOpen] = useState(false);

// In JSX (header area):
<div className="flex gap-2">
  <Button
    variant="secondary"
    leftIcon={<Upload size={16} />}
    onClick={() => setBulkModalOpen(true)}
  >
    Bulk Upload
  </Button>
  <Button
    variant="primary"
    leftIcon={<Plus size={16} />}
    onClick={() => { setEditProduct(null); setModalOpen(true); }}
  >
    Add Product
  </Button>
</div>

// At bottom:
{bulkModalOpen && (
  <BulkProductModal
    isOpen={bulkModalOpen}
    onClose={() => setBulkModalOpen(false)}
    onSuccess={fetchProducts}
  />
)}
```

---

### E4. Sample CSV File

Create `public/sample-products.csv`:

```csv
name,nameGu,quantity,price
Palak Paneer,પાલક પનીર,1 bowl,50
Aloo Gobi,આલુ ગોબી,1 bowl,25
Mix Veg,મિક્સ વેજ,1 bowl,30
Corn Capsicum,કોર્ન કેપ્સિકમ,1 bowl,30
Rajma (Kathol),રાજમા (કઠોળ),1 bowl,30
Sev Tameta,સેવ ટામેટા,1 bowl,25
Paneer Butter Masala,પનીર બટર મસાલા,1 bowl,60
Dal Fry,દાળ ફ્રાય,1 bowl,20
```

---

## 7. Phase F — UX Polish

### F1. Sidebar — Show Correct Title Based on Role

In `Sidebar.tsx`, the panel subtitle says "Admin Panel". Change it to be role-aware:

```tsx
<p className="text-gray-400 text-xs">
  {currentUser?.role === "ADMIN" ? "Admin Panel" : "Staff Panel"}
</p>
```

### F2. Public Login Page (`/login`) — No More "Admin Login" Anywhere

Remove "Admin Login" text from:
- The public `Navbar.tsx` button: change to "Login" or "Panel Login"
- The `Footer.tsx` quick link: change to "Login"
- The login page heading: change to "Welcome Back"

```tsx
// Navbar.tsx
<Link href="/login">
  <Button variant="secondary" size="md" leftIcon={<LogIn size={16} />}>
    Login
  </Button>
</Link>

// Footer.tsx
<li><Link href="/login" className="hover:text-orange-400 transition-colors">Login</Link></li>
```

### F3. `.env.example` — Updated Template

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
JWT_SECRET="your_very_long_random_secret_at_least_64_chars"
NEXT_PUBLIC_APP_NAME="VD's Hunger Hub"
# JWT duration is now hardcoded to 100 days in auth.ts
# If you want to override, set JWT_EXPIRES_IN_SECONDS=8640000
```

### F4. `src/lib/utils.ts` — Remove Duplicate `getTodayIST()`

```ts
// REMOVE these two functions (moved to src/lib/time.ts):
// getTodayIST()
// getTodayString()
// formatDate()
// formatDateForAPI()

// UPDATE all import sites:
// BEFORE: import { getTodayIST } from "@/lib/utils"
// AFTER:  import { getTodayIST } from "@/lib/time"
```

Files that need import updates:
- `src/app/(admin)/menu/page.tsx`
- `src/app/(admin)/dashboard/page.tsx`
- `src/app/api/menu/route.ts`
- `src/app/api/menu/[id]/route.ts`

---

## 8. Schema Migration SQL

Run in order. Create a single migration file:

```bash
npx prisma migrate dev --name v4_auth_roles_utc_time
```

**Migration SQL:**

```sql
-- ─── 1. AppRole enum ───────────────────────────────────────────────────
CREATE TYPE "AppRole" AS ENUM ('ADMIN', 'STAFF', 'CUSTOMER');

-- ─── 2. AppUser table ─────────────────────────────────────────────────
CREATE TABLE "AppUser" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "number"    TEXT NOT NULL,
    "password"  TEXT NOT NULL,
    "role"      "AppRole" NOT NULL DEFAULT 'STAFF',
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppUser_number_key" ON "AppUser"("number");

-- ─── 3. DailyMenu.cutoffTime: String? → DateTime? ─────────────────────
-- Step A: Add new column
ALTER TABLE "DailyMenu" ADD COLUMN "cutoffTimeUTC" TIMESTAMP(3);

-- Step B: Migrate existing "HH:MM" IST strings to UTC DateTime
-- Subtracts 330 minutes (5h30m) from the IST time on the menu's date
UPDATE "DailyMenu"
SET "cutoffTimeUTC" = (
    date::timestamp
    + (
        SPLIT_PART("cutoffTime", ':', 1)::integer * 60
        + SPLIT_PART("cutoffTime", ':', 2)::integer
    ) * INTERVAL '1 minute'
    - INTERVAL '330 minutes'
)
WHERE "cutoffTime" IS NOT NULL
  AND "cutoffTime" ~ '^\d{2}:\d{2}$';

-- Step C: Drop old string column, rename new DateTime column
ALTER TABLE "DailyMenu" DROP COLUMN "cutoffTime";
ALTER TABLE "DailyMenu" RENAME COLUMN "cutoffTimeUTC" TO "cutoffTime";

-- ─── 4. MenuTemplate: cutoffTime already String — leave as-is ──────────
-- Templates store IST time as HH:MM strings (intentional — they're
-- display-layer values, converted to UTC when actually applied to a menu)
-- No change needed to MenuTemplate.

-- ─── 5. (No ThaliSabjiProduct changes — keep table, stop using it) ─────
-- No SQL needed.

-- ─── 6. products/bulk route already exists — no schema change ──────────
```

---

## 9. File-by-File Change Index

| File | Action | Phase | Notes |
|---|---|---|---|
| `prisma/schema.prisma` | EDIT | A1 | Add `AppUser` model, `AppRole` enum |
| `prisma/seed.ts` | EDIT | A1 | Migrate Admin + Staff → AppUser rows |
| `src/lib/auth.ts` | FULL REWRITE | A2 | 100-day JWT, `role` in payload, dual cookie name support |
| `src/app/api/auth/login/route.ts` | FULL REWRITE | A3 | Query `AppUser` instead of `Admin` |
| `src/app/api/auth/me/route.ts` | NEW | A5 | Returns current user from JWT |
| `src/app/(auth)/login/page.tsx` | EDIT | A3 | Remove "Admin" labels; "Welcome Back" |
| `src/proxy.ts` | FULL REWRITE | A4 | Role-aware protection; dual cookie support |
| `src/components/admin/Sidebar.tsx` | EDIT | A5 | Dynamic name/role; filter nav by role |
| `src/hooks/useCurrentUser.ts` | NEW | A5 | Client-side hook for current user |
| `src/app/api/staff/route.ts` | EDIT | A6 | POST also creates AppUser row |
| `src/app/api/staff/[id]/route.ts` | EDIT | A6 | DELETE deactivates AppUser |
| `src/components/modals/StaffModal.tsx` | EDIT | A6 | Add password field on create |
| `src/lib/time.ts` | NEW | B1 | Central UTC↔IST utility |
| `src/lib/utils.ts` | EDIT | B1 | Remove `getTodayIST`, `getTodayString`, `formatDate`, `formatDateForAPI` |
| `prisma/schema.prisma` | EDIT | B2 | `cutoffTime String?` → `cutoffTime DateTime?` |
| `src/app/api/menu/route.ts` | EDIT | B3 | `istTimeToUTC()` before storing; IST date construction |
| `src/app/api/menu/[id]/route.ts` | EDIT | B3 | Same |
| `src/app/(admin)/menu/page.tsx` | EDIT | B4 | `utcToISTTimeString()` for display; import from `@/lib/time` |
| `src/app/(admin)/dashboard/page.tsx` | EDIT | B4 | Cutoff time display via `utcToISTTimeString()` |
| `src/app/menu/[slug]/page.tsx` | EDIT | B4 | IST display for public menu |
| `src/app/(admin)/menu/page.tsx` | EDIT | C2–C4 | Replace confusing Templates dropdown with "Load Template" + "Save as Template" buttons |
| `src/app/api/menu-templates/[id]/route.ts` | NEW | C5 | DELETE handler for templates |
| `src/components/modals/ThaliModal.tsx` | EDIT | D2 | Remove sabji pool picker section |
| `src/app/api/thalis/route.ts` | EDIT | D5 | Remove `sabjiPool` from include; remove `sabjiProductIds` from body |
| `src/app/api/thalis/[id]/route.ts` | EDIT | D5 | Same |
| `src/app/(admin)/menu/page.tsx` | EDIT | D3–D4 | `SabjiPicker` uses `allProducts`; 0-sabji thalis skip picker |
| `src/components/modals/BulkProductModal.tsx` | NEW | E1 | 2-step CSV upload with preview table |
| `src/app/api/products/bulk/route.ts` | EDIT/VERIFY | E2 | Ensure upsert logic is correct |
| `src/app/(admin)/catalog/_ProductsTab.tsx` | EDIT | E3 | Add "Bulk Upload" button |
| `public/sample-products.csv` | NEW | E4 | Sample CSV template for download |
| `src/components/public/Navbar.tsx` | EDIT | F2 | "Admin Login" → "Login" |
| `src/components/public/Footer.tsx` | EDIT | F2 | Same |
| `.env.example` | EDIT | F3 | Updated env vars |

---

## 10. Environment Variables

**`.env.example` (complete updated version):**

```env
# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# JWT — secret must be at least 64 random characters
JWT_SECRET="replace_this_with_a_long_random_string_at_least_64_characters_long"

# App
NEXT_PUBLIC_APP_NAME="VD's Hunger Hub"

# WhatsApp (used in public pages and order links)
# Already in src/lib/constants.ts — no env var needed unless you want it configurable
```

**Important:** After changing `JWT_SECRET`, all existing tokens are invalidated. Admin and any staff will need to log in once again. This is the correct behavior.

---

## 11. Build Order

Execute these phases in order. Do not skip ahead.

```
Day 1 Morning  → Phase A: AppUser schema + seed migration
                  → Run: npx prisma migrate dev --name v4_app_user
                  → Run: npx prisma db seed (to copy Admin + Staff → AppUser)

Day 1 Afternoon → Phase A continued: auth.ts rewrite, login route, proxy.ts, sidebar
                  → Test: Login as admin → works
                  → Test: Login as staff → works, cannot see /companies
                  → Test: Token persists 100 days (check cookie maxAge in DevTools)

Day 2 Morning  → Phase B: Create src/lib/time.ts
                  → Migrate cutoffTime column: npx prisma migrate dev --name v4_utc_cutoff
                  → Update all API routes to use istTimeToUTC()
                  → Update all UI to use utcToISTTimeString()
                  → Test: Create menu → cutoff shows correct IST time in UI

Day 2 Afternoon → Phase C: Templates redesign on menu/page.tsx
                  → Add menu-templates/[id]/route.ts for DELETE
                  → Test: Save template → loads back correctly
                  → Test: Template menu = correct UX, no confusion

Day 3 Morning  → Phase D: Remove sabji pool from ThaliModal
                  → Update thalis API routes (remove sabjiPool include)
                  → Update menu page to fetch all active products for SabjiPicker
                  → Test: Create thali (no sabji picker) → create menu (sabji picker with all products)
                  → Test: maxSabjiCount=0 thali → no sabji section shown

Day 3 Afternoon → Phase E: BulkProductModal component + wire to _ProductsTab
                  → Verify /api/products/bulk route
                  → Add public/sample-products.csv
                  → Test: Upload 5-row CSV → preview shows → import → products appear in table

Day 4           → Phase F: UX polish (Navbar/Footer text, sidebar labels, env.example)
                  → Full regression test: login flow, menu creation, template, bulk upload
                  → Deploy to Vercel
```

---

*Fourth implementation plan prepared by Claude (claude-sonnet-4-6) for SoftVibe Services · VD's Hunger Hub*  
*Date: 26 Jun 2026*