# Implementation Plan — Thali Categories & Per-Category Sabji Selection

**Project:** VD's Hunger Hub (`softvibeservices-vdshungerhub`)
**Stack:** Next.js · Prisma (PostgreSQL) · Tailwind CSS · React
**Scope:** New "Thali Category" concept in Catalog, exact (not max) sabji count wording, and a Daily Menu screen that asks for sabji **once per category** instead of once per thali.

---

## 1. The Problem, Restated Precisely

Today, on the Daily Menu screen, every checked thali gets its own `SabjiPicker` block (see `src/app/(admin)/menu/page.tsx`, the `{isChecked && thali.maxSabjiCount > 0 && <SabjiPicker .../>}` block, repeated for Lunch and Dinner). If you run **Small Gujarati Thali**, **Medium Gujarati Thali**, and **Full Gujarati Thali** on the same day, and all three use the same sabji choices, you currently configure the *same* sabji list **three separate times** — once per thali. That's the duplication you want gone.

The fix has two parts, matching what you described:

1. **Catalog: a new "Categories" tab.** You create a category once (e.g. "Gujarati Thali") and assign existing thalis to it (Small/Medium/Full Gujarati Thali all → Gujarati Thali category). Each thali belongs to **exactly one category** (confirmed: one category only, not many).
2. **Daily Menu: sabji is configured per category, not per thali.** If today's menu uses 2 categories, you fill in sabji **twice total** — not once per thali. Every thali under a category automatically inherits that category's sabji selection for that day.

Alongside this, the `maxSabjiCount` field's label/UI language changes from "Max Sabji Choice" to something that doesn't imply a ceiling — it's always been an **exact** count (0–3) in the validation logic already (`selectedCount === thali.maxSabjiCount` in the public menu page, and the "must select at least N" check in the admin menu page), so this is a wording fix, not a behavior change.

You've confirmed:
- ✅ One category per thali (simple foreign key, not a join table)
- ✅ No migration concerns — wipe existing `Thali`, `DailyMenu`, and related data and start fresh with the new schema (this is not in production use yet)
- ✅ Sabji count is just a rename — `maxSabjiCount` stays as-is structurally, only labels/copy change

---

## 2. Current State — What Exists Today (file-by-file)

| File | Current role | What changes |
|---|---|---|
| `prisma/schema.prisma` | `Thali.maxSabjiCount Int`, no category model | Add `ThaliCategory` model + `Thali.categoryId` |
| `src/app/(admin)/catalog/page.tsx` | 3 tabs: Products, Thalis, Staff | Add 4th tab: **Categories** |
| `src/app/(admin)/catalog/_ThalisTab.tsx` | Lists thalis, no category column | Add category column + category select in list |
| `src/components/modals/ThaliModal.tsx` | Create/edit thali form — name, price, description, sabji count, fixed items | Add **Category** select field; relabel sabji count field |
| `src/app/api/thalis/route.ts` (+ `[id]/route.ts`, `bulk/route.ts`) | CRUD for thalis, no category | Accept/return `categoryId` |
| **NEW** `src/app/(admin)/catalog/_CategoriesTab.tsx` | — | New tab: CRUD for categories + assign thalis |
| **NEW** `src/components/modals/CategoryModal.tsx` | — | New modal: create/edit category, multi-select thalis to assign |
| **NEW** `src/app/api/thali-categories/route.ts` + `[id]/route.ts` | — | New CRUD API for categories |
| `src/app/(admin)/menu/page.tsx` | One `SabjiPicker` per checked thali | Group checked thalis by category; one `SabjiPicker` per **category** |
| `src/app/api/menu/route.ts` + `[id]/route.ts` | `sabjiOptions: { thaliId, productIds }[]` saved per thali | Saved per **category**, then fanned out to all thalis in that category when read by the public page |
| `src/app/menu/[slug]/page.tsx` | Filters `sabjiOptions` by `thaliId` | Filters by the thali's `categoryId` instead |
| `src/app/api/menu-templates/route.ts` + `[id]/route.ts` | `sabjiConfig: [{thaliId, productIds}]` | `sabjiConfig: [{categoryId, productIds}]` |
| `prisma/seed.ts` | Seeds old-shape thalis | Re-seed with categories |
| `src/types/index.ts` | `Thali`, `SabjiOption`, etc. | Add `ThaliCategory`, update `Thali`, `SabjiOption` |

---

## 3. Data Model

### 3.1 New model: `ThaliCategory`

```prisma
model ThaliCategory {
  id        String   @id @default(cuid())
  name      String   @unique          // e.g. "Gujarati Thali"
  nameGu    String?                   // e.g. "ગુજરાતી થાળી"
  isActive  Boolean  @default(true)
  thalis    Thali[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 3.2 `Thali` model — add `categoryId`

```diff
model Thali {
  id             String                 @id @default(cuid())
  name           String                 @unique
  nameGu         String?
  price          Float
  description    String?
- maxSabjiCount  Int                    @default(1)
+ sabjiCount     Int                    @default(1)   // renamed: exact count of sabji, 0–3. No "max" semantics.
  isActive       Boolean                @default(true)
+ category       ThaliCategory?         @relation(fields: [categoryId], references: [id], onDelete: SetNull)
+ categoryId     String?
  items          ThaliItem[]
  sabjiPool      ThaliSabjiProduct[]
  dailyMenus     DailyMenuThali[]
  dailySabjiOpts DailyMenuSabjiOption[]
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt
}
```

**Field rename note:** `maxSabjiCount` → `sabjiCount` is a pure rename to kill the "max" framing everywhere (DB column, API payloads, TS types, UI copy). It is **optional** — if you'd rather avoid touching every call site that reads `maxSabjiCount`, you can keep the column name and only change the **label text** in the UI (Section 6.3 below works either way). The plan below assumes the rename, since you asked to remove the "max sabji concept" outright, but Section 9 calls out exactly which lines change if you choose to keep the old field name instead.

`categoryId` is **nullable** — a thali can exist without a category (e.g. while you're still setting things up), but the Daily Menu screen (Section 7) requires every thali used in a menu to have a category, since that's what makes grouping possible. This is enforced at menu-save time, not at thali-creation time, so you're not blocked while building out the catalog.

### 3.3 `DailyMenuSabjiOption` — add `categoryId` (denormalized, see rationale below)

```diff
model DailyMenuSabjiOption {
  id         String        @id @default(cuid())
  menu       DailyMenu     @relation(fields: [menuId], references: [id], onDelete: Cascade)
  menuId     String
- thali      Thali         @relation(fields: [thaliId], references: [id], onDelete: Restrict)
- thaliId    String
+ category   ThaliCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
+ categoryId String
  product    Product       @relation(fields: [productId], references: [id], onDelete: Restrict)
  productId  String

- @@unique([menuId, thaliId, productId])
+ @@unique([menuId, categoryId, productId])
}
```

**Why move this row from `thaliId` to `categoryId` instead of keeping `thaliId` and just writing the same row three times under the hood:** Three duplicate rows (one per thali in the category) would work too, but it reintroduces exactly the duplication problem at the data layer — three rows to keep in sync, three rows to delete/recreate on every menu edit. Storing it once per **category** means there is truly one source of truth for "what sabji is available for the Gujarati Thali group today," and the public menu page (Section 8) does the fan-out at *read* time by mapping `thali.categoryId → sabjiOptions`. This also makes `DailyMenuSabjiOption` rows roughly 3x fewer in a typical day, which is a nice side effect, not the main point.

### 3.4 `DailyMenuThali` — no schema change needed

`DailyMenuThali` keeps `thaliId` and `minSabjiRequired` exactly as-is. Each individual thali is still independently toggled on/off for a given day's menu (you might want Small + Full but not Medium on a given day) — the category grouping only affects how **sabji** is configured, not which thalis are offered. `minSabjiRequired` continues to be set from `thali.sabjiCount` (formerly `maxSabjiCount`) at save time, unchanged from current behavior.

### 3.5 `MenuTemplate.sabjiConfig` (JSON, no schema change)

The shape of the JSON blob stored in `sabjiConfig` changes from:
```json
[{ "thaliId": "th_123", "productIds": ["p_1", "p_2"] }]
```
to:
```json
[{ "categoryId": "cat_456", "productIds": ["p_1", "p_2"] }]
```
No Prisma schema change here since it's a `Json` column — only the application code that writes/reads it changes (Section 7.5).

### 3.6 Full updated schema diff block

```prisma
// ─────────────────────────────────────────
// THALI CATEGORIES  (NEW)
// ─────────────────────────────────────────
model ThaliCategory {
  id        String   @id @default(cuid())
  name      String   @unique
  nameGu    String?
  isActive  Boolean  @default(true)
  thalis    Thali[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─────────────────────────────────────────
// THALIS (Meal combinations)
// ─────────────────────────────────────────
model Thali {
  id             String                 @id @default(cuid())
  name           String                 @unique
  nameGu         String?
  price          Float
  description    String?
  sabjiCount     Int                    @default(1) // exact sabji count, 0–3 — not a "max"
  isActive       Boolean                @default(true)
  category       ThaliCategory?         @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  categoryId     String?
  items          ThaliItem[]
  sabjiPool      ThaliSabjiProduct[]
  dailyMenus     DailyMenuThali[]
  dailySabjiOpts DailyMenuSabjiOption[]
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt
}

// (ThaliItem, ThaliSabjiProduct, Product — unchanged)

// Which sabji options are available per CATEGORY per daily menu
model DailyMenuSabjiOption {
  id         String        @id @default(cuid())
  menu       DailyMenu     @relation(fields: [menuId], references: [id], onDelete: Cascade)
  menuId     String
  category   ThaliCategory @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  categoryId String
  product    Product       @relation(fields: [productId], references: [id], onDelete: Restrict)
  productId  String

  @@unique([menuId, categoryId, productId])
}
```

---

## 4. Migration Strategy — Clean Reset (per your confirmation)

Since this isn't in production yet, skip incremental `ALTER TABLE` migrations for the renamed/restructured fields and do a clean reset:

```bash
# 1. Drop and recreate the dev database schema from scratch
npx prisma migrate reset --force

# 2. Update prisma/schema.prisma with the diffs from Section 3.6

# 3. Generate a fresh migration
npx prisma migrate dev --name thali_categories_and_sabji_rename

# 4. Re-seed
npx prisma db seed
```

If there is any data in a shared/staging database you care about keeping (companies, users, staff, products), **do not** run `migrate reset` against it — instead run a manual cleanup script that only truncates the affected tables:

```sql
TRUNCATE TABLE "DailyMenuSabjiOption", "DailyMenuThali", "DailyMenu",
               "ThaliSabjiProduct", "ThaliItem", "Thali", "MenuTemplate"
RESTART IDENTITY CASCADE;
```

This wipes thalis, daily menus, and templates (exactly the tables affected by this change) while leaving `Company`, `User`, `Product`, `Staff`, `AppUser` untouched. Run this **before** `prisma migrate dev` if you want a guaranteed-clean slate without losing unrelated data.

---

## 5. New API: Thali Categories

### 5.1 `src/app/api/thali-categories/route.ts` (NEW)

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const isActiveParam = searchParams.get("isActive");
    const where: Record<string, unknown> = {};
    if (isActiveParam !== null && isActiveParam !== "") {
      where.isActive = isActiveParam === "true";
    }

    const categories = await prisma.thaliCategory.findMany({
      where,
      orderBy: { createdAt: "asc" },
      include: {
        thalis: {
          select: { id: true, name: true, nameGu: true, sabjiCount: true, isActive: true },
        },
      },
    });

    return NextResponse.json({ categories });
  } catch (error) {
    console.error("[THALI-CATEGORIES GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, nameGu, thaliIds } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const category = await prisma.thaliCategory.create({
      data: {
        name: name.trim(),
        nameGu: nameGu?.trim() || null,
        thalis: Array.isArray(thaliIds) && thaliIds.length > 0
          ? { connect: thaliIds.map((id: string) => ({ id })) }
          : undefined,
      },
      include: { thalis: true },
    });

    return NextResponse.json({ category }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    console.error("[THALI-CATEGORIES POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Key design point:** assigning a thali to a category is done via `thaliIds: string[]` on the category payload, using Prisma's `connect`. Because `Thali.categoryId` is a single nullable foreign key (not a join table — matches your "one category only" answer), connecting a thali to category B automatically detaches it from category A. No extra cleanup code needed; this is exactly the behavior you want.

### 5.2 `src/app/api/thali-categories/[id]/route.ts` (NEW)

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { name, nameGu, isActive, thaliIds } = await req.json();

    // Replace the full set of assigned thalis: disconnect all current members,
    // then connect exactly the incoming list. This makes the "assign these thalis
    // to this category" UI behave as a full replace, not an incremental add.
    const current = await prisma.thaliCategory.findUnique({
      where: { id },
      include: { thalis: { select: { id: true } } },
    });
    if (!current) return NextResponse.json({ error: "Category not found" }, { status: 404 });

    const category = await prisma.thaliCategory.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(nameGu !== undefined && { nameGu: nameGu?.trim() || null }),
        ...(isActive !== undefined && { isActive }),
        ...(Array.isArray(thaliIds) && {
          thalis: {
            disconnect: current.thalis.map((t) => ({ id: t.id })),
            connect: thaliIds.map((tid: string) => ({ id: tid })),
          },
        }),
      },
      include: { thalis: true },
    });

    return NextResponse.json({ category });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    console.error("[THALI-CATEGORIES PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    // Thali.categoryId uses onDelete: SetNull, so deleting a category
    // un-categorizes its thalis rather than deleting them or failing.
    await prisma.thaliCategory.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }
    console.error("[THALI-CATEGORIES DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

## 6. Catalog UI — New "Categories" Tab

### 6.1 `src/app/(admin)/catalog/page.tsx` — add 4th tab

```diff
import ProductsTab from "./_ProductsTab";
import ThalisTab from "./_ThalisTab";
import StaffTab from "./_StaffTab";
+import CategoriesTab from "./_CategoriesTab";

-type Tab = "products" | "thalis" | "staff";
+type Tab = "products" | "thalis" | "categories" | "staff";

const tabs: { key: Tab; label: string; emoji: string }[] = [
  { key: "products", label: "Products", emoji: "🥘" },
  { key: "thalis", label: "Thalis", emoji: "🍱" },
+ { key: "categories", label: "Categories", emoji: "🗂️" },
  { key: "staff", label: "Staff", emoji: "👤" },
];

  {activeTab === "products" && <ProductsTab />}
  {activeTab === "thalis" && <ThalisTab />}
+ {activeTab === "categories" && <CategoriesTab />}
  {activeTab === "staff" && <StaffTab />}
```

Placed right after "Thalis" in the tab order, since you create thalis first, then group them — that matches the natural workflow you described.

### 6.2 `src/app/(admin)/catalog/_CategoriesTab.tsx` (NEW)

Mirrors the structure of `_ThalisTab.tsx` exactly (same `Table`, `Button`, `ConfirmDialog`, `useToast` patterns) so it feels native to the existing codebase:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import Table, { Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import { ActiveBadge } from "@/components/ui/Badge";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import CategoryModal from "@/components/modals/CategoryModal";
import { useToast } from "@/hooks/useToast";

interface CategoryThali { id: string; name: string; nameGu?: string | null; sabjiCount: number; isActive: boolean }
interface Category {
  id: string;
  name: string;
  nameGu?: string | null;
  isActive: boolean;
  thalis: CategoryThali[];
}

export default function CategoriesTab() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchCategories = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/thali-categories");
      const json = await res.json();
      setCategories(json.categories ?? []);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchCategories(); /* eslint-disable-next-line */ }, []);

  const handleToggle = async (cat: Category) => {
    setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, isActive: !c.isActive } : c));
    try {
      const res = await fetch(`/api/thali-categories/${cat.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success(cat.isActive ? "Deactivated" : "Activated");
    } catch (err: unknown) {
      setCategories((prev) => prev.map((c) => c.id === cat.id ? { ...c, isActive: cat.isActive } : c));
      toast.error(err instanceof Error ? err.message : "Toggle failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/thali-categories/${deleteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      toast.success("Category deleted — its thalis are now uncategorized");
      setDeleteId(null);
      fetchCategories();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: Column<Category>[] = [
    {
      key: "name",
      header: "Category Name",
      render: (row) => (
        <div>
          <span className="font-medium text-gray-900 block">{row.name}</span>
          {row.nameGu && <span className="text-xs text-gray-400 font-normal">{row.nameGu}</span>}
        </div>
      ),
    },
    {
      key: "thalis",
      header: "Assigned Thalis",
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.thalis.length === 0 ? (
            <span className="text-xs text-gray-400 italic">No thalis assigned</span>
          ) : (
            row.thalis.map((t) => (
              <span key={t.id} className="text-[11px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-150">
                {t.name}
              </span>
            ))
          )}
        </div>
      ),
    },
    { key: "status", header: "Status", render: (row) => <ActiveBadge isActive={row.isActive} /> },
    {
      key: "actions",
      header: "Actions",
      width: "w-28",
      render: (row) => (
        <div className="flex gap-1">
          <button onClick={() => handleToggle(row)} className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg cursor-pointer">
            {row.isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
          </button>
          <button onClick={() => { setEditCategory(row); setModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg cursor-pointer">
            <Pencil size={15} />
          </button>
          <button onClick={() => setDeleteId(row.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg cursor-pointer">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Thali Categories</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Group thalis that share the same sabji choices (e.g. Small / Medium / Full Gujarati Thali)
          </p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={16} />} onClick={() => { setEditCategory(null); setModalOpen(true); }}>
          Add Category
        </Button>
      </div>

      <Table
        columns={columns}
        data={categories}
        isLoading={isLoading}
        emptyMessage="No categories found"
        emptySubMessage="Create a category to group thalis with shared sabji options"
      />

      {modalOpen && (
        <CategoryModal
          isOpen={modalOpen}
          onClose={() => { setModalOpen(false); setEditCategory(null); }}
          onSuccess={fetchCategories}
          category={editCategory}
        />
      )}

      {deleteId && (
        <ConfirmDialog
          isOpen={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={handleDelete}
          isLoading={isDeleting}
          message="Delete this category? Thalis assigned to it will become uncategorized (not deleted)."
        />
      )}
    </div>
  );
}
```

### 6.3 `src/components/modals/CategoryModal.tsx` (NEW)

This is where you "create one category and assign thalis to it" — a multi-select checklist of all thalis, defaulting to whichever thalis are currently assigned (for edit mode):

```tsx
"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

interface CategoryThali { id: string; name: string; nameGu?: string | null }
interface Category {
  id: string;
  name: string;
  nameGu?: string | null;
  thalis: CategoryThali[];
}
interface AllThali { id: string; name: string; nameGu?: string | null; categoryId?: string | null }

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  category?: Category | null;
}

export default function CategoryModal({ isOpen, onClose, onSuccess, category }: CategoryModalProps) {
  const toast = useToast();
  const isEdit = !!category;

  const [name, setName] = useState("");
  const [nameGu, setNameGu] = useState("");
  const [allThalis, setAllThalis] = useState<AllThali[]>([]);
  const [selectedThaliIds, setSelectedThaliIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setName(category?.name ?? "");
    setNameGu(category?.nameGu ?? "");
    setSelectedThaliIds(category?.thalis?.map((t) => t.id) ?? []);
    setErrors({});

    // Load all thalis so we can show "already in another category" hints
    fetch("/api/thalis").then((r) => r.json()).then((j) => setAllThalis(j.thalis ?? []));
  }, [isOpen, category]);

  const toggleThali = (id: string) => {
    setSelectedThaliIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Category name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/thali-categories/${category.id}` : "/api/thali-categories";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nameGu: nameGu.trim() || null,
          thaliIds: selectedThaliIds,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(isEdit ? "Category updated!" : "Category created!");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Category" : "Add Category"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {isEdit ? "Save Changes" : "Save Category"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Category Name" placeholder="e.g. Gujarati Thali" required value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input label="નામ (Gujarati Name)" placeholder="દા.ત. ગુજરાતી થાળી" value={nameGu} onChange={(e) => setNameGu(e.target.value)} />

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">
            Assign Thalis <span className="text-gray-400 font-normal text-xs">(a thali belongs to one category at a time)</span>
          </p>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 border border-gray-150 rounded-xl p-2">
            {allThalis.length === 0 && <p className="text-xs text-gray-400 italic p-2">No thalis created yet.</p>}
            {allThalis.map((t) => {
              const isChecked = selectedThaliIds.includes(t.id);
              const belongsElsewhere = t.categoryId && t.categoryId !== category?.id;
              return (
                <label key={t.id} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleThali(t.id)}
                    className="rounded text-orange-500 focus:ring-orange-500 border-gray-300"
                  />
                  <span className="text-sm text-gray-800 flex-1">{t.name}</span>
                  {belongsElsewhere && !isChecked && (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-150">
                      In another category
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <p className="text-xs text-blue-700">
            💡 Checking a thali here moves it into this category, even if it was previously in another one.
          </p>
        </div>
      </div>
    </Modal>
  );
}
```

### 6.4 `ThaliModal.tsx` — add category select + relabel sabji field

```diff
+ const [categoryId, setCategoryId] = useState<string>("");
+ const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (isOpen) {
      setName(thali?.name ?? "");
      ...
-     setMaxSabjiCount((thali?.maxSabjiCount ?? 1).toString());
+     setSabjiCount((thali?.sabjiCount ?? 1).toString());
+     setCategoryId(thali?.categoryId ?? "");
+     fetch("/api/thali-categories?isActive=true").then((r) => r.json()).then((j) =>
+       setCategories((j.categories ?? []).map((c: any) => ({ id: c.id, name: c.name })))
+     );
    }
  }, [isOpen, thali]);
```

```diff
- const sabjiOptions = [
-   { value: "0", label: "0 — No sabji choice (fixed items only)" },
-   { value: "1", label: "1 — Pick 1 sabji" },
-   { value: "2", label: "2 — Pick 2 sabji" },
-   { value: "3", label: "3 — Pick 3 sabji" },
- ];
+ const sabjiCountOptions = [
+   { value: "0", label: "0 — No sabji (fixed items only)" },
+   { value: "1", label: "1 sabji included" },
+   { value: "2", label: "2 sabji included" },
+   { value: "3", label: "3 sabji included" },
+ ];
```

```diff
- <Select label="Max Sabji Choice" required options={sabjiOptions} value={maxSabjiCount} onChange={(e) => setMaxSabjiCount(e.target.value)} />
- <p className="text-xs text-gray-400">How many sabji items the customer picks from today's menu options.</p>
+ <Select label="Sabji Count" required options={sabjiCountOptions} value={sabjiCount} onChange={(e) => setSabjiCount(e.target.value)} />
+ <p className="text-xs text-gray-400">Exact number of sabji included with this thali — not a maximum.</p>
```

Add the category select right above or beside the sabji count select:

```tsx
<div className="space-y-1">
  <Select
    label="Category"
    options={[{ value: "", label: "— No category —" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
    value={categoryId}
    onChange={(e) => setCategoryId(e.target.value)}
  />
  <p className="text-xs text-gray-400">
    Thalis in the same category share one sabji selection on the Daily Menu screen.
  </p>
</div>
```

And in `onSubmit`, include `categoryId: categoryId || null` and `sabjiCount: Number(sabjiCount)` in the POST/PUT body (replacing `maxSabjiCount`).

### 6.5 `_ThalisTab.tsx` — show category as a column

Add a column between "Thali Name" and "Price":

```tsx
{
  key: "category",
  header: "Category",
  render: (row) => row.category ? (
    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-150">
      {row.category.name}
    </span>
  ) : (
    <span className="text-xs text-gray-400 italic">Uncategorized</span>
  ),
},
```

(Requires the thalis list endpoint to `include: { category: true }` — see Section 9.1.)

---

## 7. Daily Menu Screen — Per-Category Sabji Configuration

This is the core UX change. Today's loop is "for each checked thali, render a SabjiPicker." The new loop is "for each **category that has at least one checked thali**, render one SabjiPicker — shared by all checked thalis in that category."

### 7.1 New local state shape

```diff
- const [lunchSabjiMap, setLunchSabjiMap] = useState<Record<string, string[]>>({}); // thaliId -> productIds
+ const [lunchSabjiMap, setLunchSabjiMap] = useState<Record<string, string[]>>({}); // categoryId -> productIds
```

The variable name and shape (`Record<string, string[]>`) don't need to change — only the **meaning of the key** changes from `thaliId` to `categoryId`. This keeps the diff small. Apply the same to `dinnerSabjiMap`.

### 7.2 Grouping checked thalis by category

Add a derived grouping helper near the top of the component:

```tsx
interface ThaliCategory { id: string; name: string; nameGu?: string | null }
interface Thali {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
  description?: string | null;
  sabjiCount: number;          // renamed from maxSabjiCount
  categoryId: string | null;
  category?: ThaliCategory | null;
  items: ThaliItem[];
}

// Groups the currently-checked thalis by category.
// Uncategorized thalis (categoryId === null) each form their OWN single-thali group,
// keyed by the thali's own id, so they still render individually — this only matters
// if a thali was never assigned a category, which the UI also warns about (7.4).
function groupThalisByCategory(checkedThaliIds: string[], allThalis: Thali[]) {
  const groups: { key: string; label: string; thalis: Thali[]; sabjiCount: number }[] = [];
  const byCategory = new Map<string, Thali[]>();

  for (const id of checkedThaliIds) {
    const thali = allThalis.find((t) => t.id === id);
    if (!thali) continue;
    const groupKey = thali.categoryId ?? `__uncategorized_${thali.id}`;
    if (!byCategory.has(groupKey)) byCategory.set(groupKey, []);
    byCategory.get(groupKey)!.push(thali);
  }

  for (const [key, thalis] of byCategory) {
    const label = thalis[0].category?.name ?? thalis[0].name;
    // sabjiCount must be identical across all thalis in a category — see validation in 7.3
    const sabjiCount = Math.max(...thalis.map((t) => t.sabjiCount));
    groups.push({ key, label, thalis, sabjiCount });
  }
  return groups;
}
```

### 7.3 Validation: sabji count must match within a category

Because the sabji picker is now shared, every thali in a category must agree on how many sabji slots there are (you can't ask "pick 2 sabji" once and have it mean "pick 1" for one thali and "pick 3" for another in the same picker). Add this check at save time (`handleSaveMenu`) and, more importantly, surface it proactively in the UI as thalis are checked — catching it at category-creation time is even better, but a save-time guard is the safety net:

```tsx
const validateCategorySabjiConsistency = (thaliIds: string[]): string | null => {
  const groups = groupThalisByCategory(thaliIds, allThalis);
  for (const group of groups) {
    const counts = new Set(group.thalis.map((t) => t.sabjiCount));
    if (counts.size > 1) {
      return `"${group.label}" has thalis with different sabji counts (${[...counts].join(", ")}). All thalis in a category must use the same sabji count.`;
    }
  }
  return null;
};
```

Call this inside `handleSaveMenu`, before the existing `thaliIds.length === 0` check:

```tsx
const consistencyError = validateCategorySabjiConsistency(thaliIds);
if (consistencyError) {
  toast.error(consistencyError);
  return;
}
```

**Why this matters for your Gujarati Thali example specifically:** Small/Medium/Full Gujarati Thali sharing one sabji picker only makes sense if they all want, say, "exactly 1 sabji." If Full Gujarati Thali is supposed to come with 2 sabji and the others with 1, they shouldn't be in the same category — that's a modeling signal, not just a UI inconvenience, and this validation surfaces that immediately instead of silently misconfiguring orders.

### 7.4 Rendering — replace the per-thali picker block with per-category

Current code (`menu/page.tsx`, inside the thali checklist `.map()`):

```tsx
{isChecked && thali.maxSabjiCount > 0 && (
  <div className="pt-2 border-t border-gray-100">
    <SabjiPicker
      products={allProducts}
      selected={dinnerSabjiMap[thali.id] ?? []}
      onChange={(ids) => handleSabjiChange("DINNER", thali.id, ids)}
      maxCount={thali.maxSabjiCount}
      label="Configure Sabjis for Daily Menu:"
    />
  </div>
)}
```

This block is **removed from inside the per-thali `.map()` entirely**. The thali checklist becomes purely "which thalis are on today's menu" (checkboxes only, no inline picker). Below the checklist, add a new section that renders one picker per category:

```tsx
{/* Select Thalis checkboxes — picker-free now */}
<div className="space-y-2.5">
  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Thalis:</p>
  <div className="space-y-1.5">
    {allThalis.map((thali) => {
      const isChecked = dinnerThalis.includes(thali.id);
      return (
        <label key={thali.id} className="flex items-start gap-3 cursor-pointer border border-gray-150 rounded-xl p-3 bg-white">
          <input type="checkbox" checked={isChecked} onChange={() => handleToggleThali("DINNER", thali.id)}
            className="mt-0.5 rounded text-orange-500 focus:ring-orange-500 border-gray-300" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-800">
                {thali.name}
                {thali.nameGu && <span className="text-xs text-gray-400 font-normal ml-1.5">({thali.nameGu})</span>}
              </span>
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                {formatCurrency(thali.price)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              {thali.description && <p className="text-xs text-gray-500 font-normal">{thali.description}</p>}
              {thali.category ? (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-50 text-orange-600 border border-orange-150">
                  {thali.category.name}
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-150">
                  ⚠ Uncategorized — won&apos;t share sabji picker
                </span>
              )}
            </div>
          </div>
        </label>
      );
    })}
  </div>
</div>

{/* NEW: One sabji picker per category, shared by all checked thalis in it */}
{groupThalisByCategory(dinnerThalis, allThalis).filter((g) => g.sabjiCount > 0).length > 0 && (
  <div className="space-y-2.5 pt-2">
    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Configure Sabji (per category):</p>
    <div className="space-y-3">
      {groupThalisByCategory(dinnerThalis, allThalis)
        .filter((g) => g.sabjiCount > 0)
        .map((group) => (
          <div key={group.key} className="border border-gray-150 rounded-xl p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-800">{group.label}</span>
              <span className="text-[10px] text-gray-400">
                Applies to: {group.thalis.map((t) => t.name).join(", ")}
              </span>
            </div>
            <SabjiPicker
              products={allProducts}
              selected={dinnerSabjiMap[group.key] ?? []}
              onChange={(ids) => handleSabjiChange("DINNER", group.key, ids)}
              maxCount={group.sabjiCount}
              label="Configure Sabjis for Daily Menu:"
            />
          </div>
        ))}
    </div>
  </div>
)}
```

`handleSabjiChange` itself needs **no internal change** — it already takes an arbitrary string key and an array of ids (`Record<string, string[]>`); it simply now receives a `categoryId` (or the synthetic `__uncategorized_<id>` key) instead of a `thaliId`. Same applies to Lunch, mirrored.

### 7.5 Saving — convert category-keyed map into the API payload

`handleSaveMenu` currently builds:
```tsx
const sabjiOptions = thaliIds
  .filter((tid) => { const t = allThalis.find((th) => th.id === tid); return t && t.maxSabjiCount > 0; })
  .map((tid) => ({ thaliId: tid, productIds: sabjiMap[tid] ?? [] }));
```

New version groups by category first, then emits one entry **per category** (not per thali):

```tsx
const groups = groupThalisByCategory(thaliIds, allThalis);
const sabjiOptions = groups
  .filter((g) => g.sabjiCount > 0)
  .map((g) => ({
    categoryId: g.thalis[0].categoryId, // null/synthetic groups are filtered out below
    productIds: sabjiMap[g.key] ?? [],
  }))
  .filter((opt) => !!opt.categoryId); // uncategorized thalis can't save sabji options — caught by 7.3-style warning instead
```

If you'd rather hard-block saving a menu that includes an uncategorized thali with `sabjiCount > 0` (instead of silently dropping its sabji options), add this guard right next to the consistency check in 7.3:

```tsx
const uncategorizedWithSabji = thaliIds
  .map((id) => allThalis.find((t) => t.id === id))
  .filter((t) => t && !t.categoryId && t.sabjiCount > 0);
if (uncategorizedWithSabji.length > 0) {
  toast.error(`Assign a category to: ${uncategorizedWithSabji.map((t) => t!.name).join(", ")} before adding it to a menu.`);
  return;
}
```

This is the recommended option — it keeps the menu screen's invariant simple ("every sabji-bearing thali on a menu has a category") and pushes the cleanup back to the Catalog tab where it belongs, rather than letting a menu go out with silently-missing sabji options.

### 7.6 `handleCopyFromYesterday` and `handleLoadTemplate`

Both functions currently build `sabjis[opt.thaliId] = ...productIds`. Change to `sabjis[opt.categoryId] = ...productIds` (renaming the loop variable accordingly):

```diff
const sabjis: Record<string, string[]> = {};
menu.sabjiOptions.forEach((opt) => {
- if (!sabjis[opt.thaliId]) sabjis[opt.thaliId] = [];
- sabjis[opt.thaliId].push(opt.productId);
+ if (!sabjis[opt.categoryId]) sabjis[opt.categoryId] = [];
+ sabjis[opt.categoryId].push(opt.productId);
});
```

Same change applies in `fetchMenuData`'s population of `lunchSabjiMap`/`dinnerSabjiMap` from the fetched menu (lines ~128–151 in the current file), and in `handleSaveAsTemplate`'s `sabjiConfig` builder (Section 7.7 below).

### 7.7 `handleSaveAsTemplate` / `handleLoadTemplate` — category-based `sabjiConfig`

```diff
const sabjiConfig = thaliIds.map((tid) => ({
- thaliId: tid,
- productIds: sabjiMap[tid] ?? [],
- minRequired: 1,
}));
```
becomes:
```tsx
const groups = groupThalisByCategory(thaliIds, allThalis);
const sabjiConfig = groups
  .filter((g) => g.sabjiCount > 0 && g.thalis[0].categoryId)
  .map((g) => ({
    categoryId: g.thalis[0].categoryId,
    productIds: sabjiMap[g.key] ?? [],
  }));
```

And in `handleLoadTemplate`, the line `sabjis[cfg.thaliId] = cfg.productIds;` becomes `sabjis[cfg.categoryId] = cfg.productIds;`.

---

## 8. API Changes — Menu Routes & Public Menu Page

### 8.1 `src/app/api/menu/route.ts` (POST) and `[id]/route.ts` (PUT)

Both currently do:
```ts
sabjiOptions: {
  create: (sabjiOptions as { thaliId: string; productIds: string[] }[]).flatMap(
    ({ thaliId, productIds }) => productIds.map((productId) => ({ thaliId, productId }))
  ),
},
```
Change the type and field name only — the `flatMap` shape is otherwise identical:
```ts
sabjiOptions: {
  create: (sabjiOptions as { categoryId: string; productIds: string[] }[]).flatMap(
    ({ categoryId, productIds }) => productIds.map((productId) => ({ categoryId, productId }))
  ),
},
```

Also update the two `include` blocks (GET, POST, PUT, and the `[id]` GET) that currently do `sabjiOptions: { include: { product: true, thali: true } }` → `sabjiOptions: { include: { product: true, category: true } }`.

The `thaliMap`/`minSabjiRequired` logic (`thaliMap.get(thaliId) ?? 1` keyed off `t.maxSabjiCount`) stays **per-thali** and unaffected — `DailyMenuThali.minSabjiRequired` is still set from each individual thali's own `sabjiCount` (renamed field), since `DailyMenuThali` didn't change shape (Section 3.4). Just update the property read from `t.maxSabjiCount` to `t.sabjiCount`.

### 8.2 `src/app/api/menu-templates/route.ts` + `[id]/route.ts`

No schema change (still a `Json` column), but anywhere the route does validation or transformation on `sabjiConfig` entries referencing `thaliId`, rename to `categoryId` for consistency with what the frontend now sends. If the route currently passes the JSON through untouched (likely, given it's stored as opaque `Json`), no code change is needed here at all — confirm by checking the route body before assuming a change is required.

### 8.3 `src/app/menu/[slug]/page.tsx` — the customer-facing page

This is the most behaviorally important change outside the admin screen, since it's what actual customers interact with.

**Type updates:**
```diff
interface Thali {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
- maxSabjiCount: number;
+ sabjiCount: number;
+ categoryId: string | null;
  items: ThaliItem[];
- sabjiPool: { product: Product }[];
}

interface DailyMenuSabjiOption {
  id: string;
- thaliId: string;
+ categoryId: string;
  productId: string;
  product: Product;
}
```

**The filter that drives the sabji list shown to the customer** — this is the line that makes the whole feature pay off for the end user, since it's what makes Small/Medium/Full Gujarati Thali show the *same* sabji list without the admin configuring it three times:

```diff
{menu.sabjiOptions
-  .filter((opt) => opt.thaliId === selectedMenuThali.thali.id)
+  .filter((opt) => opt.categoryId === selectedMenuThali.thali.categoryId)
   .map((opt) => { ... })}
```

And the empty-state check just below it:
```diff
- {menu.sabjiOptions.filter((opt) => opt.thaliId === selectedMenuThali.thali.id).length === 0 && (
+ {menu.sabjiOptions.filter((opt) => opt.categoryId === selectedMenuThali.thali.categoryId).length === 0 && (
```

And the WhatsApp message builder (`getWhatsAppLink`):
```diff
- const opt = menu.sabjiOptions.find((o) => o.productId === id);
+ const opt = menu.sabjiOptions.find((o) => o.productId === id && o.categoryId === thali.categoryId);
```
(Adding the `categoryId` match here guards against an edge case where the same product happens to be selected for two different categories with overlapping `productId`s — without it, `.find()` could return the wrong category's row. Practically rare since products usually differ per category, but cheap to guard against.)

All other references to `thali.maxSabjiCount` in this file (the "Choice of N Sabji" label, the `Pick X of Y` counter, `validateOrder`, the button's "Please select N sabji(s)" text) get a simple find-and-replace to `thali.sabjiCount` — no logic changes, since the count itself is still read per-thali (every thali still independently declares how many sabji it includes; only the *pool of choices* is shared via category).

### 8.4 `src/app/api/public/menu/[slug]/route.ts`

Check this route's `include` — it almost certainly mirrors the admin menu GET (`sabjiOptions: { include: { product: true, thali: true } }`). Update to `include: { product: true, category: true }` and make sure the `Thali` selection in `thalis: { include: { thali: ... } } }` includes `categoryId` (it will by default unless the route uses an explicit `select`).

---

## 9. Supporting Changes

### 9.1 `src/app/api/thalis/route.ts` + `[id]/route.ts` + `bulk/route.ts`

- `GET`: add `category: true` to the `include` block so the Catalog Thalis tab and Daily Menu page can read `thali.category.name` / `thali.categoryId`.
- `POST`/`PUT`: accept `categoryId` (nullable) and `sabjiCount` (renamed from `maxSabjiCount`) in the request body; same 0–3 range validation, just renamed:
  ```diff
  - const { name, nameGu, price, description, maxSabjiCount, items } = await req.json();
  + const { name, nameGu, price, description, sabjiCount, categoryId, items } = await req.json();
    ...
  - const maxCount = Number(maxSabjiCount ?? 1);
  - if (maxCount < 0 || maxCount > 3) { ... "Max sabji count must be between 0 and 3" ... }
  + const count = Number(sabjiCount ?? 1);
  + if (count < 0 || count > 3) {
  +   return NextResponse.json({ error: "Sabji count must be between 0 and 3" }, { status: 400 });
  + }
    ...
    data: {
      ...
  -   maxSabjiCount: maxCount,
  +   sabjiCount: count,
  +   categoryId: categoryId || null,
    }
  ```
- `bulk/route.ts` (CSV import): if the bulk thali importer's CSV columns reference `maxSabjiCount`, rename the expected column header to `sabjiCount` and add an optional `categoryName` column that looks up (or optionally creates) a `ThaliCategory` by name. This is a nice-to-have for bulk workflows — flagged here so it isn't forgotten, but can be deferred to a follow-up since your immediate need is the admin UI flow, not bulk CSV upload of categories.

### 9.2 `src/types/index.ts`

```diff
+ export interface ThaliCategory {
+   id: string;
+   name: string;
+   nameGu?: string | null;
+   isActive: boolean;
+   thalis?: Thali[];
+   createdAt: string;
+   updatedAt: string;
+ }

export interface Thali {
  id: string;
  name: string;
  price: number;
  description?: string | null;
- maxSabjiCount: number;
+ sabjiCount: number;
+ categoryId?: string | null;
+ category?: ThaliCategory | null;
  isActive: boolean;
  items: ThaliItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateThaliInput {
  name: string;
  price: number;
  description?: string;
- maxSabjiCount: number;
+ sabjiCount: number;
+ categoryId?: string | null;
  items: string[];
}

export interface SabjiOption {
- thaliId: string;
+ categoryId: string;
  productIds: string[];
}

export interface DailyMenuSabjiOption {
  id: string;
  menuId: string;
- thaliId: string;
+ categoryId: string;
  productId: string;
- thali: Thali;
+ category: ThaliCategory;
  product: Product;
}
```

### 9.3 `prisma/seed.ts`

Update the seed script to:
1. Create a handful of `ThaliCategory` rows first (e.g. "Gujarati Thali", "Punjabi Thali", or whatever your real categories are).
2. Create thalis with `categoryId` pointing at the matching category and `sabjiCount` (renamed) instead of `maxSabjiCount`.
3. Remove any seeded `DailyMenu`/`DailyMenuSabjiOption` rows that reference the old `thaliId`-keyed shape, since those tables are part of the clean reset (Section 4).

### 9.4 `src/hooks/useSabjiSearch.ts`

No change expected — it operates purely on the `products` array passed into `SabjiPicker` and has no awareness of thalis or categories. Worth a quick read-through to confirm it doesn't key anything by `thaliId` internally (it shouldn't, based on the component's prop contract), but flagged here for completeness rather than as a confirmed change.

---

## 10. Build Order

Sequenced so the app stays buildable at each step (schema → API → catalog UI → menu UI → public page), matching how `third_implementation.md` phased its own rollout in this same repo:

1. **Schema** — apply the diff in Section 3.6, run the clean reset (Section 4).
2. **Thali Categories API** — `src/app/api/thali-categories/route.ts` + `[id]/route.ts` (Section 5).
3. **Thalis API rename** — `sabjiCount`/`categoryId` in `thalis/route.ts`, `thalis/[id]/route.ts` (Section 9.1).
4. **Catalog UI** — `_CategoriesTab.tsx`, `CategoryModal.tsx`, wire into `catalog/page.tsx`; update `ThaliModal.tsx` and `_ThalisTab.tsx` (Section 6).
5. **Seed data** — update `prisma/seed.ts`, run `prisma db seed`, manually verify Categories tab shows real groupings.
6. **Menu API** — `menu/route.ts`, `menu/[id]/route.ts`, `menu-templates/*` switch to `categoryId` (Section 8.1–8.2).
7. **Menu admin UI** — the grouping/rendering/save logic in `menu/page.tsx` (Section 7) — this is the biggest single-file change in the plan.
8. **Public menu page** — `menu/[slug]/page.tsx` + `api/public/menu/[slug]/route.ts` (Section 8.3–8.4).
9. **Manual QA pass** — Section 11.

---

## 11. Acceptance Criteria

- [ ] Catalog → Categories tab exists; can create a category, assign multiple thalis to it, and re-assign a thali from one category to another (old category loses it automatically).
- [ ] Deleting a category does **not** delete its thalis — they become "Uncategorized" (`categoryId: null`).
- [ ] Catalog → Thalis tab shows each thali's category as a column; `ThaliModal` lets you set/change a thali's category and its sabji count (relabeled, no "max" wording).
- [ ] Daily Menu screen: checking Small + Medium + Full Gujarati Thali (all in the "Gujarati Thali" category) shows **exactly one** sabji picker labeled "Gujarati Thali," not three.
- [ ] That one picker's selections apply to all three thalis — verified by saving the menu, then checking the public `/menu/[slug]` page shows the **same** sabji choices under each of the three thalis.
- [ ] Checking two thalis from two different categories shows **two** separate pickers.
- [ ] Saving a menu with a category whose member thalis have mismatched `sabjiCount` values is blocked with a clear error naming the category (Section 7.3).
- [ ] Saving a menu with an uncategorized thali that has `sabjiCount > 0` is blocked with a clear error naming the thali (Section 7.5).
- [ ] "Copy Yesterday" and "Load Template" correctly restore the category-keyed sabji map (verified by copying a day that has a multi-thali category configured).
- [ ] Public menu page: switching between Small/Medium/Full Gujarati Thali (same category) keeps the **same sabji choices visible** without needing to reselect — confirms the category-based filter (Section 8.3) is working, not just the admin save path.
- [ ] `npm run lint` and `npx tsc --noEmit` pass with no new errors after the `maxSabjiCount` → `sabjiCount` rename (this rename touches the most files, so it's the most likely source of a missed reference).

---

## 12. Explicitly Deferred (not required for this build)

- Bulk CSV import support for category assignment (`bulk/route.ts` — flagged in 9.1, can stay manual via the UI for now).
- Allowing a thali to belong to more than one category (you confirmed one-category-only; revisit only if a real use case demands it, since it would mean swapping the `categoryId` foreign key for a join table).
- Category-level default pricing or category-level fixed items — out of scope; category is purely a sabji-sharing grouping mechanism per your description, not a pricing or content concept.