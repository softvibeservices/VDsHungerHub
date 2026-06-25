# 🍱 VD's Hunger Hub — Admin Panel MVP Implementation Plan
> **Sprint Duration:** 10 Hours | **Stack:** TypeScript · Next.js 14 · Tailwind CSS · Prisma · Neon DB  
> **Business:** VD's Hunger Hub | **WhatsApp:** +91 63563 50086  
> **Scope:** Admin Panel Only (Staff & Customer panels deferred)

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Design System](#2-design-system)
3. [Environment Setup](#3-environment-setup)
4. [Database Schema (Prisma)](#4-database-schema-prisma)
5. [Seed Data](#5-seed-data)
6. [File & Folder Structure](#6-file--folder-structure)
7. [Authentication](#7-authentication)
8. [API Routes Reference](#8-api-routes-reference)
9. [Page-by-Page Implementation](#9-page-by-page-implementation)
10. [Reusable UI Components](#10-reusable-ui-components)
11. [10-Hour Timeline](#11-10-hour-timeline)
12. [Demo Checklist](#12-demo-checklist)

---

## 1. Project Overview

### What We're Building
A clean, professional Admin Panel for VD's Hunger Hub to replace the manual WhatsApp-group-based order management system. This MVP covers the master data management layer — the foundation before WhatsApp API and order processing are wired in.

### Admin Panel Modules (MVP Scope)

| # | Module | Core Actions |
|---|--------|-------------|
| 1 | Companies | Add, Edit, Delete, List (Name + Location) |
| 2 | Users | Add, Edit, Delete, Bulk Import (Name + Number + Company) |
| 3 | Products | Add, Edit, Toggle Active, List (Name + Qty + Price) |
| 4 | Thalis | Create dishes from products, set Sabji count + fixed items |
| 5 | Staff | Add, Edit, Toggle Active (Name + Number) |
| 6 | Daily Menu | Set date/meal, pick thalis, assign sabji options per thali |
| 7 | Dashboard | Overview stats and today's menu summary |

### Excluded from MVP
- WhatsApp Meta API integration
- Order placement / order history
- Billing and payment tracking
- Staff Panel (separate sprint)
- Customer/User Panel (separate sprint)
- Role-based permissions (deferred)

### Default Admin Credentials (Seeded)
```
Mobile : 6356350086
Password: VDAdmin@2024
```

---

## 2. Design System

### 2.1 Color Palette
```
Primary (Orange)    : #F97316   → Tailwind: orange-500
Primary Dark        : #EA580C   → Tailwind: orange-600
Sidebar BG          : #111827   → Tailwind: gray-900
Sidebar Active      : #1F2937   → Tailwind: gray-800
Sidebar Text        : #F9FAFB   → Tailwind: gray-50
Page Background     : #F3F4F6   → Tailwind: gray-100
Card Background     : #FFFFFF
Border Color        : #E5E7EB   → Tailwind: gray-200
Text Primary        : #111827   → Tailwind: gray-900
Text Secondary      : #6B7280   → Tailwind: gray-500
Success             : #10B981   → Tailwind: emerald-500
Error               : #EF4444   → Tailwind: red-500
Warning             : #F59E0B   → Tailwind: amber-500
```

### 2.2 Typography
```
Font Family  : Inter (Google Fonts - already in Tailwind)
Heading 1    : text-2xl font-bold text-gray-900
Heading 2    : text-xl font-semibold text-gray-900
Heading 3    : text-lg font-medium text-gray-800
Body         : text-sm text-gray-700
Caption      : text-xs text-gray-500
Label        : text-sm font-medium text-gray-700
```

### 2.3 Component Tokens

**Buttons:**
```
Primary   : bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg
Secondary : bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg
Danger    : bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg
Icon Btn  : p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700
```

**Cards:**
```
Base      : bg-white rounded-xl border border-gray-200 shadow-sm
```

**Inputs:**
```
Base      : w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
```

**Badges:**
```
Active    : bg-emerald-50 text-emerald-700 text-xs px-2 py-0.5 rounded-full
Inactive  : bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full
Lunch     : bg-amber-50 text-amber-700 text-xs px-2 py-0.5 rounded-full
Dinner    : bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full
```

### 2.4 Sidebar Layout
```
Width (desktop)  : 260px fixed left sidebar
Width (mobile)   : Drawer overlay, toggle via hamburger in header
Sidebar logo     : "VD's Hunger Hub" with orange accent icon
Nav items        : Icon + label, active state = orange-500 text + orange-50 bg
Footer           : Admin avatar + mobile number + logout button
```

---

## 3. Environment Setup

### 3.1 Create Next.js Project
```bash
# Create project
npx create-next-app@latest vd-hunger-hub \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"

cd vd-hunger-hub
```

### 3.2 Install Dependencies
```bash
# Core
npm install prisma @prisma/client

# Auth
npm install jsonwebtoken bcryptjs
npm install -D @types/jsonwebtoken @types/bcryptjs

# UI Utilities
npm install lucide-react
npm install react-hot-toast
npm install react-hook-form
npm install @hookform/resolvers zod

# CSV Parsing (for bulk user import)
npm install papaparse
npm install -D @types/papaparse

# Date utilities
npm install date-fns
```

### 3.3 Initialize Prisma
```bash
npx prisma init
```

### 3.4 Environment Variables
Create `.env.local`:
```env
# Neon DB Connection String (from neon.tech dashboard)
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"

# JWT Secret — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET="your_64_char_random_hex_secret_here"

# JWT Expiry
JWT_EXPIRES_IN="8h"

# App Config
NEXT_PUBLIC_APP_NAME="VD's Hunger Hub"
```

Create `.env.example` (commit this, NOT .env.local):
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
JWT_SECRET="your_jwt_secret_here"
JWT_EXPIRES_IN="8h"
NEXT_PUBLIC_APP_NAME="VD's Hunger Hub"
```

### 3.5 Tailwind Config Update
In `tailwind.config.ts`, ensure content array includes all paths:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

### 3.6 Global CSS (`app/globals.css`)
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  body {
    @apply font-sans bg-gray-100 text-gray-900 antialiased;
  }
  
  * {
    @apply box-border;
  }
}

@layer utilities {
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
}
```

---

## 4. Database Schema (Prisma)

### `prisma/schema.prisma` — Complete Schema
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DATABASE_URL")
}

// ─────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────
model Admin {
  id        String   @id @default(cuid())
  name      String
  number    String   @unique
  password  String   // bcrypt hashed
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─────────────────────────────────────────
// COMPANIES
// ─────────────────────────────────────────
model Company {
  id        String   @id @default(cuid())
  name      String   @unique
  location  String?
  isActive  Boolean  @default(true)
  users     User[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─────────────────────────────────────────
// USERS (Tiffin Customers)
// ─────────────────────────────────────────
model User {
  id        String   @id @default(cuid())
  name      String
  number    String   @unique   // WhatsApp number — used as PK for ordering
  company   Company  @relation(fields: [companyId], references: [id], onDelete: Restrict)
  companyId String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─────────────────────────────────────────
// PRODUCTS (Raw items — sabji, roti, dal, rice, etc.)
// ─────────────────────────────────────────
model Product {
  id                String                 @id @default(cuid())
  name              String                 @unique
  quantity          String                 // e.g. "4 pieces", "1 bowl", "250ml"
  price             Float                  // price per unit / per item
  isActive          Boolean                @default(true)
  thaliItems        ThaliItem[]
  dailySabjiOptions DailyMenuSabjiOption[]
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt
}

// ─────────────────────────────────────────
// THALIS (Meal combinations)
// ─────────────────────────────────────────
model Thali {
  id               String                 @id @default(cuid())
  name             String                 @unique  // e.g. "Small Gujarati Thali"
  price            Float
  description      String?                // Short description for reference
  maxSabjiCount    Int                    @default(1) // How many sabji user must choose
  isActive         Boolean                @default(true)
  items            ThaliItem[]            // Fixed items (roti, dal, rice, salad, etc.)
  dailyMenus       DailyMenuThali[]
  dailySabjiOpts   DailyMenuSabjiOption[]
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt
}

// Fixed components of a thali (non-sabji items)
model ThaliItem {
  id        String   @id @default(cuid())
  thali     Thali    @relation(fields: [thaliId], references: [id], onDelete: Cascade)
  thaliId   String
  itemName  String   // e.g. "4 Roti", "Dal", "Rice", "Salad", "Buttermilk"
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@unique([thaliId, itemName])
}

// ─────────────────────────────────────────
// STAFF
// ─────────────────────────────────────────
model Staff {
  id        String   @id @default(cuid())
  name      String
  number    String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─────────────────────────────────────────
// DAILY MENU
// ─────────────────────────────────────────
model DailyMenu {
  id           String                 @id @default(cuid())
  date         DateTime               @db.Date
  mealType     MealType
  cutoffTime   String?                // e.g. "11:30" — stored as HH:MM string
  isPublished  Boolean                @default(false)
  thalis       DailyMenuThali[]
  sabjiOptions DailyMenuSabjiOption[]
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt

  @@unique([date, mealType])
}

// Which thalis are available on a given daily menu
model DailyMenuThali {
  id      String    @id @default(cuid())
  menu    DailyMenu @relation(fields: [menuId], references: [id], onDelete: Cascade)
  menuId  String
  thali   Thali     @relation(fields: [thaliId], references: [id], onDelete: Restrict)
  thaliId String

  @@unique([menuId, thaliId])
}

// Which sabji options are available per thali per daily menu
model DailyMenuSabjiOption {
  id        String    @id @default(cuid())
  menu      DailyMenu @relation(fields: [menuId], references: [id], onDelete: Cascade)
  menuId    String
  thali     Thali     @relation(fields: [thaliId], references: [id], onDelete: Restrict)
  thaliId   String
  product   Product   @relation(fields: [productId], references: [id], onDelete: Restrict)
  productId String

  @@unique([menuId, thaliId, productId])
}

// ─────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────
enum MealType {
  LUNCH
  DINNER
}
```

### Run Migration
```bash
npx prisma migrate dev --name init
npx prisma generate
```

---

## 5. Seed Data

### `prisma/seed.ts`
```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Admin ──────────────────────────────────
  const hashedPassword = await bcrypt.hash("VDAdmin@2024", 12);
  await prisma.admin.upsert({
    where: { number: "6356350086" },
    update: {},
    create: {
      name: "VD Admin",
      number: "6356350086",
      password: hashedPassword,
    },
  });
  console.log("✅ Admin seeded");

  // ── Sample Companies ───────────────────────
  const companies = await Promise.all([
    prisma.company.upsert({
      where: { name: "TechCorp Pvt Ltd" },
      update: {},
      create: { name: "TechCorp Pvt Ltd", location: "Satellite, Ahmedabad" },
    }),
    prisma.company.upsert({
      where: { name: "Infosys BPO" },
      update: {},
      create: { name: "Infosys BPO", location: "SG Highway, Ahmedabad" },
    }),
    prisma.company.upsert({
      where: { name: "HDFC Bank Branch" },
      update: {},
      create: { name: "HDFC Bank Branch", location: "CG Road, Ahmedabad" },
    }),
  ]);
  console.log("✅ Companies seeded");

  // ── Sample Products (Sabji items) ─────────
  const products = await Promise.all([
    prisma.product.upsert({
      where: { name: "Corn Capsicum" },
      update: {},
      create: { name: "Corn Capsicum", quantity: "1 bowl", price: 30 },
    }),
    prisma.product.upsert({
      where: { name: "Rajma (Kathol)" },
      update: {},
      create: { name: "Rajma (Kathol)", quantity: "1 bowl", price: 30 },
    }),
    prisma.product.upsert({
      where: { name: "Sev Tameta" },
      update: {},
      create: { name: "Sev Tameta", quantity: "1 bowl", price: 25 },
    }),
    prisma.product.upsert({
      where: { name: "Palak Paneer" },
      update: {},
      create: { name: "Palak Paneer", quantity: "1 bowl", price: 50 },
    }),
    prisma.product.upsert({
      where: { name: "Mix Veg" },
      update: {},
      create: { name: "Mix Veg", quantity: "1 bowl", price: 30 },
    }),
    prisma.product.upsert({
      where: { name: "Aloo Gobi" },
      update: {},
      create: { name: "Aloo Gobi", quantity: "1 bowl", price: 25 },
    }),
    prisma.product.upsert({
      where: { name: "Paneer Butter Masala" },
      update: {},
      create: { name: "Paneer Butter Masala", quantity: "1 bowl", price: 60 },
    }),
    prisma.product.upsert({
      where: { name: "Dal Fry" },
      update: {},
      create: { name: "Dal Fry", quantity: "1 bowl", price: 20 },
    }),
  ]);
  console.log("✅ Products seeded");

  // ── Thalis ────────────────────────────────
  const thaliDefs = [
    {
      name: "Small Gujarati Thali",
      price: 80,
      maxSabjiCount: 1,
      description: "4 Roti, 1 Subji, Salad, Buttermilk",
      items: ["4 Roti", "Salad", "Buttermilk"],
    },
    {
      name: "Medium Gujarati Thali",
      price: 100,
      maxSabjiCount: 1,
      description: "4 Roti, 1 Subji, Dal, Rice, Salad, Buttermilk",
      items: ["4 Roti", "Dal", "Rice", "Salad", "Buttermilk"],
    },
    {
      name: "Full Gujarati Thali",
      price: 120,
      maxSabjiCount: 2,
      description: "5 Roti, 2 Subji, Dal, Rice, Salad, Buttermilk, Papad",
      items: ["5 Roti", "Dal", "Rice", "Salad", "Buttermilk", "Papad"],
    },
    {
      name: "Small Punjabi Thali",
      price: 100,
      maxSabjiCount: 1,
      description: "4 Roti, 1 Subji, Salad, Buttermilk",
      items: ["4 Roti", "Salad", "Buttermilk"],
    },
    {
      name: "Medium Punjabi Thali",
      price: 120,
      maxSabjiCount: 1,
      description: "4 Roti, 1 Subji, Dal Fry, Jeera Rice, Salad, Buttermilk",
      items: ["4 Roti", "Dal Fry", "Jeera Rice", "Salad", "Buttermilk"],
    },
    {
      name: "Full Punjabi Thali",
      price: 140,
      maxSabjiCount: 2,
      description:
        "5 Roti, 2 Subji, Dal Fry, Jeera Rice, Salad, Buttermilk, Papad",
      items: ["5 Roti", "Dal Fry", "Jeera Rice", "Salad", "Buttermilk", "Papad"],
    },
    {
      name: "Dal Fry Special",
      price: 80,
      maxSabjiCount: 0,
      description: "Dal Fry + Jeera Rice + Curd",
      items: ["Dal Fry", "Jeera Rice", "Curd"],
    },
    {
      name: "Rajma Special",
      price: 100,
      maxSabjiCount: 0,
      description: "Rajma + Jeera Rice + Curd",
      items: ["Rajma", "Jeera Rice", "Curd"],
    },
  ];

  for (const t of thaliDefs) {
    const existing = await prisma.thali.findUnique({ where: { name: t.name } });
    if (!existing) {
      await prisma.thali.create({
        data: {
          name: t.name,
          price: t.price,
          maxSabjiCount: t.maxSabjiCount,
          description: t.description,
          items: {
            create: t.items.map((itemName, idx) => ({
              itemName,
              sortOrder: idx,
            })),
          },
        },
      });
    }
  }
  console.log("✅ Thalis seeded");

  // ── Sample Users ──────────────────────────
  await prisma.user.upsert({
    where: { number: "9876543210" },
    update: {},
    create: {
      name: "Rahul Patel",
      number: "9876543210",
      companyId: companies[0].id,
    },
  });
  await prisma.user.upsert({
    where: { number: "9988776655" },
    update: {},
    create: {
      name: "Priya Shah",
      number: "9988776655",
      companyId: companies[0].id,
    },
  });
  console.log("✅ Sample users seeded");

  // ── Sample Staff ──────────────────────────
  await prisma.staff.upsert({
    where: { number: "9000000001" },
    update: {},
    create: { name: "Ramesh (Delivery)", number: "9000000001" },
  });
  await prisma.staff.upsert({
    where: { number: "9000000002" },
    update: {},
    create: { name: "Suresh (Kitchen)", number: "9000000002" },
  });
  console.log("✅ Staff seeded");

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Add seed script to `package.json`:
```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

### Run seed:
```bash
npm install -D ts-node
npx prisma db seed
```

---

## 6. File & Folder Structure

```
vd-hunger-hub/
│
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              ← Login page
│   │
│   ├── (admin)/
│   │   ├── layout.tsx                ← Admin shell: sidebar + header
│   │   ├── dashboard/
│   │   │   └── page.tsx              ← Stats overview
│   │   ├── companies/
│   │   │   └── page.tsx              ← Companies CRUD
│   │   ├── users/
│   │   │   └── page.tsx              ← Users CRUD + bulk import
│   │   ├── products/
│   │   │   └── page.tsx              ← Products CRUD
│   │   ├── thalis/
│   │   │   └── page.tsx              ← Thali CRUD
│   │   ├── staff/
│   │   │   └── page.tsx              ← Staff CRUD
│   │   └── menu/
│   │       └── page.tsx              ← Daily menu builder
│   │
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   └── logout/route.ts
│   │   ├── companies/
│   │   │   ├── route.ts              ← GET list, POST create
│   │   │   └── [id]/route.ts         ← GET one, PUT update, DELETE
│   │   ├── users/
│   │   │   ├── route.ts              ← GET list, POST create
│   │   │   ├── bulk/route.ts         ← POST bulk insert
│   │   │   └── [id]/route.ts         ← GET one, PUT update, DELETE
│   │   ├── products/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── thalis/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── staff/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── menu/
│   │   │   ├── route.ts              ← GET list, POST create
│   │   │   └── [id]/route.ts         ← GET one, PUT update, DELETE
│   │   └── dashboard/route.ts        ← GET stats
│   │
│   ├── globals.css
│   ├── layout.tsx                    ← Root layout (html + body)
│   └── page.tsx                      ← Redirect → /login
│
├── components/
│   ├── admin/
│   │   ├── Sidebar.tsx               ← Nav sidebar with logo + links
│   │   ├── Header.tsx                ← Top bar with page title + user menu
│   │   └── StatCard.tsx              ← Dashboard stat card
│   │
│   ├── modals/
│   │   ├── CompanyModal.tsx          ← Add/Edit company form
│   │   ├── UserModal.tsx             ← Add/Edit single user
│   │   ├── BulkUserModal.tsx         ← CSV upload + preview
│   │   ├── ProductModal.tsx          ← Add/Edit product
│   │   ├── ThaliModal.tsx            ← Add/Edit thali + items + sabji count
│   │   ├── StaffModal.tsx            ← Add/Edit staff
│   │   └── MenuSetupModal.tsx        ← Choose thalis + sabji for the day
│   │
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── Modal.tsx                 ← Base modal wrapper
│       ├── Table.tsx                 ← Base table with empty state
│       ├── Badge.tsx
│       ├── ConfirmDialog.tsx         ← Delete confirmation
│       ├── SearchInput.tsx
│       └── Loader.tsx
│
├── lib/
│   ├── prisma.ts                     ← Prisma client singleton
│   ├── auth.ts                       ← JWT sign/verify + cookie helpers
│   └── utils.ts                      ← Format number, date, error helpers
│
├── hooks/
│   ├── useToast.ts                   ← react-hot-toast wrapper
│   └── useDebounce.ts                ← Search debounce hook
│
├── types/
│   └── index.ts                      ← Shared TS types
│
├── middleware.ts                      ← Protect /admin routes
│
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
│
├── .env.local                        ← Never commit
├── .env.example                      ← Commit this
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 7. Authentication

### 7.1 Prisma Client Singleton — `lib/prisma.ts`
```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({ log: ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 7.2 Auth Helpers — `lib/auth.ts`
```typescript
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = "vd_admin_token";

export interface AdminTokenPayload {
  id: string;
  number: string;
  name: string;
}

export function signToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

export function verifyToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
  } catch {
    return null;
  }
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

export function setAuthCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60, // 8 hours in seconds
    path: "/",
  });
}

export function clearAuthCookie() {
  cookies().delete(COOKIE_NAME);
}

export function getAuthToken(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value;
}

export function getCurrentAdmin(): AdminTokenPayload | null {
  const token = getAuthToken();
  if (!token) return null;
  return verifyToken(token);
}
```

### 7.3 Middleware — `middleware.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Protect /admin and /api routes (except auth)
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/companies") ||
    pathname.startsWith("/users") ||
    pathname.startsWith("/products") ||
    pathname.startsWith("/thalis") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/menu") ||
    (pathname.startsWith("/api") && !pathname.startsWith("/api/auth"))
  ) {
    const token = request.cookies.get("vd_admin_token")?.value;

    if (!token || !verifyToken(token)) {
      if (pathname.startsWith("/api")) {
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
```

### 7.4 Login API — `app/api/auth/login/route.ts`
```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, setAuthCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { number, password } = await req.json();

    if (!number || !password) {
      return NextResponse.json(
        { error: "Mobile number and password are required" },
        { status: 400 }
      );
    }

    const admin = await prisma.admin.findUnique({
      where: { number: number.replace(/\s+/g, "").replace("+91", "") },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(password, admin.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = signToken({ id: admin.id, number: admin.number, name: admin.name });
    setAuthCookie(token);

    return NextResponse.json({
      success: true,
      admin: { id: admin.id, name: admin.name, number: admin.number },
    });
  } catch (error) {
    console.error("[LOGIN ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### 7.5 Logout API — `app/api/auth/logout/route.ts`
```typescript
import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth";

export async function POST() {
  clearAuthCookie();
  return NextResponse.json({ success: true });
}
```

---

## 8. API Routes Reference

### Auth
| Method | Route | Body | Response |
|--------|-------|------|----------|
| POST | `/api/auth/login` | `{ number, password }` | `{ success, admin }` |
| POST | `/api/auth/logout` | — | `{ success }` |

### Companies
| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| GET | `/api/companies` | `?search=&page=&limit=` | `{ companies[], total }` |
| POST | `/api/companies` | `{ name, location? }` | `{ company }` |
| GET | `/api/companies/[id]` | — | `{ company }` |
| PUT | `/api/companies/[id]` | `{ name, location?, isActive }` | `{ company }` |
| DELETE | `/api/companies/[id]` | — | `{ success }` |

### Users
| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| GET | `/api/users` | `?search=&companyId=&page=&limit=` | `{ users[], total }` |
| POST | `/api/users` | `{ name, number, companyId }` | `{ user }` |
| POST | `/api/users/bulk` | `{ users: [{name,number,companyId}] }` | `{ created, skipped, errors[] }` |
| PUT | `/api/users/[id]` | `{ name, number, companyId, isActive }` | `{ user }` |
| DELETE | `/api/users/[id]` | — | `{ success }` |

### Products
| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| GET | `/api/products` | `?search=&isActive=` | `{ products[] }` |
| POST | `/api/products` | `{ name, quantity, price }` | `{ product }` |
| PUT | `/api/products/[id]` | `{ name, quantity, price, isActive }` | `{ product }` |
| DELETE | `/api/products/[id]` | — | `{ success }` |

### Thalis
| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| GET | `/api/thalis` | `?isActive=` | `{ thalis[] }` with items |
| POST | `/api/thalis` | `{ name, price, description?, maxSabjiCount, items: string[] }` | `{ thali }` |
| PUT | `/api/thalis/[id]` | `{ name, price, description?, maxSabjiCount, items, isActive }` | `{ thali }` |
| DELETE | `/api/thalis/[id]` | — | `{ success }` |

### Staff
| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| GET | `/api/staff` | `?search=&isActive=` | `{ staff[] }` |
| POST | `/api/staff` | `{ name, number }` | `{ staff }` |
| PUT | `/api/staff/[id]` | `{ name, number, isActive }` | `{ staff }` |
| DELETE | `/api/staff/[id]` | — | `{ success }` |

### Daily Menu
| Method | Route | Body / Query | Response |
|--------|-------|-------------|----------|
| GET | `/api/menu` | `?date=YYYY-MM-DD&mealType=` | `{ menus[] }` |
| POST | `/api/menu` | `{ date, mealType, cutoffTime?, thaliIds[], sabjiOptions: {thaliId, productIds[]}[] }` | `{ menu }` |
| PUT | `/api/menu/[id]` | Same as POST body + `isPublished` | `{ menu }` |
| DELETE | `/api/menu/[id]` | — | `{ success }` |

### Dashboard
| Method | Route | Response |
|--------|-------|----------|
| GET | `/api/dashboard` | `{ stats: { companies, users, products, thalis, staff, todayMenus } }` |

---

## 9. Page-by-Page Implementation

---

### 9.1 Root Page — `app/page.tsx`
```typescript
import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/auth";

export default function RootPage() {
  const admin = getCurrentAdmin();
  if (admin) redirect("/dashboard");
  else redirect("/login");
}
```

### 9.2 Root Layout — `app/layout.tsx`
```typescript
import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "VD's Hunger Hub – Admin",
  description: "Admin panel for VD's Hunger Hub tiffin service",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { background: "#111827", color: "#fff", fontSize: "14px" },
            success: { iconTheme: { primary: "#10B981", secondary: "#fff" } },
            error: { iconTheme: { primary: "#EF4444", secondary: "#fff" } },
          }}
        />
      </body>
    </html>
  );
}
```

---

### 9.3 Login Page — `app/(auth)/login/page.tsx`

**UI Elements:**
- Centered card layout with brand logo/name
- "VD's Hunger Hub" header in orange
- Mobile Number field (with +91 prefix shown)
- Password field (with show/hide toggle)
- "Sign In" button (orange, full width)
- Error message inline
- No "Forgot Password" link in MVP

**Key Logic:**
```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

// POST to /api/auth/login
// On success → redirect to /dashboard
// On error → show inline error message
```

**Visual Layout:**
```
┌─────────────────────────────────────────┐
│         🍱 VD's Hunger Hub             │
│                                         │
│   Admin Panel Login                     │
│                                         │
│   Mobile Number                         │
│   [+91  ___________________________]    │
│                                         │
│   Password                              │
│   [_________________________ 👁]        │
│                                         │
│   [         Sign In         ]           │  ← orange button
│                                         │
│   © 2024 VD's Hunger Hub               │
└─────────────────────────────────────────┘
         (gray-100 background)
```

---

### 9.4 Admin Layout — `app/(admin)/layout.tsx`

**Structure:**
```typescript
"use client";
// State: sidebarOpen (for mobile drawer)
// Renders: <Sidebar> + <div>(Header + main content)</div>
// On mobile: sidebar is a fixed overlay with backdrop blur
// On desktop: sidebar is always visible on left
```

**Visual Layout (Desktop):**
```
┌─────────────┬────────────────────────────────────────────┐
│  SIDEBAR    │  HEADER  (breadcrumb + user menu)          │
│  260px      ├────────────────────────────────────────────┤
│             │                                            │
│  🍱 VD's   │         PAGE CONTENT (children)            │
│  Hunger     │                                            │
│  Hub        │                                            │
│             │                                            │
│  Dashboard  │                                            │
│  Companies  │                                            │
│  Users      │                                            │
│  Products   │                                            │
│  Thalis     │                                            │
│  Staff      │                                            │
│  Menu       │                                            │
│             │                                            │
│  [logout]   │                                            │
└─────────────┴────────────────────────────────────────────┘
```

---

### 9.5 Sidebar Component — `components/admin/Sidebar.tsx`

```typescript
// Nav items array:
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/companies",  icon: Building2,       label: "Companies" },
  { href: "/users",      icon: Users,           label: "Users" },
  { href: "/products",   icon: ShoppingBasket,  label: "Products" },
  { href: "/thalis",     icon: UtensilsCrossed, label: "Thalis" },
  { href: "/staff",      icon: UserCheck,       label: "Staff" },
  { href: "/menu",       icon: CalendarDays,    label: "Daily Menu" },
];

// Active state: usePathname() → compare href
// Mobile: receives isOpen + onClose props
// Logo area: 🍱 icon + "VD's Hunger Hub" text (orange)
// Footer: Admin number + Logout button
```

---

### 9.6 Dashboard Page — `app/(admin)/dashboard/page.tsx`

**Data Fetched on Mount:**
- GET `/api/dashboard` → stats object

**UI Elements:**
- Page title: "Dashboard"
- Stats grid (2 cols mobile, 3 cols tablet, 4 cols desktop):

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Companies │ │  Users   │ │Products  │ │  Thalis  │
│   15     │ │   160    │ │   12     │ │    8     │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
┌──────────┐ ┌──────────┐
│  Staff   │ │ Today's  │
│    4     │ │  Menus   │
│          │ │  Lunch ✓ │
└──────────┘ └──────────┘
```

- Today's Menu Summary section: shows lunch and dinner menus for today
- Quick action buttons: "Set Today's Menu", "Add User", "Add Company"

---

### 9.7 Companies Page — `app/(admin)/companies/page.tsx`

**State:**
- companies list, search term, modal open/close, selected company (for edit), confirm delete

**UI Layout:**
```
Companies                            [+ Add Company]

🔍 Search companies...

┌──────────────────────────────────────────────────────────┐
│  Name              Location          Status    Actions   │
├──────────────────────────────────────────────────────────┤
│  TechCorp Pvt Ltd  Satellite, Ahmd   Active   ✏️  🗑️   │
│  Infosys BPO       SG Highway, Ahmd  Active   ✏️  🗑️   │
│  HDFC Bank Branch  CG Road, Ahmd     Active   ✏️  🗑️   │
└──────────────────────────────────────────────────────────┘

Showing 3 of 3 companies
```

**CompanyModal Fields:**
```
Company Name *  [________________________]
Location        [________________________]  (optional)
```

**Validation (Zod schema):**
```typescript
const companySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  location: z.string().optional(),
});
```

---

### 9.8 Users Page — `app/(admin)/users/page.tsx`

**State:**
- users list, search, selected company filter, pagination (10/page), modals

**UI Layout:**
```
Users                    [+ Add User]  [⬆ Bulk Import]

🔍 Search...   [Filter by Company ▾]

┌─────────────────────────────────────────────────────────────────┐
│  Name           Mobile        Company         Status   Actions  │
├─────────────────────────────────────────────────────────────────┤
│  Rahul Patel    9876543210    TechCorp Pvt..  Active   ✏️  🗑️  │
│  Priya Shah     9988776655    TechCorp Pvt..  Active   ✏️  🗑️  │
└─────────────────────────────────────────────────────────────────┘

Showing 2 of 2 users     < 1 >
```

**UserModal Fields:**
```
Full Name *       [________________________]
Mobile Number *   [________________________]  (unique, 10 digits)
Company *         [Select Company         ▾]
```

**BulkUserModal — Two steps:**

Step 1 — Upload/Paste:
```
Bulk Import Users
─────────────────────────────────────────────────
Format: CSV with columns: name, number, company_name
─────────────────────────────────────────────────
  [Download Template]

  Paste CSV data below or [Upload .csv file]
  
  ┌──────────────────────────────────────┐
  │ name,number,company_name             │
  │ Rahul Patel,9876543210,TechCorp     │
  │ Priya Shah,9988776655,Infosys BPO  │
  └──────────────────────────────────────┘

  [Preview & Validate →]
```

Step 2 — Preview:
```
Review Import (3 users)
─────────────────────────────────────────────
  ✅ Rahul Patel — 9876543210 — TechCorp
  ✅ Priya Shah  — 9988776655 — Infosys BPO
  ❌ Invalid No. — 12345      — HDFC Bank  ← Error shown in red
─────────────────────────────────────────────
  Valid: 2  |  Errors: 1

  [← Back]  [Import 2 Valid Users]
```

**Bulk Validation Rules:**
- number: exactly 10 digits, only numbers
- company_name: must match an existing company (case-insensitive)
- name: non-empty
- Duplicate numbers in DB → skip with error

---

### 9.9 Products Page — `app/(admin)/products/page.tsx`

**UI Layout:**
```
Products                             [+ Add Product]

🔍 Search products...   [All ▾ / Active / Inactive]

┌──────────────────────────────────────────────────────────────┐
│  #  Name              Quantity      Price     Status  Actions │
├──────────────────────────────────────────────────────────────┤
│  1  Corn Capsicum     1 bowl        ₹30       Active  ✏️  🗑️ │
│  2  Rajma (Kathol)    1 bowl        ₹30       Active  ✏️  🗑️ │
│  3  Palak Paneer      1 bowl        ₹50       Active  ✏️  🗑️ │
└──────────────────────────────────────────────────────────────┘
```

**ProductModal Fields:**
```
Item Name *    [________________________]  e.g. Palak Paneer
Quantity *     [________________________]  e.g. 1 bowl, 250ml
Price (₹) *    [________________________]  numeric
```

**Note for UI:** Add a helper text: "Products are the individual items (sabji options, dal, roti etc.) used to build thalis."

---

### 9.10 Thalis Page — `app/(admin)/thalis/page.tsx`

**UI Layout:**
```
Thalis                                [+ Add Thali]

┌──────────────────────────────────────────────────────────────────────┐
│  Name                    Price   Sabji  Items                 Status │
├──────────────────────────────────────────────────────────────────────┤
│  Small Gujarati Thali    ₹80     1      4 Roti, Salad, …     Active │
│  Full Gujarati Thali     ₹120    2      5 Roti, Dal, Rice, … Active │
│  Dal Fry Special         ₹80     0      Dal Fry, Jeera Rice  Active │
└──────────────────────────────────────────────────────────────────────┘
```

**ThaliModal — Sections:**

```
Add / Edit Thali
══════════════════════════════════════════════════
Thali Name *         [_______________________]
Price (₹) *          [_______________________]
Description          [_______________________]  (optional)
Max Sabji Choice *   [1 ▾]  ← 0 = no choice, 1 or 2

── Fixed Items ───────────────────────────────
These items are always included (roti, dal, rice, salad, etc.)

  [4 Roti      ] [Remove]
  [Dal         ] [Remove]
  [Rice        ] [Remove]
  [Salad       ] [Remove]
  [+ Add Item  ]   ← text input + Add button

══════════════════════════════════════════════════
Note: Sabji options are set daily via the Menu section.
══════════════════════════════════════════════════

[Cancel]                          [Save Thali]
```

**Validation:**
- name: required, unique
- price: positive number
- maxSabjiCount: 0, 1, or 2
- items: array, minimum 1 item

---

### 9.11 Staff Page — `app/(admin)/staff/page.tsx`

**UI Layout:**
```
Staff                               [+ Add Staff]

🔍 Search staff...

┌──────────────────────────────────────────────────────────┐
│  #   Name                  Mobile       Status   Actions  │
├──────────────────────────────────────────────────────────┤
│  1   Ramesh (Delivery)     9000000001   Active   ✏️  🗑️  │
│  2   Suresh (Kitchen)      9000000002   Active   ✏️  🗑️  │
└──────────────────────────────────────────────────────────┘
```

**StaffModal Fields:**
```
Full Name *       [________________________]
Mobile Number *   [________________________]
```

---

### 9.12 Daily Menu Page — `app/(admin)/menu/page.tsx`

This is the most complex page in the MVP. It allows the admin to configure the daily menu.

**UI Layout:**
```
Daily Menu                              [+ Set Menu]

  Date Navigation:
  [← Prev]   📅 Today — 26 Dec 2024   [Next →]

  ┌─────────────────────────┐  ┌─────────────────────────┐
  │  🌅 LUNCH               │  │  🌙 DINNER              │
  │  Cutoff: 11:30 AM       │  │  Cutoff: 6:30 PM        │
  │                         │  │                         │
  │  Gujarati Thalis:       │  │  Published ✅           │
  │  • Small Gujarati ₹80  │  │                         │
  │    Sabji: Corn Cap,     │  │  Thalis: ...            │
  │           Rajma         │  │                         │
  │  • Full Gujarati ₹120  │  │  [Edit] [Delete]        │
  │    Sabji: Sev Tameta,   │  │                         │
  │           Mix Veg,      │  └─────────────────────────┘
  │           Aloo Gobi     │
  │                         │
  │  Punjabi Thalis:        │
  │  • Medium Punjabi ₹120 │
  │    Sabji: Palak Paneer  │
  │                         │
  │  [Edit] [Delete]        │
  └─────────────────────────┘
```

**MenuSetupModal — Step-by-step Wizard:**

```
Step 1 of 3: Basic Info
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Date *          [26 December 2024]
Meal Type *     ○ Lunch    ● Dinner
Cutoff Time *   [11:30]  (HH:MM format)
                
[Cancel]              [Next: Select Thalis →]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 2 of 3: Select Thalis for Today
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
☑ Small Gujarati Thali    ₹80    (1 sabji)
☑ Medium Gujarati Thali   ₹100   (1 sabji)
☑ Full Gujarati Thali     ₹120   (2 sabji)
☑ Small Punjabi Thali     ₹100   (1 sabji)
□ Medium Punjabi Thali    ₹120   (1 sabji)
□ Full Punjabi Thali      ₹140   (2 sabji)
□ Dal Fry Special         ₹80    (no sabji choice)
□ Rajma Special           ₹100   (no sabji choice)
                
[← Back]              [Next: Set Sabji Options →]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 3 of 3: Set Today's Sabji Options
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For each thali with sabji count > 0, select available options.
Users will choose from these options when ordering.

┌─────────────────────────────────────────┐
│ 🍽 Gujarati Thalis (must pick ≥2 options│
│    since Full Thali needs 2 choices)    │
│                                         │
│  ☑ Corn Capsicum                       │
│  ☑ Rajma (Kathol)                      │
│  ☑ Sev Tameta                          │
│  □ Palak Paneer                        │
│  □ Mix Veg                             │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🍽 Punjabi Thalis                       │
│                                         │
│  □ Corn Capsicum                       │
│  ☑ Palak Paneer                        │
│  ☑ Mix Veg                             │
│  □ Sev Tameta                          │
└─────────────────────────────────────────┘

[← Back]                    [💾 Save Menu]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Implementation Note for Thali Grouping:**
- In Step 3, group Gujarati and Punjabi thalis together since they typically share sabji options
- Alternatively, allow the admin to set sabji options per thali individually
- For MVP: group by thali type (detect "Gujarati" / "Punjabi" in thali name as simple approach)
- Better approach: one sabji option block per selected thali (simpler to implement correctly)

**API Call for Menu POST:**
```typescript
{
  date: "2024-12-26",
  mealType: "LUNCH",
  cutoffTime: "11:30",
  thaliIds: ["thali_id_1", "thali_id_2", "thali_id_3"],
  sabjiOptions: [
    { thaliId: "thali_id_1", productIds: ["prod_id_1", "prod_id_2", "prod_id_3"] },
    { thaliId: "thali_id_2", productIds: ["prod_id_1", "prod_id_2", "prod_id_3"] },
    // Thali with maxSabjiCount=0 → empty productIds array
  ]
}
```

---

## 10. Reusable UI Components

### `components/ui/Modal.tsx`
```typescript
// Props: isOpen, onClose, title, children, size ('sm'|'md'|'lg'|'xl')
// Features:
// - Backdrop click to close
// - Escape key to close
// - Focus trap for accessibility
// - Smooth slide-up animation
// - Scrollable body for long content
// - Fixed header with title + X button
// - Fixed footer (if footerContent prop provided)
```

### `components/ui/Table.tsx`
```typescript
// Props: columns, data, isLoading, emptyMessage
// Features:
// - Loading skeleton (3 rows of shimmer)
// - Empty state with icon + message + optional CTA
// - Hover rows
// - Responsive: horizontal scroll on mobile
// - Consistent cell padding and font sizes
```

### `components/ui/ConfirmDialog.tsx`
```typescript
// Props: isOpen, onClose, onConfirm, title, message, confirmLabel, isLoading
// Used for all delete confirmations
// Red confirm button with loading state
```

### `components/ui/SearchInput.tsx`
```typescript
// Props: value, onChange, placeholder
// Features: debounced onChange (300ms), search icon, clear button
```

### `components/ui/Button.tsx`
```typescript
// Variants: primary | secondary | danger | ghost
// Sizes: sm | md | lg
// Props: isLoading (shows spinner), leftIcon, rightIcon, disabled
```

### `components/ui/Badge.tsx`
```typescript
// Variants: success (Active), gray (Inactive), amber (Lunch), indigo (Dinner)
```

### `lib/utils.ts`
```typescript
// formatMobileNumber(num: string): string
//   "6356350086" → "+91 63563 50086"

// formatCurrency(amount: number): string
//   80 → "₹80"

// formatDate(date: Date | string): string
//   Date → "26 Dec 2024"

// getMealTypeLabel(type: string): string
//   "LUNCH" → "Lunch"

// cn(...classes: string[]): string
//   Tailwind class merge utility (like clsx + tailwind-merge)
```

---

## 11. 10-Hour Timeline

```
HOUR 1  (0:00 – 1:00)  ► PROJECT SETUP
────────────────────────────────────────────
□ npx create-next-app → project created
□ npm install all dependencies
□ Create Neon DB project → copy connection string
□ Set up .env.local
□ npx prisma init → update schema.prisma
□ Update tailwind.config.ts and globals.css
□ Verify dev server runs: npm run dev

HOUR 2  (1:00 – 2:00)  ► DATABASE + SEED
────────────────────────────────────────────
□ Write full prisma/schema.prisma (as in Section 4)
□ npx prisma migrate dev --name init
□ npx prisma generate
□ Write prisma/seed.ts (as in Section 5)
□ npx prisma db seed
□ Verify seed in Neon DB console or Prisma Studio

HOUR 3  (2:00 – 3:00)  ► AUTH + LAYOUT
────────────────────────────────────────────
□ Write lib/prisma.ts
□ Write lib/auth.ts (JWT helpers)
□ Write middleware.ts
□ Write app/api/auth/login/route.ts
□ Write app/api/auth/logout/route.ts
□ Write app/(auth)/login/page.tsx (full UI + logic)
□ Write app/(admin)/layout.tsx (shell with sidebar)
□ Write components/admin/Sidebar.tsx
□ Write components/admin/Header.tsx
□ Test login → redirects to /dashboard (empty for now)

HOUR 4  (3:00 – 4:00)  ► COMPANIES MODULE
────────────────────────────────────────────
□ Write app/api/companies/route.ts (GET, POST)
□ Write app/api/companies/[id]/route.ts (PUT, DELETE)
□ Write components/ui/Modal.tsx (reusable base)
□ Write components/ui/ConfirmDialog.tsx
□ Write components/ui/Button.tsx
□ Write components/ui/Input.tsx
□ Write components/ui/Table.tsx
□ Write components/modals/CompanyModal.tsx
□ Write app/(admin)/companies/page.tsx
□ Test: Add, Edit, Delete company

HOUR 5  (4:00 – 5:00)  ► USERS MODULE
────────────────────────────────────────────
□ Write app/api/users/route.ts (GET, POST)
□ Write app/api/users/bulk/route.ts (POST)
□ Write app/api/users/[id]/route.ts (PUT, DELETE)
□ Write components/ui/Select.tsx
□ Write components/ui/SearchInput.tsx
□ Write components/modals/UserModal.tsx
□ Write components/modals/BulkUserModal.tsx (CSV parser)
□ Write app/(admin)/users/page.tsx
□ Test: Add user, edit, delete, bulk import with CSV

HOUR 6  (5:00 – 6:00)  ► PRODUCTS MODULE
────────────────────────────────────────────
□ Write app/api/products/route.ts
□ Write app/api/products/[id]/route.ts
□ Write components/modals/ProductModal.tsx
□ Write app/(admin)/products/page.tsx
□ Test: CRUD + active/inactive toggle

HOUR 7  (6:00 – 7:00)  ► THALIS MODULE
────────────────────────────────────────────
□ Write app/api/thalis/route.ts
□ Write app/api/thalis/[id]/route.ts (cascade delete items)
□ Write components/modals/ThaliModal.tsx
□   → Dynamic item list (add/remove text rows)
□   → Sabji count selector (0, 1, 2)
□ Write app/(admin)/thalis/page.tsx
□ Test: Create thali with items, edit, delete

HOUR 8  (7:00 – 8:00)  ► STAFF MODULE
────────────────────────────────────────────
□ Write app/api/staff/route.ts
□ Write app/api/staff/[id]/route.ts
□ Write components/modals/StaffModal.tsx
□ Write app/(admin)/staff/page.tsx
□ Test: Add, edit, toggle active, delete

HOUR 9  (8:00 – 9:00)  ► DAILY MENU MODULE
────────────────────────────────────────────
□ Write app/api/menu/route.ts (GET by date, POST)
□ Write app/api/menu/[id]/route.ts (PUT, DELETE)
□ Write components/modals/MenuSetupModal.tsx
□   → Step 1: Date + MealType + Cutoff time
□   → Step 2: Multi-select thalis (checkbox list)
□   → Step 3: Per-thali sabji option selector
□ Write app/(admin)/menu/page.tsx
□   → Date navigation (prev/next day)
□   → Lunch + Dinner cards side by side
□ Test: Set menu for today (lunch + dinner), view it

HOUR 10  (9:00 – 10:00)  ► DASHBOARD + POLISH
────────────────────────────────────────────
□ Write app/api/dashboard/route.ts (stats query)
□ Write components/admin/StatCard.tsx
□ Write app/(admin)/dashboard/page.tsx
□ Mobile responsiveness fixes:
□   → Sidebar drawer toggle (hamburger in header)
□   → Responsive table → horizontal scroll
□   → Modal full-screen on mobile
□   → Stack cards to 1-col on small screens
□ Write lib/utils.ts (helpers)
□ Add Badge component
□ Add Loader/skeleton components
□ Fix any bugs from testing
□ Final run-through of complete flow

TOTAL: 10 Hours
```

---

## 12. Demo Checklist

Before the demo, verify every item below works end-to-end:

### Auth
- [ ] Can log in with `6356350086` / `VDAdmin@2024`
- [ ] Redirected to `/dashboard` after login
- [ ] Visiting `/dashboard` without login redirects to `/login`
- [ ] Logout works and clears session

### Dashboard
- [ ] Stats show correct counts for companies, users, products, thalis, staff
- [ ] Today's lunch/dinner menu shown (if set)

### Companies
- [ ] Can add a new company (name required)
- [ ] Can edit company name and location
- [ ] Can delete company (that has no users)
- [ ] Deleting company with users shows error message (not allowed)
- [ ] Search filters companies by name

### Users
- [ ] Can add a single user with name, number, company
- [ ] Cannot add duplicate mobile number (shows error)
- [ ] Company dropdown only shows existing companies
- [ ] Can bulk import users via CSV (download template, paste/upload, preview, import)
- [ ] Bulk import shows which rows are valid and which have errors
- [ ] Can filter users by company
- [ ] Can search users by name or number

### Products
- [ ] Can add product (name, quantity, price)
- [ ] Can edit product details
- [ ] Can toggle active/inactive

### Thalis
- [ ] Can create a thali with name, price, description, maxSabjiCount
- [ ] Can add/remove fixed items in thali
- [ ] Can edit thali
- [ ] Thali list shows items as a comma-separated preview
- [ ] maxSabjiCount 0 = "No choice", 1 = "Pick 1", 2 = "Pick 2" label shown

### Staff
- [ ] Can add staff with name and number
- [ ] Can edit staff info
- [ ] Can toggle active/inactive

### Daily Menu
- [ ] Can set a Lunch menu for today with thalis + sabji options
- [ ] Can set a Dinner menu for today
- [ ] Date navigation (prev/next day) works
- [ ] Can edit an existing menu
- [ ] Can delete a menu

### Responsive / UX
- [ ] Sidebar collapses to drawer on mobile
- [ ] Tables scroll horizontally on mobile
- [ ] Modals are full-screen on mobile
- [ ] Toast notifications appear for all success/error actions
- [ ] Delete confirmation dialog appears before any deletion
- [ ] Loading states shown during API calls
- [ ] Empty states shown when lists are empty

---

## 13. Key Implementation Notes

### Number Field Handling
Always strip spaces and country codes when storing:
```typescript
const cleanNumber = number.replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");
// Store as 10-digit string
```

### API Error Responses Pattern
All API routes should return consistent error format:
```typescript
{ error: "Human-readable message" }   // 4xx errors
{ success: true, data: {...} }         // 2xx success
```

### Prisma Relation Cascade Rules
- Deleting a Company → BLOCKED if it has Users (Restrict)
- Deleting a Thali → BLOCKED if it's in active DailyMenus (Restrict)
- Deleting a DailyMenu → CASCADE deletes DailyMenuThali + DailyMenuSabjiOption
- Deleting a Product → BLOCKED if it's in active DailyMenuSabjiOption

### Daily Menu Uniqueness
The `@@unique([date, mealType])` constraint on DailyMenu means:
- Only one LUNCH menu per date
- Only one DINNER menu per date
- Editing a menu = PUT to existing record (don't POST a new one)

### Sabji Options Logic in MenuSetupModal
When admin selects thalis in Step 2, Step 3 should only show product selection for thalis where `maxSabjiCount > 0`. Group them logically:
```typescript
const thalisNeedingSabji = selectedThalis.filter(t => t.maxSabjiCount > 0);
const thalisNoSabji = selectedThalis.filter(t => t.maxSabjiCount === 0);
// Show info for thalisNoSabji: "These thalis have fixed items only"
```

### Bulk User Import CSV Template
```csv
name,number,company_name
Rahul Patel,9876543210,TechCorp Pvt Ltd
Priya Shah,9988776655,Infosys BPO
```
Parse with PapaParse, validate each row, match company_name to DB (case-insensitive).

### Prisma Studio (for debugging during dev)
```bash
npx prisma studio
# Opens at http://localhost:5555 — visual DB browser
```

---

## 14. Post-MVP Roadmap

Once the Admin Panel is working, here's what comes next:

| Phase | Module | Description |
|-------|--------|-------------|
| Phase 2 | WhatsApp API | Meta Cloud API webhook — read messages from company groups |
| Phase 2 | Order Parser | Parse incoming messages → extract thali + sabji choices |
| Phase 3 | Staff Panel | View company-wise order lists, mark delivered |
| Phase 3 | Customer Panel | Self-order via web link (no WhatsApp needed) |
| Phase 4 | Billing Module | Per-user monthly bill auto-calculation |
| Phase 4 | Reports | Daily/weekly/monthly order reports with export |
| Phase 5 | Notifications | WhatsApp outbound for menu announcements + order confirmation |

---

*Document version: 1.0 | Generated for VD's Hunger Hub MVP Sprint*
*Stack: Next.js 14 · TypeScript · Tailwind CSS · Prisma · Neon (PostgreSQL)*