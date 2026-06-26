# VD's Hunger Hub — Fourth Implementation Plan
## User Panel · Firebase OTP Auth · Order System · Billing · Admin/Staff Order Polling

> **Project:** `softvibeservices-vdshungerhub`
> **Stack:** Next.js 16 · Prisma (PostgreSQL) · Tailwind CSS v4 · React 19 · Firebase Auth
> **Scope:** Full user-facing ordering panel, device-persistent JWT auth via Firebase OTP, order history, billing management, and live order polling for admin/staff

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1 — Prisma Schema Changes](#2-phase-1--prisma-schema-changes)
3. [Phase 2 — Firebase Setup & Environment Variables](#3-phase-2--firebase-setup--environment-variables)
4. [Phase 3 — User Auth API Routes](#4-phase-3--user-auth-api-routes)
5. [Phase 4 — Public Menu Page (Thali + Sabji Selector)](#5-phase-4--public-menu-page-thali--sabji-selector)
6. [Phase 5 — OTP Flow (Mobile Verification)](#6-phase-5--otp-flow-mobile-verification)
7. [Phase 6 — Order Confirmation Modal](#7-phase-6--order-confirmation-modal)
8. [Phase 7 — Order API Routes](#8-phase-7--order-api-routes)
9. [Phase 8 — User Order History Page](#9-phase-8--user-order-history-page)
10. [Phase 9 — Admin/Staff: Orders View with Polling](#10-phase-9--adminstaff-orders-view-with-polling)
11. [Phase 10 — Billing Management](#11-phase-10--billing-management)
12. [Phase 11 — proxy.ts Updates](#12-phase-11--proxyts-updates)
13. [Phase 12 — TypeScript Types](#13-phase-12--typescript-types)
14. [Phase 13 — Environment Variables Reference](#14-phase-13--environment-variables-reference)
15. [File-by-File Change Index](#15-file-by-file-change-index)
16. [Migration SQL Reference](#16-migration-sql-reference)
17. [Complete Flow Diagram](#17-complete-flow-diagram)

---

## 1. Architecture Overview

### 1.1 The Full User Journey (End-to-End)

```
User visits /menu/:slug
       │
       ▼
Menu page loads → shows thalis + sabji options for that day
       │
User selects thali + sabji choices
       │
       ▼
User clicks "Place Order"
       │
       ├─── Is device known? (check localStorage for vdh_user_jwt)
       │         │
       │    YES ──► Validate JWT with /api/user-auth/me
       │              │
       │         Valid ──► Skip to Order Confirmation Modal
       │         Invalid ──► Treat as new device (OTP flow)
       │
       └─── New device OR first time ever
                 │
                 ▼
         Show mobile number input
                 │
         User enters 10-digit number
                 │
         POST /api/user-auth/check-number
                 │
           ┌─────┴──────┐
         Found       Not found
           │               │
           ▼               ▼
       Send OTP      Redirect to WhatsApp
    (Firebase)        wa.me/admin number
           │
           ▼
       User enters OTP
           │
       Firebase verifyOTP (client-side)
           │
       POST /api/user-auth/verify
       (backend gets Firebase ID token, mints 180-day JWT, stores device fingerprint)
           │
           ▼
     Order Confirmation Modal
     (shows user name, company, number — "Are you sure? No cancellation allowed")
           │
     User confirms
           │
           ▼
     POST /api/orders
           │
           ▼
     Success screen + WhatsApp confirmation link
```

### 1.2 Device Persistence Strategy

- **JWT lifetime:** 180 days (`USER_JWT_EXPIRES_IN=180d`)
- **Storage:** `localStorage` key `vdh_user_jwt` (set on successful OTP verification)
- **Device fingerprint:** stored in `UserDevice` table — `userId`, `deviceHash` (SHA-256 of `userAgent + screenWidth + timezone`), `lastSeenAt`
- **New device detection:** on page load, check if JWT is valid AND `deviceHash` is in `UserDevice` table. If JWT is valid but device is new → re-run OTP for that device, then no re-auth needed for 180 days on that device too.
- **OTP rate limiting:** enforced entirely by Firebase (`RecaptchaVerifier` + Firebase's own limits). Do not call `signInWithPhoneNumber` more than once per 60 seconds for the same number.

### 1.3 What Admin Controls

The admin already manages users via `/users` page — `User.number` is the source of truth for who is allowed to order. **If `User.isActive = false`, they cannot order even if their number exists.**

### 1.4 Order Polling Strategy

- **Poll interval:** 5 minutes (`setInterval(fetch, 300_000)`)
- **Manual refresh button:** always visible, fetches immediately on click
- **No WebSocket** — polling is sufficient; saves infra cost
- **Polling scope:** only fetches orders where `createdAt >= today midnight IST` — not all-time

---

## 2. Phase 1 — Prisma Schema Changes

**File:** `prisma/schema.prisma`

Add these new models after the existing ones. **Do not modify existing models** — only additive changes.

### 2.1 New Models

```prisma
// ─────────────────────────────────────────
// USER DEVICE (for persistent login per device)
// ─────────────────────────────────────────
model UserDevice {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceHash  String   // SHA-256(userAgent + screenWidth + timezone)
  lastSeenAt  DateTime @default(now())
  createdAt   DateTime @default(now())

  @@unique([userId, deviceHash])
  @@index([userId])
}

// ─────────────────────────────────────────
// ORDER
// ─────────────────────────────────────────
model Order {
  id           String        @id @default(cuid())
  userId       String
  user         User          @relation(fields: [userId], references: [id], onDelete: Restrict)
  menuId       String
  menu         DailyMenu     @relation(fields: [menuId], references: [id], onDelete: Restrict)
  thaliId      String
  thali        Thali         @relation(fields: [thaliId], references: [id], onDelete: Restrict)
  selectedSabji OrderSabji[]
  totalAmount  Float
  status       OrderStatus   @default(PENDING)
  note         String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  @@index([userId])
  @@index([menuId])
  @@index([createdAt])
}

// Many selected sabji items per order
model OrderSabji {
  id        String  @id @default(cuid())
  orderId   String
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId String
  product   Product @relation(fields: [productId], references: [id], onDelete: Restrict)

  @@unique([orderId, productId])
}

// ─────────────────────────────────────────
// ORDER STATUS ENUM
// ─────────────────────────────────────────
enum OrderStatus {
  PENDING     // just placed, not yet confirmed
  CONFIRMED   // admin/staff acknowledged
  DELIVERED   // marked delivered
  CANCELLED   // admin cancelled (no user cancellation allowed)
}
```

### 2.2 Existing Model Additions (relations only)

Add these relation fields to existing models so Prisma generates the correct reverse relations. **No column changes to existing tables.**

```prisma
// Add to model User:
  devices UserDevice[]
  orders  Order[]

// Add to model DailyMenu:
  orders  Order[]

// Add to model Thali:
  orders  Order[]

// Add to model Product:
  orderSabji OrderSabji[]
```

### 2.3 Migration Command

```bash
npx prisma migrate dev --name v4_user_orders_devices
```

### 2.4 Migration SQL (for reference)

```sql
-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED');

-- CreateTable: UserDevice
CREATE TABLE "UserDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserDevice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "UserDevice_userId_deviceHash_key" ON "UserDevice"("userId", "deviceHash");
CREATE INDEX "UserDevice_userId_idx" ON "UserDevice"("userId");
ALTER TABLE "UserDevice" ADD CONSTRAINT "UserDevice_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: Order
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "thaliId" TEXT NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_menuId_idx" ON "Order"("menuId");
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_menuId_fkey"
  FOREIGN KEY ("menuId") REFERENCES "DailyMenu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_thaliId_fkey"
  FOREIGN KEY ("thaliId") REFERENCES "Thali"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: OrderSabji
CREATE TABLE "OrderSabji" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "OrderSabji_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderSabji_orderId_productId_key" ON "OrderSabji"("orderId", "productId");
ALTER TABLE "OrderSabji" ADD CONSTRAINT "OrderSabji_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderSabji" ADD CONSTRAINT "OrderSabji_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

---

## 3. Phase 2 — Firebase Setup & Environment Variables

### 3.1 Firebase Project Setup (one-time, manual)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create project (or use existing): `vds-hunger-hub`
3. Enable **Authentication → Phone** provider
4. Add your production domain to **Authorized Domains** (e.g. `vdshungerhub.com`)
5. Go to **Project Settings → General** → copy:
   - `apiKey`
   - `authDomain`
   - `projectId`
   - `appId`
6. Go to **Project Settings → Service Accounts** → Generate new private key → download JSON
   - Extract `project_id`, `private_key`, `client_email` for server-side Firebase Admin SDK

### 3.2 Install Firebase packages

```bash
npm install firebase firebase-admin
```

### 3.3 Environment Variables to Add

**File:** `.env` (and `.env.example`)

```bash
# ─── Existing ───────────────────────────────────────────────────
DATABASE_URL="postgresql://..."
JWT_SECRET="your_jwt_secret_here"
JWT_EXPIRES_IN="8h"                        # admin JWT (unchanged)
NEXT_PUBLIC_APP_NAME="VD's Hunger Hub"

# ─── New: User Auth JWT ─────────────────────────────────────────
USER_JWT_SECRET="your_user_jwt_secret_DIFFERENT_from_admin"
USER_JWT_EXPIRES_IN="180d"

# ─── New: Firebase Client (public, safe to expose) ─────────────
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="vds-hunger-hub.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="vds-hunger-hub"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abc123"

# ─── New: Firebase Admin (server-side only, SECRET) ─────────────
FIREBASE_PROJECT_ID="vds-hunger-hub"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xyz@vds-hunger-hub.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"

# ─── New: Admin WhatsApp number for redirect ────────────────────
NEXT_PUBLIC_ADMIN_WHATSAPP="916356350086"
```

### 3.4 Firebase Client Init

**New file:** `src/lib/firebase-client.ts`

```ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firebaseAuth = getAuth(app);
```

### 3.5 Firebase Admin Init

**New file:** `src/lib/firebase-admin.ts`

```ts
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      // Replace escaped newlines that env vars strip
      privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    }),
  });
}

export const firebaseAdmin = getAuth();
```

### 3.6 User Auth Helpers

**New file:** `src/lib/user-auth.ts`

```ts
import jwt from "jsonwebtoken";

const USER_JWT_SECRET = process.env.USER_JWT_SECRET!;
const USER_JWT_EXPIRES_IN = process.env.USER_JWT_EXPIRES_IN ?? "180d";

export interface UserTokenPayload {
  sub: string;       // userId (User.id from DB)
  number: string;    // 10-digit mobile number
  name: string;
  companyId: string;
  companyName: string;
  role: "USER";
  iat?: number;
  exp?: number;
}

export function signUserToken(payload: Omit<UserTokenPayload, "role">): string {
  return jwt.sign(
    { ...payload, role: "USER" },
    USER_JWT_SECRET,
    { expiresIn: USER_JWT_EXPIRES_IN }
  );
}

export function verifyUserToken(token: string): UserTokenPayload | null {
  try {
    return jwt.verify(token, USER_JWT_SECRET) as UserTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Build a deterministic device fingerprint from browser signals.
 * Called client-side; result is sent to server with each auth request.
 * NOT a security control — only used for UX session persistence.
 */
export async function getDeviceHash(): Promise<string> {
  const raw = [
    navigator.userAgent,
    screen.width.toString(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");

  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

---

## 4. Phase 3 — User Auth API Routes

### 4.1 `POST /api/user-auth/check-number`

**File:** `src/app/api/user-auth/check-number/route.ts`

**Purpose:** Check if the mobile number exists in the `User` table. Returns allowed/not-allowed. **Does NOT send OTP** — OTP is triggered entirely client-side by Firebase SDK.

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { number } = await req.json();

  // Normalize: strip +91, leading zeros, spaces
  const normalized = String(number ?? "").replace(/\D/g, "").slice(-10);

  if (normalized.length !== 10) {
    return NextResponse.json({ error: "Invalid mobile number" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { number: normalized },
    select: { id: true, isActive: true, name: true },
  });

  if (!user || !user.isActive) {
    // User not registered — return flag so client redirects to WhatsApp
    return NextResponse.json({ found: false }, { status: 200 });
  }

  return NextResponse.json({ found: true, name: user.name }, { status: 200 });
}
```

**Key constraint:** This endpoint has NO rate limiting of its own — Firebase handles OTP rate limiting. However, to prevent bulk enumeration, add a simple IP-based guard:

```ts
// At the top of the handler, after parsing number:
const ip = req.headers.get("x-forwarded-for") ?? "unknown";
// Use a lightweight in-memory Map (or Redis if available) to rate-limit
// Max 10 check-number calls per IP per minute
// For MVP: rely on Firebase App Check (add later) instead of custom rate limiting
```

### 4.2 `POST /api/user-auth/verify`

**File:** `src/app/api/user-auth/verify/route.ts`

**Purpose:** Client sends Firebase `idToken` (from `user.getIdToken()` after OTP verification). Server verifies it with Firebase Admin SDK, looks up user in DB, mints a 180-day JWT, and stores device fingerprint.

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { firebaseAdmin } from "@/lib/firebase-admin";
import { signUserToken } from "@/lib/user-auth";

export async function POST(req: NextRequest) {
  const { idToken, deviceHash } = await req.json();

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "idToken required" }, { status: 400 });
  }

  // 1. Verify Firebase ID token
  let firebaseUid: string;
  let phoneNumber: string;
  try {
    const decoded = await firebaseAdmin.verifyIdToken(idToken);
    firebaseUid = decoded.uid;
    phoneNumber = decoded.phone_number ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid or expired OTP token" }, { status: 401 });
  }

  // 2. Normalize phone number (Firebase sends +91XXXXXXXXXX)
  const normalized = phoneNumber.replace(/\D/g, "").slice(-10);

  // 3. Look up user in DB
  const user = await prisma.user.findUnique({
    where: { number: normalized },
    include: { company: { select: { id: true, name: true } } },
  });

  if (!user || !user.isActive) {
    return NextResponse.json(
      { error: "Your number is not registered. Please contact admin." },
      { status: 403 }
    );
  }

  // 4. Store or update device fingerprint
  if (deviceHash && typeof deviceHash === "string" && deviceHash.length === 64) {
    await prisma.userDevice.upsert({
      where: { userId_deviceHash: { userId: user.id, deviceHash } },
      update: { lastSeenAt: new Date() },
      create: { userId: user.id, deviceHash },
    });
  }

  // 5. Mint 180-day user JWT
  const token = signUserToken({
    sub: user.id,
    number: user.number,
    name: user.name,
    companyId: user.company.id,
    companyName: user.company.name,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      number: user.number,
      companyName: user.company.name,
    },
  });
}
```

### 4.3 `GET /api/user-auth/me`

**File:** `src/app/api/user-auth/me/route.ts`

**Purpose:** Validate stored JWT and optionally re-register device fingerprint (for new device detection).

```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) return NextResponse.json({ error: "No token" }, { status: 401 });

  const payload = verifyUserToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid token" }, { status: 401 });

  // Re-verify user is still active in DB
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { company: { select: { id: true, name: true } } },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }

  // Check if device fingerprint is provided (new device scenario)
  const deviceHash = req.nextUrl.searchParams.get("deviceHash");
  if (deviceHash && deviceHash.length === 64) {
    const deviceExists = await prisma.userDevice.findUnique({
      where: { userId_deviceHash: { userId: user.id, deviceHash } },
    });

    if (!deviceExists) {
      // This is a new device — tell the client to run OTP again
      return NextResponse.json({ newDevice: true }, { status: 200 });
    }

    // Update lastSeen
    await prisma.userDevice.update({
      where: { userId_deviceHash: { userId: user.id, deviceHash } },
      data: { lastSeenAt: new Date() },
    });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    number: user.number,
    companyName: user.company.name,
    newDevice: false,
  });
}
```

---

## 5. Phase 4 — Public Menu Page (Thali + Sabji Selector)

### 5.1 Page Route

**File:** `src/app/menu/[slug]/page.tsx`

This is a **Client Component** — it manages user auth state, the OTP flow, and order state. The `slug` corresponds to `DailyMenu.publicSlug`.

**Data fetching:** `GET /api/public/menu/:slug` — already exists. Returns menu with thalis, sabji options, cutoff time.

### 5.2 State Machine

The page has these distinct UI states:

```ts
type PageState =
  | "loading"          // initial load, checking auth + fetching menu
  | "cutoff_passed"    // menu exists but past cutoff time — show contact admin
  | "menu"             // showing thali/sabji picker
  | "phone_input"      // asking for mobile number (first time / new device)
  | "otp_pending"      // OTP sent, waiting for user to enter code
  | "confirming"       // showing order confirmation modal
  | "success"          // order placed successfully
  | "not_found"        // menu slug doesn't exist
```

### 5.3 Full Component Structure

**File:** `src/app/menu/[slug]/page.tsx`

```tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase-client";
import { getDeviceHash } from "@/lib/user-auth";
import { ADMIN_WHATSAPP_NUMBER } from "@/lib/constants";
import toast from "react-hot-toast";

// Sub-components (described below)
import MenuThaliCard from "@/components/public/MenuThaliCard";
import OtpModal from "@/components/public/OtpModal";
import OrderConfirmModal from "@/components/public/OrderConfirmModal";
import OrderSuccessScreen from "@/components/public/OrderSuccessScreen";
import CutoffScreen from "@/components/public/CutoffScreen";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PublicMenu {
  id: string;
  date: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime: string | null;
  isPublished: boolean;
  thalis: PublicThali[];
  sabjiOptions: PublicSabjiOption[];
}

interface PublicThali {
  thaliId: string;
  thali: {
    id: string;
    name: string;
    nameGu: string | null;
    price: number;
    description: string | null;
    maxSabjiCount: number;
    items: { itemName: string; sortOrder: number }[];
  };
  minSabjiRequired: number;
}

interface PublicSabjiOption {
  thaliId: string;
  productId: string;
  product: { id: string; name: string; nameGu: string | null };
}

interface UserInfo {
  id: string;
  name: string;
  number: string;
  companyName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LOCAL_JWT_KEY = "vdh_user_jwt";

function getStoredJwt(): string | null {
  try { return localStorage.getItem(LOCAL_JWT_KEY); }
  catch { return null; }
}

function storeJwt(token: string) {
  try { localStorage.setItem(LOCAL_JWT_KEY, token); }
  catch { /* ignore in SSR or private browsing */ }
}

function isCutoffPassed(cutoffTime: string | null, menuDate: string): boolean {
  if (!cutoffTime) return false;
  // cutoffTime is stored as UTC DateTime in DB, returned as ISO string
  const cutoff = new Date(cutoffTime);
  return new Date() > cutoff;
}

// ─── Main Page Component ───────────────────────────────────────────────────────
export default function MenuSlugPage() {
  const { slug } = useParams<{ slug: string }>();

  // UI State
  const [pageState, setPageState] = useState<PageState>("loading");
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // Selection state
  const [selectedThaliId, setSelectedThaliId] = useState<string | null>(null);
  const [selectedSabjiIds, setSelectedSabjiIds] = useState<string[]>([]);

  // Phone + OTP state
  const [phoneInput, setPhoneInput] = useState("");
  const [confirmationResult, setConfirmationResult] =
    useState<ConfirmationResult | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Order state
  const [placingOrder, setPlacingOrder] = useState(false);

  // ─── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      // 1. Fetch menu
      const res = await fetch(`/api/public/menu/${slug}`);
      if (!res.ok) { setPageState("not_found"); return; }
      const data: PublicMenu = await res.json();
      setMenu(data);

      // 2. Check cutoff
      if (isCutoffPassed(data.cutoffTime, data.date)) {
        setPageState("cutoff_passed");
        return;
      }

      // 3. Check stored JWT
      const jwt = getStoredJwt();
      if (jwt) {
        const deviceHash = await getDeviceHash();
        const meRes = await fetch(
          `/api/user-auth/me?deviceHash=${deviceHash}`,
          { headers: { Authorization: `Bearer ${jwt}` } }
        );
        if (meRes.ok) {
          const me = await meRes.json();
          if (me.newDevice) {
            // JWT valid but new device → OTP required once more
            setPageState("phone_input");
            return;
          }
          setUserInfo(me);
          setPageState("menu");
          return;
        }
        // JWT invalid/expired — clear it
        localStorage.removeItem(LOCAL_JWT_KEY);
      }

      setPageState("menu"); // not logged in yet, but can browse
    }

    init().catch(console.error);
  }, [slug]);

  // ─── Place Order button handler ───────────────────────────────────────────
  async function handlePlaceOrder() {
    if (!selectedThaliId) {
      toast.error("Please select a thali first");
      return;
    }

    // Validate sabji selection
    const thaliConfig = menu!.thalis.find((t) => t.thaliId === selectedThaliId);
    if (thaliConfig && selectedSabjiIds.length < thaliConfig.minSabjiRequired) {
      toast.error(
        `Please select at least ${thaliConfig.minSabjiRequired} sabji option(s)`
      );
      return;
    }

    if (userInfo) {
      // Already verified — go straight to confirmation
      setPageState("confirming");
    } else {
      // Need to verify identity
      setPageState("phone_input");
    }
  }

  // ─── Phone number submit ──────────────────────────────────────────────────
  async function handlePhoneSubmit(phone: string) {
    const normalized = phone.replace(/\D/g, "").slice(-10);

    // Check if number is registered
    const checkRes = await fetch("/api/user-auth/check-number", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: normalized }),
    });
    const checkData = await checkRes.json();

    if (!checkData.found) {
      // Not registered — redirect to WhatsApp
      const waUrl = `https://wa.me/${process.env.NEXT_PUBLIC_ADMIN_WHATSAPP}?text=${encodeURIComponent(
        `Hi, I want to register for VD's Hunger Hub tiffin service. My number is +91${normalized}`
      )}`;
      window.open(waUrl, "_blank");
      toast("Your number is not registered. We've opened WhatsApp for you!", {
        icon: "📱",
        duration: 5000,
      });
      return;
    }

    // Number is registered — trigger OTP via Firebase
    setOtpSending(true);
    try {
      // Initialize RecaptchaVerifier (invisible)
      if (!recaptchaVerifierRef.current && recaptchaContainerRef.current) {
        recaptchaVerifierRef.current = new RecaptchaVerifier(
          firebaseAuth,
          recaptchaContainerRef.current,
          { size: "invisible" }
        );
      }

      const result = await signInWithPhoneNumber(
        firebaseAuth,
        `+91${normalized}`,
        recaptchaVerifierRef.current!
      );
      setConfirmationResult(result);
      setPageState("otp_pending");
      toast.success("OTP sent to your number");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send OTP";
      // Handle Firebase rate limit gracefully
      if (msg.includes("too-many-requests")) {
        toast.error("Too many attempts. Please try again after a few minutes.");
      } else {
        toast.error("Could not send OTP. Please try again.");
      }
    } finally {
      setOtpSending(false);
    }
  }

  // ─── OTP Verification ─────────────────────────────────────────────────────
  async function handleOtpVerify(otp: string) {
    if (!confirmationResult) return;
    try {
      const credential = await confirmationResult.confirm(otp);
      const idToken = await credential.user.getIdToken();
      const deviceHash = await getDeviceHash();

      const verifyRes = await fetch("/api/user-auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, deviceHash }),
      });

      if (!verifyRes.ok) {
        const err = await verifyRes.json();
        toast.error(err.error ?? "Verification failed");
        return;
      }

      const { token, user } = await verifyRes.json();
      storeJwt(token);
      setUserInfo(user);
      setPageState("confirming");
      toast.success(`Welcome, ${user.name}!`);
    } catch {
      toast.error("Incorrect OTP. Please try again.");
    }
  }

  // ─── Place Order after confirmation ───────────────────────────────────────
  async function handleConfirmOrder() {
    if (!menu || !selectedThaliId || !userInfo) return;
    setPlacingOrder(true);

    const jwt = getStoredJwt();
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          menuId: menu.id,
          thaliId: selectedThaliId,
          selectedSabjiIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        toast.error(err.error ?? "Order failed");
        return;
      }

      setPageState("success");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (pageState === "loading") return <FullPageLoader />;
  if (pageState === "not_found") return <NotFoundScreen />;
  if (pageState === "cutoff_passed") return <CutoffScreen />;
  if (pageState === "success") return <OrderSuccessScreen menu={menu!} userInfo={userInfo!} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <PublicMenuNavbar />

      {/* Invisible reCAPTCHA container — required by Firebase */}
      <div ref={recaptchaContainerRef} id="recaptcha-container" />

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Menu Header */}
        <MenuHeader menu={menu!} />

        {/* Thali + Sabji Picker */}
        {menu!.thalis.map((thaliSlot) => {
          const availableSabji = menu!.sabjiOptions
            .filter((so) => so.thaliId === thaliSlot.thaliId)
            .map((so) => so.product);

          return (
            <MenuThaliCard
              key={thaliSlot.thaliId}
              thali={thaliSlot.thali}
              minSabjiRequired={thaliSlot.minSabjiRequired}
              availableSabji={availableSabji}
              isSelected={selectedThaliId === thaliSlot.thaliId}
              selectedSabjiIds={
                selectedThaliId === thaliSlot.thaliId ? selectedSabjiIds : []
              }
              onSelectThali={() => {
                setSelectedThaliId(thaliSlot.thaliId);
                setSelectedSabjiIds([]);
              }}
              onSabjiChange={setSelectedSabjiIds}
            />
          );
        })}

        {/* Place Order CTA */}
        <div className="sticky bottom-4">
          <button
            onClick={handlePlaceOrder}
            disabled={!selectedThaliId}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed
                       text-white font-bold py-4 rounded-2xl text-base shadow-lg shadow-orange-500/30
                       transition-all duration-200"
          >
            {userInfo ? "Place Order" : "Place Order — Verify to Continue"}
          </button>
        </div>
      </main>

      {/* OTP Flow Modal */}
      {(pageState === "phone_input" || pageState === "otp_pending") && (
        <OtpModal
          state={pageState}
          onPhoneSubmit={handlePhoneSubmit}
          onOtpVerify={handleOtpVerify}
          otpSending={otpSending}
          onClose={() => setPageState("menu")}
        />
      )}

      {/* Order Confirmation Modal */}
      {pageState === "confirming" && userInfo && menu && (
        <OrderConfirmModal
          user={userInfo}
          menu={menu}
          selectedThaliId={selectedThaliId!}
          selectedSabjiIds={selectedSabjiIds}
          onConfirm={handleConfirmOrder}
          onBack={() => setPageState("menu")}
          isLoading={placingOrder}
        />
      )}
    </div>
  );
}
```

### 5.4 `MenuThaliCard` Component

**File:** `src/components/public/MenuThaliCard.tsx`

```tsx
"use client";

interface MenuThaliCardProps {
  thali: { id: string; name: string; nameGu: string | null; price: number; description: string | null; maxSabjiCount: number; items: { itemName: string; sortOrder: number }[] };
  minSabjiRequired: number;
  availableSabji: { id: string; name: string; nameGu: string | null }[];
  isSelected: boolean;
  selectedSabjiIds: string[];
  onSelectThali: () => void;
  onSabjiChange: (ids: string[]) => void;
}

export default function MenuThaliCard({
  thali, minSabjiRequired, availableSabji, isSelected,
  selectedSabjiIds, onSelectThali, onSabjiChange,
}: MenuThaliCardProps) {
  function toggleSabji(id: string) {
    if (selectedSabjiIds.includes(id)) {
      onSabjiChange(selectedSabjiIds.filter((s) => s !== id));
    } else if (selectedSabjiIds.length < thali.maxSabjiCount) {
      onSabjiChange([...selectedSabjiIds, id]);
    }
    // If at max — do nothing (user must deselect first)
  }

  return (
    <div
      className={`bg-white rounded-2xl border-2 transition-all duration-200 overflow-hidden
        ${isSelected ? "border-orange-500 shadow-md shadow-orange-500/10" : "border-gray-200 hover:border-orange-200"}`}
    >
      {/* Header — click to select this thali */}
      <button
        type="button"
        onClick={onSelectThali}
        className="w-full text-left p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900 text-base">{thali.name}</h3>
            {thali.nameGu && (
              <p className="text-sm text-gray-500 mt-0.5">{thali.nameGu}</p>
            )}
            {thali.description && (
              <p className="text-xs text-gray-400 mt-1">{thali.description}</p>
            )}
            {/* Fixed items */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[...thali.items]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((item) => (
                  <span
                    key={item.itemName}
                    className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                  >
                    {item.itemName}
                  </span>
                ))}
            </div>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-xl font-extrabold text-orange-600">₹{thali.price}</p>
            <div className={`mt-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center ml-auto
              ${isSelected ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
              {isSelected && (
                <svg viewBox="0 0 10 8" fill="none" className="w-3 h-3">
                  <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Sabji selector — only shown when this thali is selected AND it has sabji options */}
      {isSelected && thali.maxSabjiCount > 0 && availableSabji.length > 0 && (
        <div className="border-t border-orange-100 bg-orange-50/40 px-5 py-4">
          <p className="text-xs font-semibold text-orange-700 mb-3">
            Choose your Sabji
            {minSabjiRequired > 0 && (
              <span className="text-gray-400 font-normal">
                {" "}(min {minSabjiRequired}, max {thali.maxSabjiCount})
              </span>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {availableSabji.map((sabji) => {
              const isSabjiSelected = selectedSabjiIds.includes(sabji.id);
              const atMax =
                selectedSabjiIds.length >= thali.maxSabjiCount && !isSabjiSelected;

              return (
                <button
                  key={sabji.id}
                  type="button"
                  onClick={() => toggleSabji(sabji.id)}
                  disabled={atMax}
                  className={`text-left px-3 py-2.5 rounded-xl border text-sm font-medium transition-all
                    ${isSabjiSelected
                      ? "border-orange-500 bg-orange-500 text-white"
                      : atMax
                        ? "border-gray-200 bg-gray-50 text-gray-300 cursor-not-allowed"
                        : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
                    }`}
                >
                  <p className="font-semibold text-sm">{sabji.name}</p>
                  {sabji.nameGu && (
                    <p className={`text-[11px] mt-0.5 ${isSabjiSelected ? "text-orange-100" : "text-gray-400"}`}>
                      {sabji.nameGu}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            {selectedSabjiIds.length} / {thali.maxSabjiCount} selected
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 6. Phase 5 — OTP Flow (Mobile Verification)

### 6.1 `OtpModal` Component

**File:** `src/components/public/OtpModal.tsx`

This is a bottom-sheet style modal on mobile. It handles both the phone input step and the OTP entry step.

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { X, Phone, ShieldCheck, Loader2 } from "lucide-react";

interface OtpModalProps {
  state: "phone_input" | "otp_pending";
  onPhoneSubmit: (phone: string) => Promise<void>;
  onOtpVerify: (otp: string) => Promise<void>;
  otpSending: boolean;
  onClose: () => void;
}

export default function OtpModal({
  state, onPhoneSubmit, onOtpVerify, otpSending, onClose,
}: OtpModalProps) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  async function handlePhoneSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (phone.replace(/\D/g, "").length !== 10) return;
    setSubmitting(true);
    try {
      await onPhoneSubmit(phone);
    } finally {
      setSubmitting(false);
    }
  }

  function handleOtpDigit(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) return;
    setSubmitting(true);
    try {
      await onOtpVerify(code);
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    const code = otp.join("");
    if (code.length === 6 && !submitting) {
      handleOtpSubmit(new Event("submit") as unknown as React.FormEvent);
    }
  }, [otp]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal panel */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl p-6 pb-10 shadow-2xl
                      max-w-lg mx-auto animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X size={18} />
        </button>

        {state === "phone_input" ? (
          <form onSubmit={handlePhoneSubmit} className="space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Phone className="text-orange-600" size={22} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Verify Your Number</h2>
              <p className="text-sm text-gray-500">
                Enter your registered mobile number to continue
              </p>
            </div>

            <div>
              <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden
                              focus-within:border-orange-500 transition-colors">
                <span className="px-3 py-3.5 bg-gray-50 text-gray-500 font-medium text-sm border-r border-gray-200">
                  +91
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit mobile number"
                  className="flex-1 px-3 py-3.5 text-base font-medium text-gray-900 outline-none bg-white"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={phone.length !== 10 || submitting || otpSending}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed
                         text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {(submitting || otpSending) && <Loader2 size={18} className="animate-spin" />}
              {submitting || otpSending ? "Sending OTP..." : "Send OTP"}
            </button>

            <p className="text-center text-xs text-gray-400">
              Not registered?{" "}
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_ADMIN_WHATSAPP}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-500 underline"
              >
                Contact admin on WhatsApp
              </a>
            </p>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit} className="space-y-5">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="text-green-600" size={22} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Enter OTP</h2>
              <p className="text-sm text-gray-500">
                We&apos;ve sent a 6-digit code to your mobile
              </p>
            </div>

            {/* 6-digit OTP input boxes */}
            <div className="flex gap-2 justify-center">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpDigit(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none
                             border-gray-200 focus:border-orange-500 transition-colors text-gray-900"
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={otp.join("").length !== 6 || submitting}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed
                         text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 size={18} className="animate-spin" />}
              {submitting ? "Verifying..." : "Verify OTP"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}
```

---

## 7. Phase 6 — Order Confirmation Modal

### 7.1 `OrderConfirmModal` Component

**File:** `src/components/public/OrderConfirmModal.tsx`

This is shown AFTER the user is verified. Shows their details and the order summary before final confirmation. **No cancellation allowed after this screen.**

```tsx
"use client";

import { AlertTriangle, Loader2 } from "lucide-react";

interface OrderConfirmModalProps {
  user: { id: string; name: string; number: string; companyName: string };
  menu: { id: string; date: string; mealType: string; thalis: any[]; sabjiOptions: any[] };
  selectedThaliId: string;
  selectedSabjiIds: string[];
  onConfirm: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export default function OrderConfirmModal({
  user, menu, selectedThaliId, selectedSabjiIds, onConfirm, onBack, isLoading,
}: OrderConfirmModalProps) {
  const thaliSlot = menu.thalis.find((t) => t.thaliId === selectedThaliId);
  const thali = thaliSlot?.thali;
  const selectedSabji = menu.sabjiOptions
    .filter((so) => selectedSabjiIds.includes(so.productId))
    .map((so) => so.product);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" />
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5">
          
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-extrabold text-gray-900">Confirm Your Order</h2>
            <p className="text-sm text-gray-500 mt-1">
              Please review your details before placing the order
            </p>
          </div>

          {/* User details */}
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Ordering As</p>
            <div className="space-y-1">
              <p className="font-bold text-gray-900 text-lg">{user.name}</p>
              <p className="text-sm text-gray-600">{user.companyName}</p>
              <p className="text-sm text-gray-400">+91 {user.number}</p>
            </div>
          </div>

          {/* Order details */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Order Summary</p>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-gray-900">{thali?.name}</p>
                {thali?.nameGu && <p className="text-xs text-gray-400">{thali.nameGu}</p>}
              </div>
              <p className="font-extrabold text-orange-600">₹{thali?.price}</p>
            </div>
            {selectedSabji.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Sabji Selection:</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSabji.map((s) => (
                    <span key={s.id} className="text-xs bg-white border border-gray-200 px-2 py-1 rounded-full text-gray-700">
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* No-cancellation warning */}
          <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <AlertTriangle className="text-amber-600 flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-amber-700 font-medium">
              Once confirmed, this order cannot be cancelled. Please verify your details carefully.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold
                         hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Go Back
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold
                         transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 size={16} className="animate-spin" />}
              {isLoading ? "Placing..." : "Yes, Place Order"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

---

## 8. Phase 7 — Order API Routes

### 8.1 Helper: Extract User Token from Request

**File:** `src/lib/user-auth.ts` (add this function)

```ts
export function getUserFromRequest(req: NextRequest): UserTokenPayload | null {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();
  if (!token) return null;
  return verifyUserToken(token);
}
```

### 8.2 `POST /api/orders` — Place Order

**File:** `src/app/api/orders/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/user-auth";

export async function POST(req: NextRequest) {
  // 1. Auth
  const userPayload = getUserFromRequest(req);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  const { menuId, thaliId, selectedSabjiIds } = await req.json();
  if (!menuId || !thaliId) {
    return NextResponse.json({ error: "menuId and thaliId are required" }, { status: 400 });
  }

  // 3. Validate user is still active
  const user = await prisma.user.findUnique({ where: { id: userPayload.sub } });
  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Account is deactivated" }, { status: 403 });
  }

  // 4. Validate menu exists and is published
  const menu = await prisma.dailyMenu.findUnique({
    where: { id: menuId },
    include: {
      thalis: { where: { thaliId } },
      sabjiOptions: true,
    },
  });

  if (!menu || !menu.isPublished) {
    return NextResponse.json({ error: "Menu not found or not published" }, { status: 404 });
  }

  // 5. Validate cutoff time
  if (menu.cutoffTime && new Date() > new Date(menu.cutoffTime)) {
    return NextResponse.json(
      { error: "Ordering cutoff time has passed. Please contact admin." },
      { status: 400 }
    );
  }

  // 6. Validate thali is in this menu
  if (menu.thalis.length === 0) {
    return NextResponse.json({ error: "This thali is not available today" }, { status: 400 });
  }

  const thaliSlot = menu.thalis[0];

  // 7. Validate sabji selection
  const thaliDetail = await prisma.thali.findUnique({ where: { id: thaliId } });
  if (!thaliDetail) {
    return NextResponse.json({ error: "Thali not found" }, { status: 404 });
  }

  const validSabjiProductIds = menu.sabjiOptions
    .filter((so) => so.thaliId === thaliId)
    .map((so) => so.productId);

  const sabjiToAdd: string[] = (selectedSabjiIds ?? []).filter(
    (id: string) => validSabjiProductIds.includes(id)
  );

  if (thaliDetail.maxSabjiCount > 0 && sabjiToAdd.length < thaliSlot.minSabjiRequired) {
    return NextResponse.json(
      { error: `Minimum ${thaliSlot.minSabjiRequired} sabji selection required` },
      { status: 400 }
    );
  }

  // 8. Check for duplicate order (same user, same menu, same thali — idempotent)
  const existingOrder = await prisma.order.findFirst({
    where: { userId: user.id, menuId, thaliId },
  });

  if (existingOrder) {
    return NextResponse.json(
      { error: "You have already placed an order for this meal.", orderId: existingOrder.id },
      { status: 409 }
    );
  }

  // 9. Calculate total
  const totalAmount = thaliDetail.price; // sabji is included in thali price for now

  // 10. Create order
  const order = await prisma.order.create({
    data: {
      userId: user.id,
      menuId,
      thaliId,
      totalAmount,
      status: "PENDING",
      selectedSabji: {
        create: sabjiToAdd.map((productId: string) => ({ productId })),
      },
    },
    include: {
      selectedSabji: { include: { product: { select: { id: true, name: true } } } },
      thali: { select: { id: true, name: true, price: true } },
      menu: { select: { id: true, date: true, mealType: true } },
    },
  });

  return NextResponse.json({ order }, { status: 201 });
}

// GET /api/orders — User's own orders (paginated)
export async function GET(req: NextRequest) {
  const userPayload = getUserFromRequest(req);
  if (!userPayload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
  const skip = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { userId: userPayload.sub },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        thali: { select: { id: true, name: true, nameGu: true, price: true } },
        menu: { select: { id: true, date: true, mealType: true } },
        selectedSabji: {
          include: { product: { select: { id: true, name: true, nameGu: true } } },
        },
      },
    }),
    prisma.order.count({ where: { userId: userPayload.sub } }),
  ]);

  return NextResponse.json({ orders, total, page, limit });
}
```

### 8.3 `PATCH /api/orders/[id]` — Admin Update Status

**File:** `src/app/api/orders/[id]/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Admin/Staff auth only
  const token =
    req.cookies.get("vdh_token")?.value ??
    req.cookies.get("vd_admin_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await req.json();
  const validStatuses = ["PENDING", "CONFIRMED", "DELIVERED", "CANCELLED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const order = await prisma.order.update({
    where: { id },
    data: { status },
    include: {
      user: { select: { id: true, name: true, number: true } },
      thali: { select: { id: true, name: true } },
      selectedSabji: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  return NextResponse.json({ order });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const token =
    req.cookies.get("vdh_token")?.value ??
    req.cookies.get("vd_admin_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { include: { company: { select: { id: true, name: true } } } },
      thali: true,
      menu: { select: { id: true, date: true, mealType: true } },
      selectedSabji: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({ order });
}
```

### 8.4 `GET /api/admin/orders` — Admin Orders List (with polling support)

**File:** `src/app/api/admin/orders/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { getTodayIST } from "@/lib/utils";

export async function GET(req: NextRequest) {
  // Admin/Staff auth
  const token =
    req.cookies.get("vdh_token")?.value ??
    req.cookies.get("vd_admin_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const dateFilter = searchParams.get("date") ?? getTodayIST(); // YYYY-MM-DD
  const statusFilter = searchParams.get("status"); // optional
  const mealType = searchParams.get("mealType"); // LUNCH | DINNER | null

  // Build where clause
  const where: Record<string, unknown> = {
    menu: {
      date: new Date(dateFilter),
      ...(mealType ? { mealType } : {}),
    },
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        include: { company: { select: { id: true, name: true } } },
      },
      thali: { select: { id: true, name: true, nameGu: true, price: true } },
      menu: { select: { id: true, date: true, mealType: true, publicSlug: true } },
      selectedSabji: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
  });

  // Group by mealType for convenience
  const lunch = orders.filter((o) => o.menu.mealType === "LUNCH");
  const dinner = orders.filter((o) => o.menu.mealType === "DINNER");

  return NextResponse.json({
    date: dateFilter,
    totalOrders: orders.length,
    lunch: { count: lunch.length, orders: lunch },
    dinner: { count: dinner.length, orders: dinner },
    fetchedAt: new Date().toISOString(),
  });
}
```

---

## 9. Phase 8 — User Order History Page

### 9.1 Route

**File:** `src/app/menu/orders/page.tsx`

This is a **Client Component** accessible via the public menu site. Users access it at `/menu/orders`. It reads the JWT from `localStorage` and shows the user's order history.

```tsx
"use client";

import { useEffect, useState } from "react";
import { verifyUserToken } from "@/lib/user-auth";
import { formatDate } from "@/lib/utils";
import Navbar from "@/components/public/Navbar";

const LOCAL_JWT_KEY = "vdh_user_jwt";

interface OrderListItem {
  id: string;
  status: "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED";
  totalAmount: number;
  createdAt: string;
  thali: { name: string; nameGu: string | null; price: number };
  menu: { date: string; mealType: "LUNCH" | "DINNER" };
  selectedSabji: { product: { name: string } }[];
}

const STATUS_CONFIG = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  CONFIRMED: { label: "Confirmed", color: "bg-blue-100 text-blue-700" },
  DELIVERED: { label: "Delivered", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Cancelled", color: "bg-red-100 text-red-700" },
};

export default function UserOrdersPage() {
  const [orders, setOrders] = useState<OrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    async function loadOrders() {
      const jwt = localStorage.getItem(LOCAL_JWT_KEY);
      if (!jwt) {
        setError("Please place an order first to view your history.");
        setLoading(false);
        return;
      }

      // Get user name from JWT payload
      const payload = verifyUserToken(jwt);
      if (payload) setUserName(payload.name);

      const res = await fetch("/api/orders?limit=50", {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      if (!res.ok) {
        setError("Could not load order history.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setOrders(data.orders);
      setLoading(false);
    }

    loadOrders();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">My Orders</h1>
          {userName && <p className="text-sm text-gray-500 mt-0.5">Hello, {userName}</p>}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-sm text-red-600">
            {error}
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-400">
            No orders yet
          </div>
        )}

        <div className="space-y-3">
          {orders.map((order) => {
            const statusConf = STATUS_CONFIG[order.status];
            return (
              <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
                {/* Header row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-900">{order.thali.name}</p>
                    {order.thali.nameGu && (
                      <p className="text-xs text-gray-400">{order.thali.nameGu}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-extrabold text-orange-600">₹{order.totalAmount}</p>
                    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full mt-1 ${statusConf.color}`}>
                      {statusConf.label}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                  <span>📅 {formatDate(order.menu.date)}</span>
                  <span>🍽 {order.menu.mealType === "LUNCH" ? "Lunch" : "Dinner"}</span>
                  <span>🕒 {new Date(order.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>

                {/* Sabji */}
                {order.selectedSabji.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {order.selectedSabji.map(({ product }) => (
                      <span key={product.name} className="text-[11px] bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full">
                        {product.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
```

---

## 10. Phase 9 — Admin/Staff: Orders View with Polling

### 10.1 New Admin Route

**File:** `src/app/(admin)/orders/page.tsx`

Add `orders` to the admin sidebar and create this page. It is accessible to both `ADMIN` and `STAFF` roles.

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, Clock, CheckCircle, Package, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { getTodayIST } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

type OrderStatus = "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

interface AdminOrder {
  id: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  user: {
    id: string; name: string; number: string;
    company: { id: string; name: string };
  };
  thali: { id: string; name: string; nameGu: string | null; price: number };
  menu: { id: string; date: string; mealType: "LUNCH" | "DINNER"; publicSlug: string | null };
  selectedSabji: { product: { id: string; name: string } }[];
}

interface OrdersResponse {
  date: string;
  totalOrders: number;
  lunch: { count: number; orders: AdminOrder[] };
  dinner: { count: number; orders: AdminOrder[] };
  fetchedAt: string;
}

const STATUS_ICONS: Record<OrderStatus, React.ReactNode> = {
  PENDING: <Clock size={14} className="text-yellow-500" />,
  CONFIRMED: <CheckCircle size={14} className="text-blue-500" />,
  DELIVERED: <Package size={14} className="text-green-500" />,
  CANCELLED: <XCircle size={14} className="text-red-500" />,
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-blue-100 text-blue-700",
  DELIVERED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function AdminOrdersPage() {
  const [data, setData] = useState<OrdersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [activeTab, setActiveTab] = useState<"LUNCH" | "DINNER">("LUNCH");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) setRefreshing(true);
      try {
        const res = await fetch(
          `/api/admin/orders?date=${selectedDate}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("Failed to load orders");
        const json: OrdersResponse = await res.json();
        setData(json);
        setLastFetchedAt(json.fetchedAt);
      } catch {
        if (showRefreshIndicator) toast.error("Could not refresh orders");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  // Initial load + start polling
  useEffect(() => {
    setLoading(true);
    fetchOrders();

    // Set up 5-minute polling
    pollTimerRef.current = setInterval(() => {
      fetchOrders(); // silent background refresh
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchOrders]);

  async function handleStatusChange(orderId: string, newStatus: OrderStatus) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Update failed");
      toast.success(`Order marked as ${newStatus.toLowerCase()}`);
      fetchOrders(); // refresh after status change
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingId(null);
    }
  }

  const activeOrders =
    activeTab === "LUNCH" ? data?.lunch.orders ?? [] : data?.dinner.orders ?? [];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Orders</h2>
          {lastFetchedAt && (
            <p className="text-xs text-gray-400 mt-0.5">
              Last updated: {new Date(lastFetchedAt).toLocaleTimeString("en-IN")}
              {" · "}Auto-refreshes every 5 min
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-orange-500/30"
          />
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 rounded-xl
                       text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Orders", value: data.totalOrders, color: "orange" },
            { label: "Lunch Orders", value: data.lunch.count, color: "amber" },
            { label: "Dinner Orders", value: data.dinner.count, color: "indigo" },
            {
              label: "Pending",
              value:
                [...data.lunch.orders, ...data.dinner.orders].filter(
                  (o) => o.status === "PENDING"
                ).length,
              color: "yellow",
            },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className={`text-2xl font-extrabold text-${color}-600`}>{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Meal type tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(["LUNCH", "DINNER"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {tab === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}
            {data && (
              <span className="ml-1.5 text-xs text-gray-400">
                ({tab === "LUNCH" ? data.lunch.count : data.dinner.count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Orders list */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && activeOrders.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
          No {activeTab.toLowerCase()} orders for {selectedDate}
        </div>
      )}

      <div className="space-y-3">
        {activeOrders.map((order) => (
          <div
            key={order.id}
            className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4"
          >
            {/* Order header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900">{order.user.name}</p>
                <p className="text-sm text-gray-500">{order.user.company.name}</p>
                <p className="text-xs text-gray-400">+91 {order.user.number}</p>
              </div>
              <div className="text-right">
                <p className="font-extrabold text-orange-600">{formatCurrency(order.totalAmount)}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(order.createdAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {/* Thali + Sabji */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              <p className="font-semibold text-gray-800 text-sm">
                {order.thali.name}
                {order.thali.nameGu && (
                  <span className="text-gray-400 font-normal text-xs ml-1">({order.thali.nameGu})</span>
                )}
              </p>
              {order.selectedSabji.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {order.selectedSabji.map(({ product }) => (
                    <span key={product.id} className="text-[11px] bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full">
                      {product.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Status + Actions */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                {STATUS_ICONS[order.status]}
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status]}`}>
                  {order.status}
                </span>
              </div>

              {/* Status update dropdown */}
              <select
                value={order.status}
                disabled={updatingId === order.id}
                onChange={(e) =>
                  handleStatusChange(order.id, e.target.value as OrderStatus)
                }
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5
                           focus:ring-2 focus:ring-orange-500/30 disabled:opacity-40"
              >
                <option value="PENDING">Pending</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 10.2 Sidebar Update

**File:** `src/components/admin/Sidebar.tsx`

Add the Orders link to the admin sidebar navigation. It should appear prominently — it's a daily-use item:

```tsx
// Add to nav items array (after Dashboard, before Catalog):
{
  href: "/orders",
  icon: ShoppingBag,      // from lucide-react
  label: "Orders",
  badge: "daily",         // optional visual callout
}
```

---

## 11. Phase 10 — Billing Management

### 11.1 Admin Billing View

**File:** `src/app/(admin)/billing/page.tsx`

Billing is a read-only summary view for the admin. It shows total orders and total amounts grouped by company and by date range.

```tsx
"use client";

import { useState, useEffect } from "react";
import { getTodayIST } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

// Date range: from/to inputs
// Group by: Company or User
// Shows: orders table + total amount per group + grand total

interface BillingCompany {
  companyId: string;
  companyName: string;
  totalOrders: number;
  totalAmount: number;
  users: BillingUser[];
}

interface BillingUser {
  userId: string;
  userName: string;
  userNumber: string;
  totalOrders: number;
  totalAmount: number;
  orders: BillingOrder[];
}

interface BillingOrder {
  id: string;
  date: string;
  mealType: string;
  thaliName: string;
  sabji: string[];
  amount: number;
  status: string;
}

export default function BillingPage() {
  const today = getTodayIST();
  const firstOfMonth = today.slice(0, 8) + "01";

  const [fromDate, setFromDate] = useState(firstOfMonth);
  const [toDate, setToDate] = useState(today);
  const [groupBy, setGroupBy] = useState<"company" | "user">("company");
  const [data, setData] = useState<BillingCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function fetchBilling() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/billing?from=${fromDate}&to=${toDate}&groupBy=${groupBy}`
      );
      const json = await res.json();
      setData(json.companies);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchBilling(); }, [fromDate, toDate, groupBy]);

  const grandTotal = data.reduce((acc, c) => acc + c.totalAmount, 0);
  const grandOrders = data.reduce((acc, c) => acc + c.totalOrders, 0);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Billing</h2>
        <p className="text-sm text-gray-500 mt-0.5">Order summaries and amounts by company</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">From</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-orange-500/30"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">To</label>
          <input
            type="date"
            value={toDate}
            max={today}
            onChange={(e) => setToDate(e.target.value)}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-orange-500/30"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Group By</label>
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as "company" | "user")}
            className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-orange-500/30"
          >
            <option value="company">Company</option>
            <option value="user">Individual User</option>
          </select>
        </div>
        {/* Summary chips */}
        <div className="ml-auto flex gap-3">
          <div className="text-center">
            <p className="text-xl font-extrabold text-orange-600">{grandOrders}</p>
            <p className="text-xs text-gray-400">Total Orders</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-extrabold text-green-600">{formatCurrency(grandTotal)}</p>
            <p className="text-xs text-gray-400">Grand Total</p>
          </div>
        </div>
      </div>

      {/* Billing table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((company) => (
            <div key={company.companyId} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {/* Company header row */}
              <button
                onClick={() => toggleExpand(company.companyId)}
                className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
              >
                <div className="text-left">
                  <p className="font-bold text-gray-900">{company.companyName}</p>
                  <p className="text-xs text-gray-400">{company.totalOrders} orders</p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-extrabold text-orange-600">{formatCurrency(company.totalAmount)}</p>
                  <span className="text-gray-400 text-sm">
                    {expanded.has(company.companyId) ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {/* Expanded: per-user breakdown */}
              {expanded.has(company.companyId) && (
                <div className="border-t border-gray-100">
                  {company.users.map((u) => (
                    <div key={u.userId} className="px-5 py-3 border-b border-gray-50 last:border-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">{u.userName}</p>
                          <p className="text-xs text-gray-400">+91 {u.userNumber} · {u.totalOrders} orders</p>
                        </div>
                        <p className="font-bold text-gray-700">{formatCurrency(u.totalAmount)}</p>
                      </div>

                      {/* Per-order detail */}
                      <div className="mt-2 space-y-1.5 pl-3 border-l-2 border-orange-100">
                        {u.orders.map((o) => (
                          <div key={o.id} className="flex items-center justify-between text-xs text-gray-500">
                            <span>
                              {formatDate(o.date)} · {o.mealType} · {o.thaliName}
                              {o.sabji.length > 0 && (
                                <span className="text-gray-400"> ({o.sabji.join(", ")})</span>
                              )}
                            </span>
                            <span className="font-medium">{formatCurrency(o.amount)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 11.2 Billing API

**File:** `src/app/api/admin/billing/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const token =
    req.cookies.get("vdh_token")?.value ??
    req.cookies.get("vd_admin_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from"); // YYYY-MM-DD
  const to = searchParams.get("to");     // YYYY-MM-DD

  if (!from || !to) {
    return NextResponse.json({ error: "from and to dates required" }, { status: 400 });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999); // end of day

  const orders = await prisma.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      menu: {
        date: { gte: fromDate, lte: toDate },
      },
    },
    include: {
      user: {
        include: { company: { select: { id: true, name: true } } },
      },
      thali: { select: { id: true, name: true } },
      menu: { select: { id: true, date: true, mealType: true } },
      selectedSabji: {
        include: { product: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by company → user → orders
  const companyMap = new Map<
    string,
    {
      companyId: string;
      companyName: string;
      totalOrders: number;
      totalAmount: number;
      users: Map<string, {
        userId: string;
        userName: string;
        userNumber: string;
        totalOrders: number;
        totalAmount: number;
        orders: object[];
      }>;
    }
  >();

  for (const order of orders) {
    const { company } = order.user;
    if (!companyMap.has(company.id)) {
      companyMap.set(company.id, {
        companyId: company.id,
        companyName: company.name,
        totalOrders: 0,
        totalAmount: 0,
        users: new Map(),
      });
    }
    const compEntry = companyMap.get(company.id)!;

    if (!compEntry.users.has(order.user.id)) {
      compEntry.users.set(order.user.id, {
        userId: order.user.id,
        userName: order.user.name,
        userNumber: order.user.number,
        totalOrders: 0,
        totalAmount: 0,
        orders: [],
      });
    }
    const userEntry = compEntry.users.get(order.user.id)!;

    const orderDetail = {
      id: order.id,
      date: order.menu.date.toISOString().slice(0, 10),
      mealType: order.menu.mealType,
      thaliName: order.thali.name,
      sabji: order.selectedSabji.map((s) => s.product.name),
      amount: order.totalAmount,
      status: order.status,
    };

    userEntry.orders.push(orderDetail);
    userEntry.totalOrders += 1;
    userEntry.totalAmount += order.totalAmount;
    compEntry.totalOrders += 1;
    compEntry.totalAmount += order.totalAmount;
  }

  // Serialize maps → arrays
  const companies = Array.from(companyMap.values()).map((c) => ({
    ...c,
    users: Array.from(c.users.values()),
  }));

  const grandTotal = companies.reduce((acc, c) => acc + c.totalAmount, 0);
  const grandOrders = companies.reduce((acc, c) => acc + c.totalOrders, 0);

  return NextResponse.json({ companies, grandTotal, grandOrders, from, to });
}
```

---

## 12. Phase 11 — proxy.ts Updates

**File:** `src/proxy.ts`

```ts
const PUBLIC_PATHS = [
  "/",
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/menu",               // /menu/:slug and /menu/orders
  "/api/public",         // /api/public/menu/:slug
  "/api/user-auth",      // /api/user-auth/check-number, /api/user-auth/verify, /api/user-auth/me
  "/api/orders",         // POST /api/orders and GET /api/orders (validated via Bearer token inside route)
];

// Pages only ADMIN can access (STAFF cannot)
const ADMIN_ONLY_PREFIXES = [
  "/companies",
  "/users",
  "/billing",
  "/api/companies",
  "/api/users",
  "/api/admin/billing",
];

// Pages both ADMIN and STAFF can access (require cookie auth)
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/companies",
  "/users",
  "/catalog",
  "/menu",     // NOTE: /menu/:slug is PUBLIC but /menu without slug → admin redirect
  "/orders",   // admin orders page
  "/billing",
];
```

**Important:** `/menu` must be in `PUBLIC_PATHS` so `/menu/:slug` works for customers. The admin menu builder page is at `/menu` (without slug) and is protected via the existing admin layout. The public page `/menu/orders` is also public (auth validated via Bearer JWT, not cookie).

Add this guard to clarify:

```ts
// In the proxy function:
// /menu/:slug is public; /menu exactly (no slug) needs to redirect to login if no cookie
// This is handled naturally: /menu/[slug] matches PUBLIC_PATHS["/menu"]
// And /menu (exact) is also caught by PUBLIC_PATHS — fine, the admin layout will gate it

// /api/orders: public path, but each endpoint does its own Bearer token validation
// So we don't double-gate it in the proxy
```

---

## 13. Phase 12 — TypeScript Types

**File:** `src/types/index.ts` — Append these types:

```ts
// ─────────────────────────────────────────
// USER DEVICE
// ─────────────────────────────────────────
export interface UserDevice {
  id: string;
  userId: string;
  deviceHash: string;
  lastSeenAt: string;
  createdAt: string;
}

// ─────────────────────────────────────────
// ORDER
// ─────────────────────────────────────────
export type OrderStatus = "PENDING" | "CONFIRMED" | "DELIVERED" | "CANCELLED";

export interface OrderSabjiItem {
  id: string;
  product: { id: string; name: string; nameGu?: string | null };
}

export interface Order {
  id: string;
  userId: string;
  menuId: string;
  thaliId: string;
  totalAmount: number;
  status: OrderStatus;
  note?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: User & { company?: Company };
  thali?: Thali;
  menu?: DailyMenu;
  selectedSabji?: OrderSabjiItem[];
}

export interface CreateOrderInput {
  menuId: string;
  thaliId: string;
  selectedSabjiIds: string[];
}

export interface UpdateOrderStatusInput {
  status: OrderStatus;
}

// ─────────────────────────────────────────
// BILLING
// ─────────────────────────────────────────
export interface BillingOrder {
  id: string;
  date: string;
  mealType: MealType;
  thaliName: string;
  sabji: string[];
  amount: number;
  status: OrderStatus;
}

export interface BillingUser {
  userId: string;
  userName: string;
  userNumber: string;
  totalOrders: number;
  totalAmount: number;
  orders: BillingOrder[];
}

export interface BillingCompany {
  companyId: string;
  companyName: string;
  totalOrders: number;
  totalAmount: number;
  users: BillingUser[];
}

export interface BillingResponse {
  companies: BillingCompany[];
  grandTotal: number;
  grandOrders: number;
  from: string;
  to: string;
}

// ─────────────────────────────────────────
// ADMIN ORDERS
// ─────────────────────────────────────────
export interface AdminOrdersResponse {
  date: string;
  totalOrders: number;
  lunch: { count: number; orders: Order[] };
  dinner: { count: number; orders: Order[] };
  fetchedAt: string;
}
```

---

## 14. Phase 13 — Environment Variables Reference

**File:** `.env.example` (full updated version)

```bash
# ─── Database ──────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# ─── Admin JWT (existing, unchanged) ─────────────────────────────────────
JWT_SECRET="your_admin_jwt_secret_here"
JWT_EXPIRES_IN="8h"

# ─── User JWT (new, must be DIFFERENT from admin JWT secret) ─────────────
USER_JWT_SECRET="your_user_jwt_secret_here_different_from_admin"
USER_JWT_EXPIRES_IN="180d"

# ─── App name ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_NAME="VD's Hunger Hub"

# ─── Admin WhatsApp number (for redirect when user not found) ─────────────
NEXT_PUBLIC_ADMIN_WHATSAPP="916356350086"   # with country code, no +

# ─── Firebase (Client SDK — public, safe to commit to env.example) ────────
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSy..."
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="vds-hunger-hub.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="vds-hunger-hub"
NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789:web:abcdef"

# ─── Firebase Admin SDK (server-side only — NEVER expose to client) ───────
FIREBASE_PROJECT_ID="vds-hunger-hub"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk@vds-hunger-hub.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
# NOTE: In .env file, the private key newlines must be literal \n (escaped), not real newlines
# The lib/firebase-admin.ts replaces \\n → \n at runtime
```

---

## 15. File-by-File Change Index

### New Files

| File | Purpose |
|---|---|
| `src/lib/firebase-client.ts` | Firebase client SDK init |
| `src/lib/firebase-admin.ts` | Firebase Admin SDK init (server-side) |
| `src/lib/user-auth.ts` | User JWT sign/verify, device hash helper |
| `src/app/api/user-auth/check-number/route.ts` | Check if mobile is registered |
| `src/app/api/user-auth/verify/route.ts` | Verify Firebase ID token → mint user JWT |
| `src/app/api/user-auth/me/route.ts` | Validate stored JWT, detect new device |
| `src/app/api/orders/route.ts` | POST (place order) + GET (user order history) |
| `src/app/api/orders/[id]/route.ts` | GET + PATCH (admin status update) |
| `src/app/api/admin/orders/route.ts` | Admin orders list with date filter |
| `src/app/api/admin/billing/route.ts` | Billing summary by company/user/date range |
| `src/app/menu/[slug]/page.tsx` | **Rewrite** — now full ordering page (was skeleton) |
| `src/app/menu/orders/page.tsx` | User order history (public, JWT-gated) |
| `src/app/(admin)/orders/page.tsx` | Admin orders view with polling |
| `src/app/(admin)/billing/page.tsx` | Admin billing management |
| `src/components/public/MenuThaliCard.tsx` | Thali + sabji selector card |
| `src/components/public/OtpModal.tsx` | Phone input + OTP verification modal |
| `src/components/public/OrderConfirmModal.tsx` | Pre-order confirmation modal |
| `src/components/public/OrderSuccessScreen.tsx` | Post-order success UI |
| `src/components/public/CutoffScreen.tsx` | Shown when ordering window has closed |

### Modified Files

| File | What Changes |
|---|---|
| `prisma/schema.prisma` | Add `UserDevice`, `Order`, `OrderSabji` models + `OrderStatus` enum + relations to existing models |
| `src/proxy.ts` | Add `/api/user-auth` and `/api/orders` to `PUBLIC_PATHS` |
| `src/components/admin/Sidebar.tsx` | Add **Orders** and **Billing** nav links |
| `src/types/index.ts` | Add `Order`, `OrderSabji`, `BillingCompany`, `BillingUser`, `AdminOrdersResponse` |
| `.env.example` | Add Firebase and User JWT env vars |
| `src/lib/constants.ts` | Add `ADMIN_WHATSAPP_NUMBER` export if not already there |

---

## 16. Migration SQL Reference

Full migration to run after schema edits:

```bash
npx prisma migrate dev --name v4_user_orders_devices_billing
```

This will generate and apply the SQL from Section 2.4. After migration:

```bash
npx prisma db seed   # optional: seeds sample data
npx prisma generate  # regenerates Prisma Client
```

---

## 17. Complete Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        FULL SYSTEM FLOW                                      │
│                   VD's Hunger Hub — User Panel                               │
└──────────────────────────────────────────────────────────────────────────────┘

ADMIN SIDE (existing + new)
─────────────────────────────────────────────────────────────────
  Admin creates DailyMenu (/menu page)
    → Sets thalis + sabji options + cutoff time
    → Publishes menu → gets publicSlug URL
    → Copies /menu/:slug → shares with users

  Admin sees orders (/orders page)
    → Auto-refreshes every 5 minutes
    → Manual "Refresh" button always visible
    → Can filter by date, see lunch/dinner split
    → Can update order status: PENDING → CONFIRMED → DELIVERED

  Admin checks billing (/billing page)
    → Date range picker (default: current month)
    → Groups by Company → User → individual orders
    → Grand total visible at top

USER SIDE (new)
─────────────────────────────────────────────────────────────────
  User opens /menu/:slug
    │
    ├── First time (no JWT in localStorage)
    │     │
    │     Browses thali options, selects thali + sabji
    │     │
    │     Clicks "Place Order — Verify to Continue"
    │     │
    │     OtpModal opens → phone_input state
    │       User enters 10-digit number
    │       POST /api/user-auth/check-number
    │         ├── found: true  → Firebase triggers OTP (client-side)
    │         │                   OtpModal → otp_pending state
    │         │                   User enters 6-digit OTP
    │         │                   Firebase confirms OTP (client-side)
    │         │                   POST /api/user-auth/verify (sends Firebase idToken)
    │         │                   Server mints 180-day JWT
    │         │                   JWT stored in localStorage
    │         │                   → OrderConfirmModal opens
    │         │
    │         └── found: false → WhatsApp redirect to admin
    │
    ├── Returning user, same device (JWT in localStorage, device known)
    │     GET /api/user-auth/me?deviceHash=xxx → {newDevice: false}
    │     Browse + select → "Place Order"
    │     → OrderConfirmModal immediately (no OTP)
    │
    ├── Returning user, NEW device (JWT in localStorage, device unknown)
    │     GET /api/user-auth/me?deviceHash=xxx → {newDevice: true}
    │     OTP flow runs once more
    │     → After OTP, device stored → OrderConfirmModal
    │
    └── JWT expired (180 days)
          localStorage.getItem returns token that verifies as invalid
          GET /api/user-auth/me → 401
          localStorage cleared
          → Full OTP flow

  OrderConfirmModal
    Shows: name, company, number, thali, sabji
    Warning: "No cancellation allowed"
    Buttons: "Go Back" | "Yes, Place Order"
      │
      POST /api/orders
        Validates: user active, menu published, before cutoff, no duplicate
        Creates: Order + OrderSabji rows
      │
      OrderSuccessScreen
        Shows confirmation + order summary
        Optional: link to /menu/orders to view history

  User visits /menu/orders
    Reads JWT from localStorage
    GET /api/orders?limit=50
    Shows paginated order history with status badges

CUTOFF TIME ENFORCEMENT
─────────────────────────────────────────────────────────────────
  Client-side: page detects cutoff passed → shows CutoffScreen
  Server-side: POST /api/orders checks cutoffTime → returns 400
  Both layers enforce it — no order can be placed after cutoff

FIREBASE OTP CONSTRAINTS
─────────────────────────────────────────────────────────────────
  - OTP only triggered client-side AFTER /api/user-auth/check-number confirms the number exists
  - RecaptchaVerifier (invisible) is initialized once per page load
  - Firebase enforces: max 5 OTPs per number per hour
  - Firebase enforces: max 10 OTP send attempts per IP per hour
  - No server-side OTP calls — only Firebase Admin verifyIdToken
  - Unnecessary OTPs are never sent because check-number gates the flow
```

---

## Implementation Order (Recommended)

Build in this exact sequence to avoid blockers:

1. **Schema + Migration** — Phase 1 first so all models exist
2. **Firebase Setup** — Phase 2, 3 env vars and lib files
3. **User Auth API routes** — Phase 3 (check-number, verify, me)
4. **Public menu page — skeleton** — Phase 4, hardcode user as null initially
5. **OTP Modal** — Phase 5 (connect to Firebase client)
6. **Order API** — Phase 7 (POST + GET /api/orders)
7. **Order Confirm Modal** — Phase 6
8. **Wire it all together** — Connect page state machine to OTP modal + confirm modal + order API
9. **User order history** — Phase 8
10. **Admin orders page** — Phase 9 (polling + status updates)
11. **Billing** — Phase 10 (API + admin page)
12. **Sidebar + proxy updates** — Phase 11, 12 (final wiring)
13. **Test end-to-end** — Full user journey on staging before production