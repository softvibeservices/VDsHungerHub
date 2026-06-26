# TiffinOS Admin Dashboard — V2 Full Implementation Plan

> **Project:** VD's Hunger Hub (`softvibeservices-vdshungerhub`)
> **Stack:** Next.js 16 · Prisma (PostgreSQL) · Tailwind CSS v4 · React 19
> **Prepared for:** Nikulsinh @ SoftVibe Services
> **Scope:** Full admin dashboard overhaul — bugs, UX, architecture, and speed

---

## Table of Contents

1. [Root Cause Analysis — What is Actually Broken](#1-root-cause-analysis)
2. [Phase 0 — Bug Fixes (Day 1, ~3–4 hrs)](#2-phase-0--bug-fixes)
3. [Phase 1 — Schema & DB Migration (Day 1, ~1 hr)](#3-phase-1--schema--db-migration)
4. [Phase 2 — Catalog Hub Page: Products + Thalis + Staff Tabs (Day 2, ~5 hrs)](#4-phase-2--catalog-hub-page)
5. [Phase 3 — Daily Menu V2: Complete Overhaul (Day 3–4, ~8–10 hrs)](#5-phase-3--daily-menu-v2)
6. [Phase 4 — Public Menu URL + Order Flow Foundation (Day 5, ~4 hrs)](#6-phase-4--public-menu-url)
7. [Phase 5 — Bulk Upload Audit & Fix (Day 5, ~2 hrs)](#7-phase-5--bulk-upload-audit)
8. [Phase 6 — Admin Speed Research: What Makes Dashboards Fast](#8-phase-6--admin-speed-research)
9. [Phase 7 — Sidebar Cleanup + Navigation Polish (Day 6, ~2 hrs)](#9-phase-7--sidebar-cleanup)
10. [File-by-File Change Index](#10-file-by-file-change-index)
11. [Prisma Migration SQL Reference](#11-prisma-migration-sql-reference)

---

## 1. Root Cause Analysis

### 1.1 Products — Status Toggle Broken

**Root cause identified in code:**

```ts
// products/[id]/route.ts — Line 3780
const { name, quantity, price, isActive } = await req.json();

if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
if (!quantity?.trim()) return NextResponse.json({ error: "Quantity is required" }, { status: 400 });
```

The `PUT` route **validates `name` and `quantity` even when the caller only wants to toggle `isActive`**. The frontend toggle (`handleToggle`) spreads the full product object:

```ts
body: JSON.stringify({ ...product, isActive: !product.isActive })
```

This should work — but if somehow `name` or `quantity` is `undefined` on the product object in state (e.g. stale fetch), the API returns 400. Also there's no dedicated `PATCH /api/products/:id/toggle` route, so a full PUT is sent for a simple boolean flip.

**Fix:** Add a `PATCH` handler to `api/products/[id]/route.ts` that only updates `isActive` — no name/quantity required. Same fix for Thalis and Staff (which have the same structural pattern).

---

### 1.2 Products — No Gujarati Name Field

Current `Product` model:
```prisma
model Product {
  id        String  @id
  name      String  @unique   // only English
  quantity  String
  price     Float
  isActive  Boolean
}
```

**Fix:** Add `nameGu String?` (Gujarati name, nullable for backward compatibility). Same for `Thali` — add `nameGu String?`. UI forms must show both fields.

---

### 1.3 Thali — maxSabji Must Come from Products, Max 3

Currently `maxSabjiCount` is a free integer input in `ThaliModal`. The requirement is:
- Max sabji count capped at **3**
- The sabji items selected at menu time must come from the **Products** list

The products list is already the source for sabji at menu time — this part is fine. The **only missing piece** is:
1. Cap `maxSabjiCount` to `min(3)` in the form and API validation
2. Make the `ThaliModal` load `Products` and let admin **select which products are eligible sabji** for that thali — stored as a new `ThaliSabjiProduct` join table

Actually re-reading the requirement: "MAX SABJI SHOULD BE UPTO 3 FIXED ITEMS, WILL COME FROM THE PRODUCTS, IN THE ADDITION OF THE THALI OTHERWISE DON'T ALLOW" — this means:
- When creating a thali, the admin picks up to 3 products as the **allowed sabji pool** for that thali
- At daily menu time, only those pre-approved products can be added as sabji options

This requires a new schema join table: `ThaliSabjiProduct`.

---

### 1.4 Daily Menu — Multiple UX Problems

Identified from code review of `MenuSetupModal.tsx` and `menu/page.tsx`:

| Problem | Root Cause |
|---|---|
| No date guard preventing past dates | `selectedDate` has no `min` bound; API has no past-date check |
| Confusing 3-step wizard | Checkbox grid for products is cognitively heavy |
| No "Select All" for dishes | Missing UI control |
| No search/input for dishes | Products are listed as a flat checkbox grid |
| Frequently used items not surfaced | No cache/localStorage frequency tracking |
| No minimum sabji count per thali | `DailyMenu` only stores available options; no minimum required field |
| No menu ID usable as public URL | `DailyMenu.id` (cuid) exists but no `/menu/:id` public route |

---

### 1.5 Navigation Clutter

`Products`, `Thalis`, and `Staff` are 3 separate sidebar links → 3 separate page loads → admin cognitive overhead. All 3 are "catalog data" that rarely change. Consolidating into one tabbed page (`/catalog`) reduces navigation clicks by 2 for every task.

---

### 1.6 Bulk Upload Status

From code review of `api/users/bulk/route.ts`: The logic is **correct** — it normalises numbers, checks duplicates, validates company names. The likely failure mode is **CSV column header mismatch** (user sends wrong headers) — not a backend bug. The `BulkUserModal.tsx` needs to clearly show expected format and give a preview before importing.

---

## 2. Phase 0 — Bug Fixes

**Estimated time: 3–4 hours**
**Pre-requisite for everything else — do this first.**

### 2.1 Fix: Product Status Toggle

**File:** `src/app/api/products/[id]/route.ts`

Add a `PATCH` method that only updates `isActive`:

```ts
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { isActive } = await req.json();
  if (typeof isActive !== "boolean")
    return NextResponse.json({ error: "isActive must be boolean" }, { status: 400 });

  const product = await prisma.product.update({
    where: { id },
    data: { isActive },
  });
  return NextResponse.json({ product });
}
```

**File:** `src/app/(admin)/products/page.tsx`

Change `handleToggle` to call `PATCH` instead of `PUT`:

```ts
const handleToggle = async (product: Product) => {
  setTogglingId(product.id);
  try {
    const res = await fetch(`/api/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !product.isActive }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Failed");
    toast.success(product.isActive ? "Deactivated" : "Activated");
    fetchProducts();
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : "Toggle failed");
  } finally {
    setTogglingId(null);
  }
};
```

**Same fix applies to:**
- `src/app/api/thalis/[id]/route.ts` → add `PATCH` for `isActive`
- `src/app/api/staff/[id]/route.ts` → add `PATCH` for `isActive`
- `src/app/(admin)/thalis/page.tsx` → update `handleToggle` to use `PATCH`
- `src/app/(admin)/staff/page.tsx` → update `handleToggle` to use `PATCH`

---

### 2.2 Fix: Menu Date Guard (Prevent Setting Previous Day's Menu)

**File:** `src/app/(admin)/menu/page.tsx`

Add a `minDate` bound to the date input:

```tsx
// At top of component
const todayStr = (() => {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
})();

// On the date <input>:
<input
  type="date"
  value={selectedDate}
  min={todayStr}   // <-- ADD THIS
  onChange={(e) => setSelectedDate(e.target.value)}
  ...
/>
```

Also, disable the `← Prev Day` button when `selectedDate === todayStr`:

```tsx
<button
  onClick={handlePrevDay}
  disabled={selectedDate <= todayStr}
  className={`... ${selectedDate <= todayStr ? "opacity-30 cursor-not-allowed" : ""}`}
>
```

**File:** `src/app/api/menu/route.ts` (POST handler)

Add server-side guard:

```ts
const menuDate = new Date(date);
const today = new Date();
today.setHours(0, 0, 0, 0);
if (menuDate < today) {
  return NextResponse.json({ error: "Cannot create a menu for a past date" }, { status: 400 });
}
```

---

## 3. Phase 1 — Schema & DB Migration

**Estimated time: 1 hour**
**Do AFTER Phase 0 — these are additive schema changes.**

### 3.1 New/Updated Prisma Models

```prisma
// ─── PRODUCT (add nameGu) ───────────────────────
model Product {
  id                String                 @id @default(cuid())
  name              String                 @unique  // English name
  nameGu            String?                         // Gujarati name (pal નામ)
  quantity          String
  price             Float
  isActive          Boolean                @default(true)
  thaliSabjiPool    ThaliSabjiProduct[]    // NEW: which thalis allow this as sabji
  dailySabjiOptions DailyMenuSabjiOption[]
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt
}

// ─── THALI (add nameGu, constrain maxSabjiCount) ─
model Thali {
  id             String                 @id @default(cuid())
  name           String                 @unique  // English name
  nameGu         String?                         // Gujarati name
  price          Float
  description    String?
  maxSabjiCount  Int                    @default(1)  // 0–3 ONLY
  isActive       Boolean                @default(true)
  items          ThaliItem[]
  sabjiPool      ThaliSabjiProduct[]    // NEW: pre-approved sabji products
  dailyMenus     DailyMenuThali[]
  dailySabjiOpts DailyMenuSabjiOption[]
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt
}

// ─── NEW JOIN TABLE: pre-approved sabji per thali ─
model ThaliSabjiProduct {
  id        String   @id @default(cuid())
  thali     Thali    @relation(fields: [thaliId], references: [id], onDelete: Cascade)
  thaliId   String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId String
  createdAt DateTime @default(now())

  @@unique([thaliId, productId])
}

// ─── DAILY MENU (add minSabjiRequired per thali per menu) ─
// Instead of a new model, add to DailyMenuThali:
model DailyMenuThali {
  id              String    @id @default(cuid())
  menu            DailyMenu @relation(fields: [menuId], references: [id], onDelete: Cascade)
  menuId          String
  thali           Thali     @relation(fields: [thaliId], references: [id], onDelete: Restrict)
  thaliId         String
  minSabjiRequired Int      @default(1)   // NEW: admin can set minimum per menu slot
  
  @@unique([menuId, thaliId])
}

// ─── DAILY MENU (add menuPublicSlug for public URL) ───
model DailyMenu {
  id           String                 @id @default(cuid())
  publicSlug   String                 @unique @default(cuid())  // NEW: public-safe URL
  date         DateTime               @db.Date
  mealType     MealType
  cutoffTime   String?
  isPublished  Boolean                @default(false)
  thalis       DailyMenuThali[]
  sabjiOptions DailyMenuSabjiOption[]
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt

  @@unique([date, mealType])
}
```

### 3.2 Migration Command

```bash
npx prisma migrate dev --name v2_bilingual_sabji_pool_public_slug
```

### 3.3 Seed Update

Update `prisma/seed.ts` to add sample `nameGu` values for products and `ThaliSabjiProduct` entries matching the existing thali+product combos.

---

## 4. Phase 2 — Catalog Hub Page

**Estimated time: 5 hours**
**Consolidates Products + Thalis + Staff into `/catalog` with tabs.**

### 4.1 New Route: `/catalog`

Create `src/app/(admin)/catalog/page.tsx`.

Remove the old sidebar links for `/products`, `/thalis`, `/staff`. Replace with single `/catalog` link.

**Tab structure:**

```
[ Products ]  [ Thalis ]  [ Staff ]
```

Each tab renders the exact same UI as the old standalone pages — just co-located.

**Component structure:**

```
src/app/(admin)/catalog/
  page.tsx               ← tab router, renders one of:
  _ProductsTab.tsx       ← moved from (admin)/products/page.tsx
  _ThalisTab.tsx         ← moved from (admin)/thalis/page.tsx  
  _StaffTab.tsx          ← moved from (admin)/staff/page.tsx
```

**page.tsx skeleton:**

```tsx
"use client";

import { useState } from "react";
import ProductsTab from "./_ProductsTab";
import ThalisTab from "./_ThalisTab";
import StaffTab from "./_StaffTab";

type Tab = "products" | "thalis" | "staff";

const tabs: { key: Tab; label: string; emoji: string }[] = [
  { key: "products", label: "Products", emoji: "🥘" },
  { key: "thalis", label: "Thalis", emoji: "🍱" },
  { key: "staff", label: "Staff", emoji: "👤" },
];

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<Tab>("products");

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Catalog</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage products, thalis, and staff in one place
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
              }
            `}
          >
            <span>{tab.emoji}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "products" && <ProductsTab />}
      {activeTab === "thalis" && <ThalisTab />}
      {activeTab === "staff" && <StaffTab />}
    </div>
  );
}
```

### 4.2 ProductsTab — Bilingual Fields

**Updated `ProductModal.tsx`** — add `nameGu` field:

```tsx
// In schema:
const schema = z.object({
  name: z.string().min(1, "English name is required"),
  nameGu: z.string().optional(),     // NEW
  quantity: z.string().min(1, "Quantity is required"),
  price: z.coerce.number().min(0),
});

// In form JSX — after name field:
<Input
  label="નામ (Gujarati Name)"
  placeholder="દા.ત. પાલક પનીર"
  error={errors.nameGu?.message}
  {...register("nameGu")}
/>
```

**Updated products table column:**

```tsx
{ key: "name", header: "Item Name", render: (row) => (
  <div>
    <p className="font-medium text-gray-900">{row.name}</p>
    {row.nameGu && <p className="text-xs text-gray-400">{row.nameGu}</p>}
  </div>
)},
```

**Updated API route** `api/products/route.ts` POST and `api/products/[id]/route.ts` PUT — accept and save `nameGu`.

### 4.3 ThalisTab — Bilingual + Sabji Pool + Max 3 Cap

**Updated `ThaliModal.tsx`:**

Key changes:
1. Add `nameGu` text input
2. Replace free `maxSabjiCount` number input with a `<select>` limited to `0 | 1 | 2 | 3`
3. Add **Sabji Pool section** — loads all active Products, lets admin tick which ones are allowed as sabji for this thali (stored in `ThaliSabjiProduct`)

```tsx
// maxSabjiCount selector:
<div>
  <label className="text-sm font-medium text-gray-700 block mb-1">
    Max Sabji Choices <span className="text-red-500">*</span>
  </label>
  <select
    value={maxSabjiCount}
    onChange={(e) => setMaxSabjiCount(Number(e.target.value))}
    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500/30"
  >
    <option value={0}>0 — Fixed items only (no sabji choice)</option>
    <option value={1}>1 — Customer picks 1 sabji</option>
    <option value={2}>2 — Customer picks 2 sabji</option>
    <option value={3}>3 — Customer picks 3 sabji</option>
  </select>
</div>

// Sabji Pool (only shown when maxSabjiCount > 0):
{maxSabjiCount > 0 && (
  <div>
    <label className="text-sm font-medium text-gray-700 block mb-2">
      Allowed Sabji Options <span className="text-red-500">*</span>
      <span className="text-xs text-gray-400 font-normal ml-2">
        (these products will be choosable at menu time)
      </span>
    </label>
    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto border border-gray-200 rounded-xl p-3">
      {allProducts.map((product) => {
        const isSelected = selectedProductIds.includes(product.id);
        return (
          <button
            key={product.id}
            type="button"
            onClick={() => toggleProduct(product.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-all ${
              isSelected
                ? "border-orange-400 bg-orange-50 text-orange-700"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {isSelected ? <CheckSquare size={12} className="text-orange-500 flex-shrink-0" /> : <Square size={12} className="text-gray-300 flex-shrink-0" />}
            <div>
              <p>{product.name}</p>
              {product.nameGu && <p className="text-gray-400">{product.nameGu}</p>}
            </div>
          </button>
        );
      })}
    </div>
    {selectedProductIds.length < maxSabjiCount && (
      <p className="text-xs text-amber-600 mt-1">
        ⚠ Select at least {maxSabjiCount} product(s) to allow valid sabji choices
      </p>
    )}
  </div>
)}
```

**API changes:** `api/thalis/route.ts` POST and `api/thalis/[id]/route.ts` PUT:
- Accept `sabjiProductIds: string[]`
- Validate `maxSabjiCount <= 3`
- Create/update `ThaliSabjiProduct` records inside a transaction

```ts
// In POST:
const thali = await prisma.$transaction(async (tx) => {
  const created = await tx.thali.create({ ... });
  if (sabjiProductIds?.length > 0) {
    await tx.thaliSabjiProduct.createMany({
      data: sabjiProductIds.map((productId) => ({ thaliId: created.id, productId })),
    });
  }
  return created;
});
```

---

## 5. Phase 3 — Daily Menu V2

**Estimated time: 8–10 hours**
**This is the biggest and most impactful change.**

### 5.1 Design Principle: Kill the 3-Step Wizard

Replace the current 3-step modal wizard with a **single full-page layout** at `/menu`. The modal approach is inherently cramped and forces admin to lose context. Move everything inline.

**New layout for `/menu`:**

```
┌─────────────────────────────────────────────────────┐
│ Daily Menu           [← Today →]  [26 Jun 2025]     │
├──────────────────────┬──────────────────────────────┤
│   🌅 LUNCH           │   🌙 DINNER                  │
│   ─────────────────  │   ─────────────────          │
│   Cutoff: [11:30]   │   Cutoff: [18:30]            │
│                      │                              │
│   Thalis:            │   Thalis:                    │
│   [Search thalis...] │   [Search thalis...]         │
│   ┌──────────────┐   │   ┌──────────────┐           │
│   │ ✓ Small Guj  │   │   │ ✓ Full Guj   │           │
│   │ ✓ Full Guj   │   │   └──────────────┘           │
│   └──────────────┘   │                              │
│                      │   Sabji for Full Guj:        │
│   Sabji for Small:   │   [Search sabji...]          │
│   [Search sabji...]  │   • Palak Paneer ✓           │
│   • Aloo Gobi ✓      │   • Aloo Gobi               │
│   • Mix Veg          │   Min required: [1 ▾]        │
│   Min required: [1 ▾]│                              │
│                      │                              │
│   [🔗 Menu ID: abc]  │   [🔗 Menu ID: xyz]          │
│   [Save Lunch]       │   [Save Dinner]              │
└──────────────────────┴──────────────────────────────┘
```

On mobile this collapses to a single-column layout with a Lunch/Dinner toggle tab at top.

### 5.2 Smart Dish Search — `useSabjiSearch` Hook

Create `src/hooks/useSabjiSearch.ts`:

```ts
import { useState, useMemo, useEffect } from "react";

const FREQ_KEY = "vdh_sabji_freq";

function getFreqMap(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(FREQ_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function bumpFreq(productId: string) {
  const map = getFreqMap();
  map[productId] = (map[productId] ?? 0) + 1;
  localStorage.setItem(FREQ_KEY, JSON.stringify(map));
}

export function useSabjiSearch(products: { id: string; name: string; nameGu?: string | null }[]) {
  const [query, setQuery] = useState("");
  const [freqMap, setFreqMap] = useState<Record<string, number>>({});

  useEffect(() => {
    setFreqMap(getFreqMap());
  }, []);

  const sorted = useMemo(() => {
    const q = query.toLowerCase().trim();
    const filtered = q
      ? products.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.nameGu ?? "").includes(q)
        )
      : products;

    return [...filtered].sort((a, b) => (freqMap[b.id] ?? 0) - (freqMap[a.id] ?? 0));
  }, [query, products, freqMap]);

  // Top frequently used (shown as quick-add chips when query is empty)
  const frequentItems = useMemo(() => {
    if (query) return [];
    return Object.entries(freqMap)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => products.find((p) => p.id === id))
      .filter(Boolean) as typeof products;
  }, [freqMap, products, query]);

  const recordSelection = (productId: string) => {
    bumpFreq(productId);
    setFreqMap(getFreqMap());
  };

  return { query, setQuery, sorted, frequentItems, recordSelection };
}
```

### 5.3 `SabjiPicker` Component

Create `src/components/admin/SabjiPicker.tsx`:

```tsx
"use client";

import { useSabjiSearch } from "@/hooks/useSabjiSearch";
import { Search, X, Zap } from "lucide-react";

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
}

interface SabjiPickerProps {
  products: Product[];          // Only thali's approved sabji pool
  selected: string[];           // Selected product IDs
  onChange: (ids: string[]) => void;
  maxCount: number;             // thali.maxSabjiCount
  minRequired?: number;         // for menu slot
  onMinChange?: (n: number) => void;
  label?: string;
}

export default function SabjiPicker({
  products,
  selected,
  onChange,
  maxCount,
  minRequired = 1,
  onMinChange,
  label,
}: SabjiPickerProps) {
  const { query, setQuery, sorted, frequentItems, recordSelection } =
    useSabjiSearch(products);

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    onChange(next);
    if (!selected.includes(id)) recordSelection(id);
  };

  const selectAll = () => {
    products.forEach((p) => {
      if (!selected.includes(p.id)) recordSelection(p.id);
    });
    onChange(products.map((p) => p.id));
  };

  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-700">{label}</p>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-orange-500 hover:text-orange-600 font-medium"
          >
            Select All ({products.length})
          </button>
        </div>
      )}

      {/* Frequent chips (when no search) */}
      {frequentItems.length > 0 && !query && (
        <div className="flex flex-wrap gap-1.5">
          <span className="flex items-center gap-1 text-[10px] text-amber-600 font-semibold">
            <Zap size={10} /> Quick add:
          </span>
          {frequentItems.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all ${
                selected.includes(p.id)
                  ? "bg-orange-100 border-orange-400 text-orange-700"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:border-orange-300"
              }`}
            >
              {p.name}
              {selected.includes(p.id) && " ✓"}
            </button>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sabji by name or Gujarati..."
          className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Product list */}
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {sorted.map((product) => {
          const isSelected = selected.includes(product.id);
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => toggle(product.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left text-sm transition-all ${
                isSelected
                  ? "border-orange-400 bg-orange-50 text-orange-700"
                  : "border-gray-100 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div
                className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  isSelected ? "bg-orange-500 border-orange-500" : "border-gray-300"
                }`}
              >
                {isSelected && (
                  <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                    <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div>
                <p className="font-medium text-sm">{product.name}</p>
                {product.nameGu && (
                  <p className="text-xs text-gray-400">{product.nameGu}</p>
                )}
              </div>
            </button>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">
            No matching products found
          </p>
        )}
      </div>

      {/* Min sabji required selector */}
      {onMinChange && (
        <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
          <p className="text-xs text-gray-500 flex-1">
            Min sabji required from customer:
          </p>
          <select
            value={minRequired}
            onChange={(e) => onMinChange(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-orange-500/30"
          >
            {Array.from({ length: maxCount + 1 }, (_, i) => (
              <option key={i} value={i}>{i} {i === 0 ? "(optional)" : ""}</option>
            ))}
          </select>
        </div>
      )}

      {/* Selection summary */}
      <p className="text-[11px] text-gray-400">
        {selected.length} of {products.length} options selected
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="ml-2 text-red-400 hover:text-red-500"
          >
            Clear
          </button>
        )}
      </p>
    </div>
  );
}
```

### 5.4 Full Rewrite of `menu/page.tsx`

The new page ditches the modal approach entirely. Both lunch and dinner are managed inline as two side-by-side cards (or stacked on mobile).

**Key structural changes:**

```tsx
"use client";

// State:
// selectedDate, lunchDraft, dinnerDraft
// lunchDraft = { cutoffTime, selectedThaliIds, sabjiMap, minSabjiMap, existingId? }
// dinnerDraft = same

// API flow:
// - On date change: fetch existing menus for date, populate drafts
// - "Save Lunch" / "Save Dinner" buttons: POST or PUT based on existingId

// Layout:
// - Date nav (same as current, with min guard)
// - Two-column grid (md:grid-cols-2), one for lunch, one for dinner
// - Each column has:
//   1. Header (emoji, meal type, cutoff time input)
//   2. Thali selector (input search + list of active thalis)
//   3. Per-thali SabjiPicker (only thali's approved sabji pool)
//   4. Menu ID badge + public URL copy button (if menu exists)
//   5. Save / Delete buttons
```

**Menu ID / Public URL display** (after menu is saved):

```tsx
{menu && (
  <div className="mt-3 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
    <span className="text-xs text-gray-500">Public Menu URL:</span>
    <code className="text-xs font-mono text-orange-600 flex-1 truncate">
      /menu/{menu.publicSlug}
    </code>
    <button
      onClick={() => {
        navigator.clipboard.writeText(`${window.location.origin}/menu/${menu.publicSlug}`);
        toast.success("URL copied!");
      }}
      className="text-xs text-gray-400 hover:text-gray-600"
    >
      Copy
    </button>
    <a
      href={`/menu/${menu.publicSlug}`}
      target="_blank"
      className="text-xs text-orange-500 hover:text-orange-600"
    >
      Open →
    </a>
  </div>
)}
```

### 5.5 API Updates for Menu

**`api/menu/route.ts` POST** — accept `minSabjiMap`:
```ts
// minSabjiMap: { thaliId: string; minRequired: number }[]
// Store in DailyMenuThali.minSabjiRequired
```

**`api/menu/[id]/route.ts` PUT** — same.

**New route:** `src/app/api/menu/[id]/route.ts` — add `GET` for fetching single menu by ID.

**New public route:** `src/app/api/public/menu/[slug]/route.ts`:
```ts
// GET — returns menu by publicSlug, no auth required
// Used by public-facing /menu/:slug page
```

---

## 6. Phase 4 — Public Menu URL

**Estimated time: 4 hours**
**Foundation for customer-facing ordering.**

### 6.1 Public Menu Page

Create `src/app/menu/[slug]/page.tsx` (outside admin group, no auth):

```tsx
// Server component
// Fetch: /api/public/menu/:slug
// Display:
//   - Tiffin service name + date
//   - Lunch / Dinner tabs
//   - Per-thali card with:
//     - Thali name (English + Gujarati)
//     - Price
//     - Fixed items list
//     - Sabji choice dropdown/grid (min to max options)
//     - "Order on WhatsApp" button (pre-fills message with selection)
```

**WhatsApp message format:**

```
VD's Hunger Hub Order
Date: 26 Jun 2025
Meal: Lunch
Thali: Full Gujarati Thali (₹120)
Sabji: Palak Paneer, Aloo Gobi
```

URL becomes: `https://wa.me/916356350086?text=...urlencoded...`

### 6.2 Add to `proxy.ts` — Public Paths

```diff
- const PUBLIC_PATHS = ["/", "/login", "/api/auth/login"];
+ const PUBLIC_PATHS = ["/", "/login", "/api/auth/login", "/menu"];
```

And ensure `/menu/:slug` and `/api/public/menu/:slug` are not blocked by the middleware.

---

## 7. Phase 5 — Bulk Upload Audit

**Estimated time: 2 hours**

### 7.1 Current State Analysis

**`api/users/bulk/route.ts`** — Logic is sound. The bug-risk areas:

| Risk | Fix |
|---|---|
| CSV column must be exactly `name`, `number`, `company_name` | Add column header validation with helpful error message |
| Numbers with leading zero or +91 stripped correctly | Already handled — verified |
| Company name case-sensitive lookup | Already lowercased — verified |
| No progress feedback for large CSVs | Frontend sends entire CSV at once; add row count check |

### 7.2 `BulkUserModal.tsx` — Improvements

1. **Show expected CSV format** with a downloadable sample template:

```tsx
<a
  href="/sample-users.csv"
  download
  className="text-xs text-orange-500 hover:underline"
>
  Download Sample CSV
</a>
```

Create `public/sample-users.csv`:
```csv
name,number,company_name
Rahul Patel,9876543210,TechCorp Pvt Ltd
Priya Shah,9988776655,Infosys BPO
```

2. **Preview before import** — parse CSV client-side first, show a summary table with ✅ / ❌ per row before sending to API.

3. **Add column validation** in the modal before API call:

```ts
const requiredHeaders = ["name", "number", "company_name"];
const headers = Object.keys(parsed.data[0] ?? {});
const missing = requiredHeaders.filter((h) => !headers.includes(h));
if (missing.length > 0) {
  toast.error(`CSV missing columns: ${missing.join(", ")}`);
  return;
}
```

4. **Cap at 500 rows** with a warning:

```ts
if (validRows.length > 500) {
  toast.error("Maximum 500 users per import. Split into smaller files.");
  return;
}
```

5. **Add products and thalis bulk upload** (new feature):

**`api/products/bulk/route.ts`** — accept CSV of `name,nameGu,quantity,price`:
```ts
// Upsert by name — update if exists, create if not
// Return { created, updated, skipped, errors }
```

**`api/thalis/bulk/route.ts`** — accept CSV of `name,nameGu,price,maxSabjiCount,description`:
```ts
// Items (fixed components) would be semicolon-separated in one CSV column:
// name,price,maxSabjiCount,items
// Small Thali,80,1,"4 Roti;Salad;Buttermilk"
```

---

## 8. Phase 6 — Admin Speed Research

**This section is deep research on dashboard UX patterns for maximum admin efficiency.**

### 8.1 The Core Principle: Zero-Friction Repetition

The admin (VD) does **the same operations every day**:
1. Open menu page → set today's lunch → set today's dinner → copy public URLs
2. Occasionally add/deactivate a product or thali

Everything else (companies, users, staff) is infrequent. The product must be optimized ruthlessly for these daily flows.

### 8.2 Research Findings: High-Velocity Admin Dashboards

Based on patterns from Shopify Admin, Linear, Notion, and tiffin/food SaaS UX audits:

#### A. "Today First" Layout on Dashboard

The dashboard should answer in 3 seconds: **"Is today's menu set?"** Move the menu cards to the very top of the dashboard, above all stats. If lunch or dinner is missing, show a bright orange CTA with "⚡ Set Lunch Menu" / "⚡ Set Dinner Menu" that goes directly to the menu page pre-focused on that meal.

**Implementation:** Update `dashboard/page.tsx` to move the "Today's Menu" section above the stats grid.

#### B. Keyboard Shortcuts

Admins doing repetitive work benefit enormously from keyboard shortcuts. Add a global `useKeyboard` hook:

```ts
// k → open /catalog (Products)
// m → open /menu
// d → open /dashboard
// / → focus search input (if on a list page)
```

**Implementation:** `src/hooks/useKeyboard.ts` + a `KeyboardHintBar` component shown at the bottom of every admin page.

#### C. Recent Actions Widget

Add a small "Recent" section to the dashboard sidebar or dashboard page — last 5 menus created, last product added. This lets admin "repeat yesterday's menu" with one click.

**Implementation:** Add a `recentMenus` field to `GET /api/dashboard` response — fetch last 5 menus ordered by `createdAt DESC`.

**Add a "Copy from Yesterday" button** on the menu page:

```tsx
<button
  onClick={handleCopyFromYesterday}
  className="text-xs text-gray-500 hover:text-orange-500 flex items-center gap-1"
>
  📋 Copy from yesterday
</button>
```

`handleCopyFromYesterday`:
- Fetch yesterday's lunch/dinner menus
- Pre-populate current date's draft with same thalis + sabji selections
- Admin just hits "Save" — done in 2 clicks

#### D. Auto-Save Drafts

Store the current menu draft in `sessionStorage` so if the page reloads or admin navigates away, drafts are restored. Use the key `vdh_menu_draft_${date}`.

```ts
// On draft change:
useEffect(() => {
  sessionStorage.setItem(`vdh_menu_draft_${selectedDate}`, JSON.stringify({ lunchDraft, dinnerDraft }));
}, [lunchDraft, dinnerDraft, selectedDate]);

// On mount:
useEffect(() => {
  const saved = sessionStorage.getItem(`vdh_menu_draft_${selectedDate}`);
  if (saved) {
    const { lunchDraft: ld, dinnerDraft: dd } = JSON.parse(saved);
    // restore drafts (only if menus don't already exist)
  }
}, [selectedDate]);
```

#### E. Optimistic UI Updates

Currently every toggle/delete calls `fetchProducts()` after completing — this causes a full re-render and a new API call. Replace with **optimistic updates**:

```ts
// Instead of fetchProducts() after toggle:
setProducts((prev) =>
  prev.map((p) => p.id === product.id ? { ...p, isActive: !p.isActive } : p)
);
// Then fire the PATCH in background — revert if it fails
```

This makes the UI feel instant.

#### F. Inline Editing for Simple Fields

For product price or thali price — instead of opening a modal to change one number, support **inline editing** (click the price → becomes an input → press Enter to save).

```tsx
// In table cell:
{editingPriceId === row.id ? (
  <input
    autoFocus
    type="number"
    defaultValue={row.price}
    onBlur={(e) => handleInlinePriceSave(row.id, Number(e.target.value))}
    onKeyDown={(e) => e.key === "Enter" && handleInlinePriceSave(row.id, Number(e.currentTarget.value))}
    className="w-24 px-2 py-1 text-sm border border-orange-400 rounded-lg focus:ring-2 focus:ring-orange-500/30"
  />
) : (
  <span
    className="cursor-pointer hover:text-orange-600 hover:underline"
    onClick={() => setEditingPriceId(row.id)}
  >
    {formatCurrency(row.price)}
  </span>
)}
```

#### G. Smart Default Times

When admin opens the menu page, cutoff times should default intelligently:
- Lunch → `11:30` (already done)
- Dinner → `18:30` (already done)

But also: if it's after 12:00 IST, automatically switch the default focused meal to **Dinner**, since Lunch is likely already past.

```ts
const defaultMealFocus = (): "lunch" | "dinner" => {
  const hour = new Date().getHours(); // in IST since server renders IST
  return hour >= 12 ? "dinner" : "lunch";
};
```

#### H. Notification Badge on Dashboard

If today's lunch or dinner is NOT set and it's before 10:00 AM for lunch / before 4:00 PM for dinner, show a pulsing amber badge on the Dashboard nav item and on the page:

```tsx
// In Sidebar navItems:
{ href: "/menu", icon: CalendarDays, label: "Daily Menu", badge: menuNotSet ? "!" : null }
```

#### I. Bulk Quick-Set for Recurring Menus

Most tiffin services repeat the same menu combinations frequently (e.g. Mon = Full Guj + Palak + Aloo Gobi, Tue = Medium + Rajma + Mix Veg). Add **Menu Templates**:

- Admin saves a named template from a current menu
- Next time, pick "Load Template" instead of configuring from scratch

**Schema addition:**
```prisma
model MenuTemplate {
  id          String   @id @default(cuid())
  name        String   @unique  // e.g. "Monday Lunch"
  mealType    MealType
  cutoffTime  String?
  thaliIds    String[] // stored as array of thali IDs
  sabjiConfig Json     // { thaliId: string; productIds: string[]; minRequired: number }[]
  createdAt   DateTime @default(now())
}
```

Store in `api/menu-templates/`. Show in the menu page as a "Load Template" dropdown above the form.

#### J. IST Timezone Handling (Critical Bug Prevention)

Every date comparison in the admin must use IST (UTC+5:30). Currently `dashboard/route.ts` does this correctly. Ensure all other places that compute "today" use the same IST offset:

```ts
// src/lib/utils.ts — add:
export function getTodayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}
```

Replace all raw `new Date()` → `toLocaleDateString` calls in the admin with `getTodayIST()`.

---

## 9. Phase 7 — Sidebar Cleanup

**Estimated time: 2 hours**

### 9.1 Updated Sidebar Navigation

```ts
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/companies", icon: Building2, label: "Companies" },
  { href: "/users", icon: Users, label: "Users" },
  // REMOVED: /products, /thalis, /staff  
  { href: "/catalog", icon: ShoppingBasket, label: "Catalog" }, // NEW — replaces 3
  { href: "/menu", icon: CalendarDays, label: "Daily Menu", badge: menuAlertBadge },
];
```

### 9.2 Update Header `pageTitles`

```ts
const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/companies": "Companies",
  "/users": "Users",
  "/catalog": "Catalog",          // NEW
  "/menu": "Daily Menu",
  // Remove: /products, /thalis, /staff
};
```

### 9.3 Add `/catalog` to `proxy.ts` Protected Paths

```ts
const PROTECTED_PAGE_PREFIXES = [
  "/dashboard", "/companies", "/users",
  "/catalog",   // NEW
  "/menu",
];
```

Remove `/products`, `/thalis`, `/staff` from protected prefixes (they'll 404 cleanly — or add redirects).

### 9.4 Add Redirects for Old Routes

In `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/products", destination: "/catalog", permanent: true },
      { source: "/thalis", destination: "/catalog", permanent: true },
      { source: "/staff", destination: "/catalog", permanent: true },
    ];
  },
};
```

---

## 10. File-by-File Change Index

| File | Action | Phase | Notes |
|---|---|---|---|
| `src/app/api/products/[id]/route.ts` | EDIT | P0 | Add `PATCH` handler for isActive toggle |
| `src/app/api/thalis/[id]/route.ts` | EDIT | P0 | Add `PATCH` handler for isActive toggle |
| `src/app/api/staff/[id]/route.ts` | EDIT | P0 | Add `PATCH` handler for isActive toggle |
| `src/app/(admin)/menu/page.tsx` | EDIT | P0 | Add `min` date guard, disable prev-day button |
| `src/app/api/menu/route.ts` | EDIT | P0+P3 | Add past-date guard in POST; accept minSabjiMap |
| `prisma/schema.prisma` | EDIT | P1 | Add `nameGu`, `ThaliSabjiProduct`, `publicSlug`, `minSabjiRequired` |
| `prisma/seed.ts` | EDIT | P1 | Add sample `nameGu`, `ThaliSabjiProduct` rows |
| `src/app/(admin)/catalog/page.tsx` | NEW | P2 | Tab router for Products + Thalis + Staff |
| `src/app/(admin)/catalog/_ProductsTab.tsx` | NEW | P2 | Moved from products/page.tsx + bilingual |
| `src/app/(admin)/catalog/_ThalisTab.tsx` | NEW | P2 | Moved from thalis/page.tsx + bilingual + sabji pool |
| `src/app/(admin)/catalog/_StaffTab.tsx` | NEW | P2 | Moved from staff/page.tsx |
| `src/components/modals/ProductModal.tsx` | EDIT | P2 | Add `nameGu` field |
| `src/components/modals/ThaliModal.tsx` | EDIT | P2 | Add `nameGu`, sabji pool picker, max 3 cap |
| `src/app/api/products/route.ts` | EDIT | P2 | Accept + save `nameGu` |
| `src/app/api/products/[id]/route.ts` | EDIT | P2 | Accept + save `nameGu` |
| `src/app/api/thalis/route.ts` | EDIT | P2 | Accept `nameGu`, `sabjiProductIds`, validate maxSabjiCount ≤ 3 |
| `src/app/api/thalis/[id]/route.ts` | EDIT | P2 | Same + update ThaliSabjiProduct in transaction |
| `src/app/(admin)/menu/page.tsx` | FULL REWRITE | P3 | Inline two-column layout, no modal |
| `src/hooks/useSabjiSearch.ts` | NEW | P3 | Frequency-tracking search hook with localStorage |
| `src/components/admin/SabjiPicker.tsx` | NEW | P3 | Search + quick chips + select all + min selector |
| `src/app/api/menu/[id]/route.ts` | EDIT | P3 | Accept `minSabjiMap`; add GET handler |
| `src/app/api/public/menu/[slug]/route.ts` | NEW | P4 | Public unauthenticated menu fetch by slug |
| `src/app/menu/[slug]/page.tsx` | NEW | P4 | Public menu view + WhatsApp order button |
| `src/proxy.ts` | EDIT | P4 | Add `/menu` to PUBLIC_PATHS |
| `src/app/api/products/bulk/route.ts` | NEW | P5 | Bulk product import from CSV |
| `src/app/api/thalis/bulk/route.ts` | NEW | P5 | Bulk thali import from CSV |
| `src/components/modals/BulkUserModal.tsx` | EDIT | P5 | Preview table, column validation, sample CSV link |
| `public/sample-users.csv` | NEW | P5 | Downloadable template |
| `src/hooks/useKeyboard.ts` | NEW | P6 | Global keyboard shortcut handler |
| `src/lib/utils.ts` | EDIT | P6 | Add `getTodayIST()` |
| `src/app/api/dashboard/route.ts` | EDIT | P6 | Add `recentMenus` to response |
| `src/app/(admin)/dashboard/page.tsx` | EDIT | P6 | Menu cards at top; today-alert; recent menus |
| `src/app/api/menu-templates/route.ts` | NEW | P6 | CRUD for menu templates |
| `src/app/(admin)/components/Sidebar.tsx` | EDIT | P7 | Replace 3 links with /catalog; add badge support |
| `src/app/(admin)/components/Header.tsx` | EDIT | P7 | Add /catalog to pageTitles |
| `src/proxy.ts` | EDIT | P7 | Add /catalog to protected paths |
| `next.config.ts` | EDIT | P7 | Redirects from /products, /thalis, /staff → /catalog |

---

## 11. Prisma Migration SQL Reference

```sql
-- Add nameGu to Product
ALTER TABLE "Product" ADD COLUMN "nameGu" TEXT;

-- Add nameGu to Thali
ALTER TABLE "Thali" ADD COLUMN "nameGu" TEXT;

-- Create ThaliSabjiProduct join table
CREATE TABLE "ThaliSabjiProduct" (
    "id" TEXT NOT NULL,
    "thaliId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThaliSabjiProduct_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ThaliSabjiProduct_thaliId_fkey" FOREIGN KEY ("thaliId") REFERENCES "Thali"("id") ON DELETE CASCADE,
    CONSTRAINT "ThaliSabjiProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "ThaliSabjiProduct_thaliId_productId_key" ON "ThaliSabjiProduct"("thaliId", "productId");

-- Add publicSlug to DailyMenu
ALTER TABLE "DailyMenu" ADD COLUMN "publicSlug" TEXT;
UPDATE "DailyMenu" SET "publicSlug" = gen_random_uuid()::text WHERE "publicSlug" IS NULL;
ALTER TABLE "DailyMenu" ALTER COLUMN "publicSlug" SET NOT NULL;
CREATE UNIQUE INDEX "DailyMenu_publicSlug_key" ON "DailyMenu"("publicSlug");

-- Add minSabjiRequired to DailyMenuThali
ALTER TABLE "DailyMenuThali" ADD COLUMN "minSabjiRequired" INTEGER NOT NULL DEFAULT 1;

-- CreateTable MenuTemplate
CREATE TABLE "MenuTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mealType" "MealType" NOT NULL,
    "cutoffTime" TEXT,
    "thaliIds" TEXT[],
    "sabjiConfig" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MenuTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MenuTemplate_name_key" ON "MenuTemplate"("name");
```

---

## Build Order Summary

```
Day 1 Morning  → Phase 0: Bug fixes (status toggle PATCH, date guard)
Day 1 Afternoon→ Phase 1: Prisma schema migration + seed update
Day 2          → Phase 2: Catalog Hub page (Products + Thalis + Staff tabs) + bilingual forms
Day 3          → Phase 3 Part A: useSabjiSearch hook + SabjiPicker component
Day 4          → Phase 3 Part B: menu/page.tsx full rewrite (inline, two-column)
Day 5 Morning  → Phase 4: Public menu URL + WhatsApp order button
Day 5 Afternoon→ Phase 5: Bulk upload audit + products/thalis bulk
Day 6          → Phase 6: Speed improvements (keyboard, optimistic UI, copy-yesterday, templates)
Day 6 End      → Phase 7: Sidebar cleanup + redirects + navigation polish
```

---

*Plan prepared by Claude (claude-sonnet-4-6) for SoftVibe Services · VD's Hunger Hub Admin V2*