# VD's Hunger Hub — Fourth Implementation Plan
## Feature 1: Product Add-Ons During Creation | Feature 2: Zero-Friction Daily Menu

> **Project:** `softvibeservices-vdshungerhub`  
> **Stack:** Next.js 16 · Prisma (PostgreSQL) · Tailwind CSS v4 · React 19 · TypeScript  
> **Scope of this doc:** Two additive features only — nothing existing is broken or removed.

---

## Table of Contents

1. [Feature 1 — Product Add-Ons: What & Why](#1-feature-1--product-add-ons)
2. [Schema Changes: `ProductAddon` model](#2-schema-changes)
3. [Migration SQL](#3-migration-sql)
4. [API Changes: Products Route](#4-api-changes--products-route)
5. [Updated `ProductModal.tsx` — Full Replacement](#5-updated-productmodaltsx)
6. [Updated `_ProductsTab.tsx` — Table Column for Add-Ons](#6-updated-_productstab)
7. [Updated `src/types/index.ts`](#7-updated-types)
8. [Feature 2 — Zero-Friction Menu: What & Why](#8-feature-2--zero-friction-menu)
9. [New `menu/page.tsx` — Full Replacement](#9-new-menupagetsx)
10. [Seed Update for Add-On Sample Data](#10-seed-update)
11. [Checklist: Files Changed](#11-checklist)

---

## 1. Feature 1 — Product Add-Ons

### What is being built

When the admin creates or edits a product (e.g. "Palak Paneer"), he can now:
- **Mark it as available for add-on** (toggle: "Product Available for Add-On")
- **Add add-on items** under it — individual extras like Roti, Buttermilk, Shreekhnd, Jaggery, etc., each with their own name and price

This is **admin-side creation only** — the user ordering flow is out of scope for now.

### Design decisions

- `ProductAddon` is a separate child table referencing `Product` — keeps the `Product` model clean
- The `isAddOnAvailable` boolean flag on `Product` controls whether add-ons are shown/collected for it
- If `isAddOnAvailable = false`, any stored `ProductAddon` rows are still kept in DB but ignored
- The product creation modal gets a new collapsible "Add-On" section at the bottom, clearly separated
- All add-on items are shown as a sortable tag-style list inside the modal

---

## 2. Schema Changes

### 2.1 Updated `Product` model

Add one boolean column: `isAddOnAvailable`.

```prisma
model Product {
  id               String                 @id @default(cuid())
  name             String                 @unique
  nameGu           String?
  quantity         String
  price            Float
  isActive         Boolean                @default(true)
  isAddOnAvailable Boolean                @default(false)   // ← NEW
  addOns           ProductAddon[]                           // ← NEW relation
  thaliSabjiPool   ThaliSabjiProduct[]
  dailySabjiOptions DailyMenuSabjiOption[]
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt
}
```

### 2.2 New `ProductAddon` model

```prisma
model ProductAddon {
  id        String   @id @default(cuid())
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId String
  name      String                  // e.g. "Roti", "Buttermilk", "Shreekhnd"
  price     Float    @default(0)    // add-on price (can be 0 = free)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@unique([productId, name])
}
```

**Why `onDelete: Cascade`?** If a product is deleted, all its add-ons are deleted too — no orphaned rows.

**Why `@@unique([productId, name])`?** No duplicate add-on names under the same product.

### 2.3 Full updated `prisma/schema.prisma` Product section

Replace the existing `Product` model block in `prisma/schema.prisma`:

```prisma
// ─────────────────────────────────────────
// PRODUCT
// ─────────────────────────────────────────
model Product {
  id                String                 @id @default(cuid())
  name              String                 @unique
  nameGu            String?
  quantity          String
  price             Float
  isActive          Boolean                @default(true)
  isAddOnAvailable  Boolean                @default(false)
  addOns            ProductAddon[]
  thaliSabjiPool    ThaliSabjiProduct[]
  dailySabjiOptions DailyMenuSabjiOption[]
  createdAt         DateTime               @default(now())
  updatedAt         DateTime               @updatedAt
}

// ─────────────────────────────────────────
// PRODUCT ADD-ON
// ─────────────────────────────────────────
model ProductAddon {
  id        String   @id @default(cuid())
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  productId String
  name      String
  price     Float    @default(0)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())

  @@unique([productId, name])
}
```

---

## 3. Migration SQL

Create a new migration file at:
`prisma/migrations/20260627000000_product_addons/migration.sql`

```sql
-- Add isAddOnAvailable column to Product
ALTER TABLE "Product" ADD COLUMN "isAddOnAvailable" BOOLEAN NOT NULL DEFAULT false;

-- Create ProductAddon table
CREATE TABLE "ProductAddon" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductAddon_pkey" PRIMARY KEY ("id")
);

-- Unique index: no duplicate add-on name under same product
CREATE UNIQUE INDEX "ProductAddon_productId_name_key" ON "ProductAddon"("productId", "name");

-- Foreign key: cascade on product delete
ALTER TABLE "ProductAddon" ADD CONSTRAINT "ProductAddon_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

**Run after adding the file:**
```bash
npx prisma migrate dev --name product_addons
# OR if you prefer to apply the SQL directly:
npx prisma db push
```

---

## 4. API Changes — Products Route

### 4.1 `src/app/api/products/route.ts` — Update GET and POST

**GET** — include `addOns` in the response:

```ts
// In the findMany call, add include:
const products = await prisma.product.findMany({
  where,
  orderBy: { createdAt: "desc" },
  include: {
    addOns: { orderBy: { sortOrder: "asc" } },  // ← ADD THIS
  },
});
```

**POST** — accept `isAddOnAvailable` and `addOns` array:

```ts
export async function POST(req: NextRequest) {
  try {
    const { name, nameGu, quantity, price, isAddOnAvailable, addOns } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!quantity?.trim()) return NextResponse.json({ error: "Quantity is required" }, { status: 400 });
    if (price === undefined || isNaN(Number(price)) || Number(price) < 0)
      return NextResponse.json({ error: "Valid price is required" }, { status: 400 });

    // Validate add-ons if provided
    const addonList: { name: string; price: number; sortOrder: number }[] = [];
    if (isAddOnAvailable && Array.isArray(addOns)) {
      for (let i = 0; i < addOns.length; i++) {
        const addon = addOns[i];
        if (!addon.name?.trim()) continue; // skip blank entries
        addonList.push({
          name: addon.name.trim(),
          price: Number(addon.price ?? 0),
          sortOrder: i,
        });
      }
    }

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        nameGu: nameGu?.trim() || null,
        quantity: quantity.trim(),
        price: Number(price),
        isAddOnAvailable: Boolean(isAddOnAvailable),
        ...(addonList.length > 0 && {
          addOns: {
            create: addonList,
          },
        }),
      },
      include: {
        addOns: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A product with this name already exists" }, { status: 409 });
    }
    console.error("[PRODUCTS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

### 4.2 `src/app/api/products/[id]/route.ts` — Update PUT

The existing `PUT` needs to handle `isAddOnAvailable` and sync `addOns`.  
Replace the existing `PUT` handler:

```ts
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, nameGu, quantity, price, isActive, isAddOnAvailable, addOns } = await req.json();

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!quantity?.trim()) return NextResponse.json({ error: "Quantity is required" }, { status: 400 });

    // Build add-on list
    const addonList: { name: string; price: number; sortOrder: number }[] = [];
    if (isAddOnAvailable && Array.isArray(addOns)) {
      for (let i = 0; i < addOns.length; i++) {
        const addon = addOns[i];
        if (!addon.name?.trim()) continue;
        addonList.push({
          name: addon.name.trim(),
          price: Number(addon.price ?? 0),
          sortOrder: i,
        });
      }
    }

    // Delete existing add-ons and recreate (simplest strategy for this scale)
    await prisma.productAddon.deleteMany({ where: { productId: id } });

    const product = await prisma.product.update({
      where: { id },
      data: {
        name: name.trim(),
        nameGu: nameGu?.trim() || null,
        quantity: quantity.trim(),
        price: Number(price),
        ...(isActive !== undefined && { isActive }),
        isAddOnAvailable: Boolean(isAddOnAvailable),
        ...(addonList.length > 0 && {
          addOns: {
            create: addonList,
          },
        }),
      },
      include: {
        addOns: { orderBy: { sortOrder: "asc" } },
      },
    });

    return NextResponse.json({ product });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A product with this name already exists" }, { status: 409 });
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    console.error("[PRODUCTS PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

---

## 5. Updated `ProductModal.tsx` — Full Replacement

**File:** `src/components/modals/ProductModal.tsx`

Replace the entire file:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Package } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

// ─── Zod schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  name: z.string().min(1, "Name is required"),
  nameGu: z.string().optional().nullable().transform((val) => val || null),
  quantity: z.string().min(1, "Quantity is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
});
type FormData = z.infer<typeof schema>;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface AddonItem {
  name: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  quantity: string;
  price: number;
  isAddOnAvailable?: boolean;
  addOns?: AddonItem[];
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function ProductModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductModalProps) {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEdit = !!product;

  // Add-On state (managed outside react-hook-form because it's a dynamic list)
  const [isAddOnAvailable, setIsAddOnAvailable] = useState(false);
  const [addOns, setAddOns] = useState<AddonItem[]>([]);
  const [newAddonName, setNewAddonName] = useState("");
  const [newAddonPrice, setNewAddonPrice] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as unknown as Resolver<FormData>,
  });

  // Populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      reset({
        name: product?.name ?? "",
        nameGu: product?.nameGu ?? "",
        quantity: product?.quantity ?? "",
        price: product?.price ?? 0,
      });
      setIsAddOnAvailable(product?.isAddOnAvailable ?? false);
      setAddOns(product?.addOns?.map((a) => ({ name: a.name, price: a.price })) ?? []);
      setNewAddonName("");
      setNewAddonPrice("");
    }
  }, [isOpen, product, reset]);

  // Add a new add-on to the local list
  const handleAddAddon = () => {
    const trimmedName = newAddonName.trim();
    if (!trimmedName) {
      toast.error("Add-on name cannot be empty");
      return;
    }
    if (addOns.some((a) => a.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error(`"${trimmedName}" is already in the list`);
      return;
    }
    setAddOns((prev) => [
      ...prev,
      { name: trimmedName, price: Number(newAddonPrice) || 0 },
    ]);
    setNewAddonName("");
    setNewAddonPrice("");
  };

  const handleAddonKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddAddon();
    }
  };

  const removeAddon = (index: number) => {
    setAddOns((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAddonPrice = (index: number, newPrice: string) => {
    setAddOns((prev) =>
      prev.map((a, i) => (i === index ? { ...a, price: Number(newPrice) || 0 } : a))
    );
  };

  // Submit handler
  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const url = isEdit ? `/api/products/${product.id}` : "/api/products";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          isAddOnAvailable,
          addOns: isAddOnAvailable ? addOns : [],
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(isEdit ? "Product updated!" : "Product added!");
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
      title={isEdit ? "Edit Product" : "Add Product"}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit(onSubmit)}
            isLoading={isSubmitting}
          >
            {isEdit ? "Save Changes" : "Add Product"}
          </Button>
        </>
      }
    >
      {/* ── Info banner ───────────────────────────────────────────────── */}
      <p className="text-xs text-gray-500 mb-4 bg-blue-50 px-3 py-2 rounded-lg border border-blue-100">
        Products are individual sabji / items used in thalis and daily menus.
      </p>

      <div className="space-y-4">
        {/* ── Core fields ───────────────────────────────────────────────── */}
        <Input
          label="Item Name"
          placeholder="e.g. Palak Paneer"
          required
          error={errors.name?.message}
          {...register("name")}
        />
        <Input
          label="નામ (Gujarati Name)"
          placeholder="દા.ત. પાલક પનીર"
          error={errors.nameGu?.message}
          {...register("nameGu")}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            placeholder="e.g. 1 bowl, 4 pcs"
            required
            error={errors.quantity?.message}
            {...register("quantity")}
          />
          <Input
            label="Price (₹)"
            type="number"
            min="0"
            step="0.5"
            required
            error={errors.price?.message}
            {...register("price")}
          />
        </div>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div className="border-t border-gray-100 pt-4">

          {/* Toggle: Product Available for Add-On */}
          <button
            type="button"
            onClick={() => setIsAddOnAvailable((v) => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all cursor-pointer ${
              isAddOnAvailable
                ? "border-orange-400 bg-orange-50"
                : "border-gray-200 bg-gray-50 hover:border-gray-300"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Package
                size={16}
                className={isAddOnAvailable ? "text-orange-500" : "text-gray-400"}
              />
              <div className="text-left">
                <p
                  className={`text-sm font-semibold ${
                    isAddOnAvailable ? "text-orange-700" : "text-gray-700"
                  }`}
                >
                  Product Available for Add-On
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Enable to list extras customers can add with this item
                </p>
              </div>
            </div>
            {/* Toggle pill */}
            <div
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                isAddOnAvailable ? "bg-orange-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isAddOnAvailable ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </button>

          {/* Add-On items section (only shown when toggle is ON) */}
          {isAddOnAvailable && (
            <div className="mt-3 space-y-3 bg-orange-50/60 border border-orange-100 rounded-xl p-3.5">

              {/* Section label */}
              <p className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                Add-On Items
              </p>

              {/* Existing add-ons list */}
              {addOns.length > 0 && (
                <div className="space-y-1.5">
                  {addOns.map((addon, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-white border border-orange-200 rounded-lg px-2.5 py-1.5"
                    >
                      <span className="flex-1 text-sm font-medium text-gray-800 truncate">
                        {addon.name}
                      </span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-xs text-gray-400">₹</span>
                        <input
                          type="number"
                          value={addon.price}
                          onChange={(e) => updateAddonPrice(idx, e.target.value)}
                          min="0"
                          step="0.5"
                          className="w-16 text-xs text-right border border-gray-200 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAddon(idx)}
                        className="p-0.5 text-gray-300 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* New add-on input row */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">
                    Item Name
                  </label>
                  <input
                    type="text"
                    value={newAddonName}
                    onChange={(e) => setNewAddonName(e.target.value)}
                    onKeyDown={handleAddonKeyDown}
                    placeholder="e.g. Roti, Buttermilk, Shreekhnd, Jaggery"
                    className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white"
                  />
                </div>
                <div className="w-20">
                  <label className="block text-[10px] font-semibold text-gray-500 mb-1 uppercase">
                    Price ₹
                  </label>
                  <input
                    type="number"
                    value={newAddonPrice}
                    onChange={(e) => setNewAddonPrice(e.target.value)}
                    onKeyDown={handleAddonKeyDown}
                    placeholder="0"
                    min="0"
                    step="0.5"
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white text-right"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddAddon}
                  className="flex items-center gap-1 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex-shrink-0"
                >
                  <Plus size={13} />
                  Add
                </button>
              </div>

              {addOns.length === 0 && (
                <p className="text-[11px] text-gray-400 text-center py-1 italic">
                  No add-ons yet — type a name above and click Add
                </p>
              )}

              <p className="text-[10px] text-gray-400">
                {addOns.length} add-on{addOns.length !== 1 ? "s" : ""} configured ·
                Press Enter or click Add to add each item
              </p>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
```

---

## 6. Updated `_ProductsTab.tsx` — Table Column for Add-Ons

**File:** `src/app/(admin)/catalog/_ProductsTab.tsx`

### 6.1 Update the local `Product` interface at the top of `_ProductsTab.tsx`

Find:
```ts
interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  quantity: string;
  price: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

Replace with:
```ts
interface AddonItem {
  name: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  quantity: string;
  price: number;
  isActive: boolean;
  isAddOnAvailable: boolean;
  addOns: AddonItem[];
  createdAt: string;
  updatedAt: string;
}
```

### 6.2 Add an "Add-Ons" column to the columns array

In the `columns` array in `_ProductsTab.tsx`, add this column after the `price` column (before the `status` column):

```tsx
{
  key: "addOns",
  header: "Add-Ons",
  render: (row) => {
    if (!row.isAddOnAvailable) {
      return <span className="text-xs text-gray-300">—</span>;
    }
    return (
      <div>
        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 font-semibold">
          ✦ Add-On
        </span>
        {row.addOns.length > 0 && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            {row.addOns.map((a) => a.name).join(", ")}
          </p>
        )}
      </div>
    );
  },
},
```

### 6.3 Pass `addOns` and `isAddOnAvailable` to `ProductModal` when editing

In the existing edit button onClick:
```tsx
onClick={() => { setEditProduct(row); setModalOpen(true); }}
```
This already passes `row` which now includes `isAddOnAvailable` and `addOns` — no change needed there as long as the `Product` type is updated.

---

## 7. Updated `src/types/index.ts`

Add to the `PRODUCT` section:

```ts
// ─────────────────────────────────────────
// PRODUCT ADD-ON
// ─────────────────────────────────────────
export interface ProductAddon {
  id: string;
  productId: string;
  name: string;
  price: number;
  sortOrder: number;
  createdAt: string;
}

// ─────────────────────────────────────────
// PRODUCT (updated)
// ─────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  quantity: string;
  price: number;
  isActive: boolean;
  isAddOnAvailable: boolean;    // NEW
  addOns: ProductAddon[];       // NEW
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  name: string;
  nameGu?: string | null;
  quantity: string;
  price: number;
  isAddOnAvailable?: boolean;   // NEW
  addOns?: { name: string; price: number }[]; // NEW
}

export interface UpdateProductInput {
  name?: string;
  nameGu?: string | null;
  quantity?: string;
  price?: number;
  isActive?: boolean;
  isAddOnAvailable?: boolean;   // NEW
  addOns?: { name: string; price: number }[]; // NEW
}
```

---

## 8. Feature 2 — Zero-Friction Menu

### The problem with the current menu page

The current `/menu/page.tsx` presents the admin with a side-by-side lunch/dinner card layout. While the structure is good, the admin has to manually:

- Pick every thali every single day from scratch
- Pick all sabji for every thali every single day from scratch
- Set cutoff times manually every day

**The core insight:** VD serves nearly the same menu 5–6 days a week. The daily variation is only in which 2–3 sabji are included. Everything else — thalis, cutoff times — barely changes.

### The solution: One-Click Templates

**Templates** already exist in the DB (`MenuTemplate` model). The current page shows them but the admin still has to manually apply them by clicking through.

The new approach wraps the entire menu creation in a **"Template First"** flow:

1. Admin picks date
2. For Lunch and Dinner, admin can click a template → form pre-fills instantly
3. Admin changes only what's different today (usually just the sabji)
4. One click to save

If no template fits, the admin fills in manually — same as before, just cleaner.

Additionally: **"Save as Template"** button after any save — so the first time the admin sets up a good menu, it's saved forever.

### What stays the same (do NOT change)

- The two-column Lunch / Dinner layout
- The `SabjiPicker` component
- The API calls (`POST /api/menu`, `PUT /api/menu/:id`, `DELETE /api/menu/:id`)
- The `menuTemplate` API routes

### What changes

- The top of each meal column gets a "Load Template" quick-pick section
- After saving, a "Save as Template" option appears
- The cutoff time defaults to the last-used value (stored in `localStorage`)
- A new "Copy Yesterday's Menu to Today" shortcut button is added at the top

---

## 9. New `menu/page.tsx` — Full Replacement

**File:** `src/app/(admin)/menu/page.tsx`

Replace the entire file with the following:

```tsx
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Save,
  Trash2,
  BookmarkPlus,
  Zap,
  Copy,
  Check,
  X,
  Link2,
  ToggleRight,
} from "lucide-react";
import toast from "react-hot-toast";
import SabjiPicker from "@/components/admin/SabjiPicker";
import Button from "@/components/ui/Button";
import { formatDateForAPI, getTodayIST } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ThaliItem { id: string; itemName: string }
interface Product { id: string; name: string; nameGu?: string | null }
interface Thali {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
  maxSabjiCount: number;
  items: ThaliItem[];
  sabjiPool?: { productId: string; product: Product }[];
}
interface DailyMenu {
  id: string;
  publicSlug?: string | null;
  mealType: "LUNCH" | "DINNER";
  cutoffTime?: string | null;
  isPublished: boolean;
  thalis: { thaliId: string; thali: Thali; minSabjiRequired: number }[];
  sabjiOptions: { thaliId: string; productId: string }[];
}
interface MenuTemplate {
  id: string;
  name: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime?: string | null;
  thaliIds: string[];
  sabjiConfig: { thaliId: string; productIds: string[] }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00+05:30");
  d.setDate(d.getDate() + days);
  return formatDateForAPI(d);
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00+05:30");
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

const LAST_CUTOFF_KEY = "vdh_last_cutoff";

function getLastCutoff(mealType: "LUNCH" | "DINNER"): string {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_CUTOFF_KEY) ?? "{}");
    return stored[mealType] ?? (mealType === "LUNCH" ? "11:30" : "18:30");
  } catch { return mealType === "LUNCH" ? "11:30" : "18:30"; }
}

function saveLastCutoff(mealType: "LUNCH" | "DINNER", value: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_CUTOFF_KEY) ?? "{}");
    stored[mealType] = value;
    localStorage.setItem(LAST_CUTOFF_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

// ─── MealDraft shape ───────────────────────────────────────────────────────────
interface MealDraft {
  existingId: string | null;
  publicSlug: string | null;
  isPublished: boolean;
  cutoffTime: string;
  selectedThaliIds: string[];
  // sabjiMap: thaliId → selected product IDs
  sabjiMap: Record<string, string[]>;
  // minSabjiMap: thaliId → min required
  minSabjiMap: Record<string, number>;
  isSaving: boolean;
  isDeleting: boolean;
}

function emptyDraft(mealType: "LUNCH" | "DINNER"): MealDraft {
  return {
    existingId: null,
    publicSlug: null,
    isPublished: false,
    cutoffTime: getLastCutoff(mealType),
    selectedThaliIds: [],
    sabjiMap: {},
    minSabjiMap: {},
    isSaving: false,
    isDeleting: false,
  };
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const todayStr = getTodayIST();

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [thalis, setThalis] = useState<Thali[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [lunchDraft, setLunchDraft] = useState<MealDraft>(() => emptyDraft("LUNCH"));
  const [dinnerDraft, setDinnerDraft] = useState<MealDraft>(() => emptyDraft("DINNER"));

  // Template save modal state
  const [templateSaveModal, setTemplateSaveModal] = useState<{
    mealType: "LUNCH" | "DINNER";
    open: boolean;
    name: string;
  }>({ mealType: "LUNCH", open: false, name: "" });

  // Fetch master data once
  useEffect(() => {
    Promise.all([
      fetch("/api/thalis?isActive=true").then((r) => r.json()),
      fetch("/api/products?isActive=true").then((r) => r.json()),
      fetch("/api/menu-templates").then((r) => r.json()),
    ]).then(([thaliData, productData, templateData]) => {
      setThalis(thaliData.thalis ?? []);
      setProducts(productData.products ?? []);
      setTemplates(templateData.templates ?? []);
    }).catch(() => toast.error("Failed to load catalog data"))
    .finally(() => setIsLoading(false));
  }, []);

  // Fetch menus for selected date
  const fetchMenusForDate = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/menu?date=${date}`);
      const json = await res.json();
      const menus: DailyMenu[] = json.menus ?? [];

      const buildDraft = (mealType: "LUNCH" | "DINNER"): MealDraft => {
        const menu = menus.find((m) => m.mealType === mealType);
        if (!menu) return emptyDraft(mealType);

        const sabjiMap: Record<string, string[]> = {};
        menu.sabjiOptions.forEach(({ thaliId, productId }) => {
          if (!sabjiMap[thaliId]) sabjiMap[thaliId] = [];
          sabjiMap[thaliId].push(productId);
        });

        const minSabjiMap: Record<string, number> = {};
        menu.thalis.forEach(({ thaliId, minSabjiRequired }) => {
          minSabjiMap[thaliId] = minSabjiRequired;
        });

        // Parse cutoffTime (stored as UTC DateTime) back to IST "HH:MM"
        let cutoffTime = getLastCutoff(mealType);
        if (menu.cutoffTime) {
          try {
            const d = new Date(menu.cutoffTime);
            const ist = new Date(d.getTime() + 330 * 60 * 1000);
            cutoffTime = `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
          } catch { /* use default */ }
        }

        return {
          existingId: menu.id,
          publicSlug: menu.publicSlug ?? null,
          isPublished: menu.isPublished,
          cutoffTime,
          selectedThaliIds: menu.thalis.map((t) => t.thaliId),
          sabjiMap,
          minSabjiMap,
          isSaving: false,
          isDeleting: false,
        };
      };

      setLunchDraft(buildDraft("LUNCH"));
      setDinnerDraft(buildDraft("DINNER"));
    } catch {
      toast.error("Failed to load menus for this date");
    }
  }, []);

  useEffect(() => {
    fetchMenusForDate(selectedDate);
  }, [selectedDate, fetchMenusForDate]);

  // ── Draft helpers ────────────────────────────────────────────────────────────
  const updateDraft = (
    mealType: "LUNCH" | "DINNER",
    partial: Partial<MealDraft>
  ) => {
    if (mealType === "LUNCH") setLunchDraft((prev) => ({ ...prev, ...partial }));
    else setDinnerDraft((prev) => ({ ...prev, ...partial }));
  };

  const getDraft = (mealType: "LUNCH" | "DINNER") =>
    mealType === "LUNCH" ? lunchDraft : dinnerDraft;

  // ── Load template ────────────────────────────────────────────────────────────
  const loadTemplate = (mealType: "LUNCH" | "DINNER", template: MenuTemplate) => {
    const sabjiMap: Record<string, string[]> = {};
    const minSabjiMap: Record<string, number> = {};
    (template.sabjiConfig ?? []).forEach(
      ({ thaliId, productIds }: { thaliId: string; productIds: string[] }) => {
        sabjiMap[thaliId] = productIds;
      }
    );
    template.thaliIds.forEach((tid) => {
      const thali = thalis.find((t) => t.id === tid);
      minSabjiMap[tid] = thali?.maxSabjiCount ?? 1;
    });

    updateDraft(mealType, {
      selectedThaliIds: template.thaliIds,
      sabjiMap,
      minSabjiMap,
      cutoffTime: template.cutoffTime ?? getLastCutoff(mealType),
    });
    toast.success(`Template "${template.name}" loaded`);
  };

  // ── Save menu ────────────────────────────────────────────────────────────────
  const saveMenu = async (mealType: "LUNCH" | "DINNER") => {
    const draft = getDraft(mealType);
    if (draft.selectedThaliIds.length === 0) {
      toast.error("Select at least one thali");
      return;
    }

    updateDraft(mealType, { isSaving: true });
    saveLastCutoff(mealType, draft.cutoffTime);

    const sabjiOptions = draft.selectedThaliIds.map((thaliId) => ({
      thaliId,
      productIds: draft.sabjiMap[thaliId] ?? [],
    }));

    try {
      const url = draft.existingId ? `/api/menu/${draft.existingId}` : "/api/menu";
      const method = draft.existingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          mealType,
          cutoffTime: draft.cutoffTime || null,
          thaliIds: draft.selectedThaliIds,
          sabjiOptions,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");

      toast.success(
        draft.existingId
          ? `${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu updated`
          : `${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu created`
      );

      const saved: DailyMenu = json.menu;
      updateDraft(mealType, {
        existingId: saved.id,
        publicSlug: saved.publicSlug ?? null,
        isPublished: saved.isPublished,
        isSaving: false,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      updateDraft(mealType, { isSaving: false });
    }
  };

  // ── Delete menu ──────────────────────────────────────────────────────────────
  const deleteMenu = async (mealType: "LUNCH" | "DINNER") => {
    const draft = getDraft(mealType);
    if (!draft.existingId) return;
    if (!confirm(`Delete ${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu? This cannot be undone.`)) return;

    updateDraft(mealType, { isDeleting: true });
    try {
      const res = await fetch(`/api/menu/${draft.existingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(`${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu deleted`);
      updateDraft(mealType, { ...emptyDraft(mealType), isDeleting: false });
    } catch {
      toast.error("Delete failed");
      updateDraft(mealType, { isDeleting: false });
    }
  };

  // ── Toggle publish ───────────────────────────────────────────────────────────
  const togglePublish = async (mealType: "LUNCH" | "DINNER") => {
    const draft = getDraft(mealType);
    if (!draft.existingId) return;
    try {
      const res = await fetch(`/api/menu/${draft.existingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          mealType,
          cutoffTime: draft.cutoffTime || null,
          thaliIds: draft.selectedThaliIds,
          sabjiOptions: draft.selectedThaliIds.map((thaliId) => ({
            thaliId,
            productIds: draft.sabjiMap[thaliId] ?? [],
          })),
          isPublished: !draft.isPublished,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      updateDraft(mealType, { isPublished: !draft.isPublished });
      toast.success(draft.isPublished ? "Menu unpublished" : "Menu published");
    } catch {
      toast.error("Failed to toggle publish");
    }
  };

  // ── Save as template ─────────────────────────────────────────────────────────
  const saveAsTemplate = async () => {
    const { mealType, name } = templateSaveModal;
    const draft = getDraft(mealType);
    if (!name.trim()) { toast.error("Enter a template name"); return; }
    if (draft.selectedThaliIds.length === 0) { toast.error("No thalis selected"); return; }

    try {
      const res = await fetch("/api/menu-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mealType,
          cutoffTime: draft.cutoffTime || null,
          thaliIds: draft.selectedThaliIds,
          sabjiConfig: draft.selectedThaliIds.map((thaliId) => ({
            thaliId,
            productIds: draft.sabjiMap[thaliId] ?? [],
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(`Template "${name.trim()}" saved`);
      setTemplates((prev) => {
        const exists = prev.find((t) => t.name === json.template.name);
        if (exists) return prev.map((t) => t.name === json.template.name ? json.template : t);
        return [...prev, json.template];
      });
      setTemplateSaveModal((v) => ({ ...v, open: false, name: "" }));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save template failed");
    }
  };

  // ── Delete template ──────────────────────────────────────────────────────────
  const deleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/menu-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch { toast.error("Failed to delete template"); }
  };

  // ── Copy yesterday to today ──────────────────────────────────────────────────
  const copyYesterdayToToday = async () => {
    if (selectedDate !== todayStr) {
      toast.error("This shortcut only works for today's date");
      return;
    }
    const yesterdayStr = dateAddDays(todayStr, -1);
    try {
      const res = await fetch(`/api/menu?date=${yesterdayStr}`);
      const json = await res.json();
      const menus: DailyMenu[] = json.menus ?? [];
      if (menus.length === 0) {
        toast.error("No menus found for yesterday");
        return;
      }

      for (const mealType of ["LUNCH", "DINNER"] as const) {
        const menu = menus.find((m) => m.mealType === mealType);
        if (!menu) continue;

        const sabjiMap: Record<string, string[]> = {};
        menu.sabjiOptions.forEach(({ thaliId, productId }) => {
          if (!sabjiMap[thaliId]) sabjiMap[thaliId] = [];
          sabjiMap[thaliId].push(productId);
        });
        const minSabjiMap: Record<string, number> = {};
        menu.thalis.forEach(({ thaliId, minSabjiRequired }) => {
          minSabjiMap[thaliId] = minSabjiRequired;
        });

        updateDraft(mealType, {
          existingId: null, // force create
          selectedThaliIds: menu.thalis.map((t) => t.thaliId),
          sabjiMap,
          minSabjiMap,
        });
      }
      toast.success("Yesterday's menu loaded — review and save");
    } catch { toast.error("Failed to copy yesterday's menu"); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Daily Menu</h2>
          <p className="text-sm text-gray-500 mt-0.5">Set lunch & dinner for any date</p>
        </div>
        {/* Copy yesterday shortcut */}
        {selectedDate === todayStr && (
          <button
            onClick={copyYesterdayToToday}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 border border-dashed border-gray-300 hover:border-orange-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <Copy size={14} />
            Copy Yesterday&apos;s Menu
          </button>
        )}
      </div>

      {/* ── Date Navigator ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-2 w-fit shadow-sm">
        <button
          onClick={() => setSelectedDate(dateAddDays(selectedDate, -1))}
          disabled={selectedDate <= todayStr}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft size={18} />
        </button>

        <input
          type="date"
          value={selectedDate}
          min={todayStr}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          className="text-sm font-semibold text-gray-800 border-none outline-none bg-transparent cursor-pointer"
        />
        <span className="text-xs text-gray-400 hidden sm:block">
          {formatDisplayDate(selectedDate)}
        </span>
        {selectedDate === todayStr && (
          <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">TODAY</span>
        )}

        <button
          onClick={() => setSelectedDate(dateAddDays(selectedDate, 1))}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <ChevronRight size={18} />
        </button>

        {selectedDate !== todayStr && (
          <button
            onClick={() => setSelectedDate(todayStr)}
            className="text-xs text-orange-500 hover:text-orange-600 font-semibold px-2 py-1 cursor-pointer"
          >
            Today
          </button>
        )}
      </div>

      {/* ── Meal Columns ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {(["LUNCH", "DINNER"] as const).map((mealType) => (
          <MealColumn
            key={mealType}
            mealType={mealType}
            draft={getDraft(mealType)}
            thalis={thalis}
            products={products}
            templates={templates.filter((t) => t.mealType === mealType)}
            selectedDate={selectedDate}
            todayStr={todayStr}
            onUpdateDraft={(partial) => updateDraft(mealType, partial)}
            onSave={() => saveMenu(mealType)}
            onDelete={() => deleteMenu(mealType)}
            onTogglePublish={() => togglePublish(mealType)}
            onLoadTemplate={(t) => loadTemplate(mealType, t)}
            onOpenSaveTemplate={() =>
              setTemplateSaveModal({ mealType, open: true, name: "" })
            }
            onDeleteTemplate={deleteTemplate}
          />
        ))}
      </div>

      {/* ── Save Template Modal ─────────────────────────────────────────────── */}
      {templateSaveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() =>
            setTemplateSaveModal((v) => ({ ...v, open: false }))
          } />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-900">
              Save {templateSaveModal.mealType === "LUNCH" ? "Lunch" : "Dinner"} Template
            </h3>
            <p className="text-sm text-gray-500">
              Give this template a name so you can reuse it later in one click.
            </p>
            <input
              type="text"
              autoFocus
              value={templateSaveModal.name}
              onChange={(e) =>
                setTemplateSaveModal((v) => ({ ...v, name: e.target.value }))
              }
              onKeyDown={(e) => e.key === "Enter" && saveAsTemplate()}
              placeholder="e.g. Regular Lunch, Friday Special..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTemplateSaveModal((v) => ({ ...v, open: false }))}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={saveAsTemplate}>
                <BookmarkPlus size={14} className="mr-1" /> Save Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MealColumn sub-component ──────────────────────────────────────────────────
interface MealColumnProps {
  mealType: "LUNCH" | "DINNER";
  draft: MealDraft;
  thalis: Thali[];
  products: Product[];
  templates: MenuTemplate[];
  selectedDate: string;
  todayStr: string;
  onUpdateDraft: (partial: Partial<MealDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onLoadTemplate: (t: MenuTemplate) => void;
  onOpenSaveTemplate: () => void;
  onDeleteTemplate: (id: string) => void;
}

function MealColumn({
  mealType,
  draft,
  thalis,
  products,
  templates,
  selectedDate,
  todayStr,
  onUpdateDraft,
  onSave,
  onDelete,
  onTogglePublish,
  onLoadTemplate,
  onOpenSaveTemplate,
  onDeleteTemplate,
}: MealColumnProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  const isLunch = mealType === "LUNCH";
  const accent = isLunch ? "orange" : "indigo";
  const accentClasses = isLunch
    ? { header: "from-orange-500 to-orange-600", tag: "bg-orange-500" }
    : { header: "from-indigo-500 to-indigo-600", tag: "bg-indigo-500" };

  const toggleThali = (thaliId: string) => {
    const next = draft.selectedThaliIds.includes(thaliId)
      ? draft.selectedThaliIds.filter((id) => id !== thaliId)
      : [...draft.selectedThaliIds, thaliId];

    // If deselecting, clean up sabji for that thali
    if (!next.includes(thaliId)) {
      const newSabjiMap = { ...draft.sabjiMap };
      delete newSabjiMap[thaliId];
      const newMinMap = { ...draft.minSabjiMap };
      delete newMinMap[thaliId];
      onUpdateDraft({ selectedThaliIds: next, sabjiMap: newSabjiMap, minSabjiMap: newMinMap });
    } else {
      const thali = thalis.find((t) => t.id === thaliId);
      onUpdateDraft({
        selectedThaliIds: next,
        minSabjiMap: {
          ...draft.minSabjiMap,
          [thaliId]: thali?.maxSabjiCount ?? 1,
        },
      });
    }
  };

  const copyPublicUrl = () => {
    if (!draft.publicSlug) return;
    navigator.clipboard.writeText(`${window.location.origin}/menu/${draft.publicSlug}`);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
    toast.success("Public URL copied!");
  };

  const isPast = selectedDate < todayStr;

  return (
    <div className={`bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm ${isPast ? "opacity-60" : ""}`}>

      {/* Column Header */}
      <div className={`bg-gradient-to-r ${accentClasses.header} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5 text-white">
          {isLunch ? <Sun size={18} /> : <Moon size={18} />}
          <div>
            <p className="font-bold text-sm">{isLunch ? "Lunch" : "Dinner"}</p>
            {draft.existingId && (
              <p className="text-[10px] text-white/70">
                {draft.isPublished ? "Published ✓" : "Draft"}
              </p>
            )}
          </div>
        </div>
        {draft.existingId && (
          <button
            onClick={onTogglePublish}
            className={`flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
              draft.isPublished
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            <ToggleRight size={12} />
            {draft.isPublished ? "Unpublish" : "Publish"}
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">

        {/* Templates section */}
        {templates.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 cursor-pointer"
            >
              <Zap size={12} className="fill-orange-400 text-orange-400" />
              Load Template ({templates.length})
              <span className="text-gray-300 ml-1">{showTemplates ? "▲" : "▼"}</span>
            </button>

            {showTemplates && (
              <div className="mt-2 space-y-1">
                {templates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="flex items-center gap-2 group"
                  >
                    <button
                      type="button"
                      onClick={() => { onLoadTemplate(tmpl); setShowTemplates(false); }}
                      className="flex-1 text-left text-xs px-2.5 py-1.5 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-lg transition-all cursor-pointer"
                    >
                      <span className="font-medium text-gray-700">{tmpl.name}</span>
                      <span className="text-gray-400 ml-2">
                        {tmpl.thaliIds.length} thali · {tmpl.cutoffTime ?? "no cutoff"}
                      </span>
                    </button>
                    <button
                      onClick={() => onDeleteTemplate(tmpl.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cutoff time */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600 w-20 flex-shrink-0">
            Cutoff Time
          </label>
          <input
            type="time"
            value={draft.cutoffTime}
            onChange={(e) => onUpdateDraft({ cutoffTime: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 w-full max-w-[130px]"
          />
          <span className="text-xs text-gray-400">IST</span>
        </div>

        {/* Thali selector */}
        <div>
          <p className="text-xs font-semibold text-gray-600 mb-2">Thalis</p>
          <div className="flex flex-wrap gap-1.5">
            {thalis.map((thali) => {
              const isSelected = draft.selectedThaliIds.includes(thali.id);
              return (
                <button
                  key={thali.id}
                  type="button"
                  onClick={() => toggleThali(thali.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all cursor-pointer ${
                    isSelected
                      ? `${accentClasses.tag} text-white border-transparent`
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {thali.name}
                  {thali.maxSabjiCount > 0 && (
                    <span className={`ml-1 text-[10px] ${isSelected ? "text-white/70" : "text-gray-400"}`}>
                      {thali.maxSabjiCount}S
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Per-thali sabji pickers */}
        {draft.selectedThaliIds.length > 0 && (
          <div className="space-y-3">
            {draft.selectedThaliIds.map((thaliId) => {
              const thali = thalis.find((t) => t.id === thaliId);
              if (!thali || thali.maxSabjiCount === 0) return null;

              // The sabji pool for this thali (from ThaliSabjiProduct join)
              // If the thali has a pre-defined sabji pool, use it; otherwise fall back to all active products
              const pool: Product[] =
                thali.sabjiPool && thali.sabjiPool.length > 0
                  ? thali.sabjiPool.map((sp) => sp.product)
                  : products;

              return (
                <SabjiPicker
                  key={thaliId}
                  label={`Sabji for ${thali.name}`}
                  products={pool}
                  selected={draft.sabjiMap[thaliId] ?? []}
                  maxCount={thali.maxSabjiCount}
                  minRequired={draft.minSabjiMap[thaliId] ?? thali.maxSabjiCount}
                  onChange={(ids) =>
                    onUpdateDraft({
                      sabjiMap: { ...draft.sabjiMap, [thaliId]: ids },
                    })
                  }
                  onMinChange={(n) =>
                    onUpdateDraft({
                      minSabjiMap: { ...draft.minSabjiMap, [thaliId]: n },
                    })
                  }
                />
              );
            })}
          </div>
        )}

        {/* Public URL (after save) */}
        {draft.existingId && draft.publicSlug && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Link2 size={13} className="text-gray-400 flex-shrink-0" />
            <code className="text-xs text-orange-600 font-mono flex-1 truncate">
              /menu/{draft.publicSlug}
            </code>
            <button
              onClick={copyPublicUrl}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0 flex items-center gap-1"
            >
              {copiedSlug ? (
                <><Check size={12} className="text-emerald-500" /> Copied</>
              ) : (
                "Copy"
              )}
            </button>
            <a
              href={`/menu/${draft.publicSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-orange-500 hover:text-orange-600 flex-shrink-0"
            >
              Open →
            </a>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <Button
            variant="primary"
            className="flex-1"
            isLoading={draft.isSaving}
            disabled={draft.selectedThaliIds.length === 0 || isPast}
            onClick={onSave}
          >
            <Save size={14} className="mr-1.5" />
            {draft.existingId ? "Update" : "Save"} {isLunch ? "Lunch" : "Dinner"}
          </Button>

          {draft.existingId && (
            <>
              <button
                onClick={onOpenSaveTemplate}
                title="Save as template"
                className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 border border-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                <BookmarkPlus size={16} />
              </button>
              <button
                onClick={onDelete}
                disabled={draft.isDeleting}
                title="Delete menu"
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>

        {isPast && (
          <p className="text-xs text-amber-600 text-center">
            Past date — view only
          </p>
        )}
      </div>
    </div>
  );
}
```

---

## 10. Seed Update

In `prisma/seed.ts`, add sample add-on data for one product to demonstrate the feature. Find the `seededProducts` array creation and add after it:

```ts
// ── Sample Add-Ons (for Palak Paneer) ──────────────────────────
const palakPaneer = seededProducts.find((p) => p.name === "Palak Paneer");
if (palakPaneer) {
  // Mark it as add-on available
  await prisma.product.update({
    where: { id: palakPaneer.id },
    data: { isAddOnAvailable: true },
  });

  // Create sample add-ons
  const addOnDefs = [
    { name: "Extra Roti", price: 5, sortOrder: 0 },
    { name: "Buttermilk", price: 0, sortOrder: 1 },
    { name: "Shreekhnd", price: 15, sortOrder: 2 },
    { name: "Jaggery", price: 0, sortOrder: 3 },
  ];

  for (const ao of addOnDefs) {
    await prisma.productAddon.upsert({
      where: { productId_name: { productId: palakPaneer.id, name: ao.name } },
      update: { price: ao.price },
      create: { productId: palakPaneer.id, ...ao },
    });
  }
  console.log("✅ Sample add-ons seeded");
}
```

---

## 11. Checklist: Files Changed

| File | Change Type | Notes |
|------|-------------|-------|
| `prisma/schema.prisma` | Edit | Add `isAddOnAvailable` to `Product`, new `ProductAddon` model |
| `prisma/migrations/20260627000000_product_addons/migration.sql` | New | SQL for new column + table |
| `prisma/seed.ts` | Edit | Add sample add-on data for Palak Paneer |
| `src/app/api/products/route.ts` | Edit | `GET` includes `addOns`; `POST` accepts and creates add-ons |
| `src/app/api/products/[id]/route.ts` | Edit | `PUT` deletes and recreates add-ons |
| `src/components/modals/ProductModal.tsx` | **Full replace** | Add-On toggle + dynamic add-on list |
| `src/app/(admin)/catalog/_ProductsTab.tsx` | Edit | Add `AddonItem` type, `isAddOnAvailable`, `addOns` to `Product` interface; add "Add-Ons" column |
| `src/types/index.ts` | Edit | Add `ProductAddon`, update `Product`, `CreateProductInput`, `UpdateProductInput` |
| `src/app/(admin)/menu/page.tsx` | **Full replace** | Template-first flow, zero-friction design, Copy Yesterday, Save as Template |

---

## Implementation Order

Run in this exact order to avoid migration conflicts:

```
1. Edit prisma/schema.prisma  (add isAddOnAvailable + ProductAddon)
2. Create migration SQL file
3. npx prisma migrate dev --name product_addons
4. npx prisma generate
5. Edit prisma/seed.ts (optional — only if you want sample data)
6. Edit src/app/api/products/route.ts
7. Edit src/app/api/products/[id]/route.ts
8. Replace src/components/modals/ProductModal.tsx
9. Edit src/app/(admin)/catalog/_ProductsTab.tsx
10. Edit src/types/index.ts
11. Replace src/app/(admin)/menu/page.tsx
12. npm run dev — test both features
```

---

## Testing Checklist

### Feature 1 — Product Add-Ons

- [ ] Open Catalog → Products → Add Product
- [ ] Click "Product Available for Add-On" toggle — section expands
- [ ] Type "Roti" in add-on name, press Enter → tag appears in list
- [ ] Type "Buttermilk", set price to 0, click Add → appears
- [ ] Type "Shreekhnd", set price to 15, click Add → appears
- [ ] Remove an add-on with X button → removed instantly
- [ ] Edit price inline in the add-on row → changes reflected
- [ ] Save product → POST body contains `isAddOnAvailable: true` and `addOns: [...]`
- [ ] API returns product with `addOns` array
- [ ] Products table shows "✦ Add-On" badge with item names in the Add-Ons column
- [ ] Edit product → add-ons pre-populated in form
- [ ] Toggle off "Product Available for Add-On" → add-on section collapses, addOns sent as []
- [ ] Save with toggle off → `isAddOnAvailable: false` in DB

### Feature 2 — Zero-Friction Menu

- [ ] Open Daily Menu → today's date pre-selected
- [ ] If templates exist, "Load Template (N)" link appears
- [ ] Click template → thalis and cutoff pre-fill
- [ ] Thali buttons work as toggle pills
- [ ] Sabji picker appears only for thalis with `maxSabjiCount > 0`
- [ ] Cutoff time auto-saves to localStorage on Save
- [ ] Cutoff defaults to last used value on next open
- [ ] Save Lunch → menu created, "Update" label appears
- [ ] Public URL shows after save, Copy button works
- [ ] "Publish / Unpublish" toggle works
- [ ] Save as Template → modal opens, name entered, template saved
- [ ] Template appears in template list immediately
- [ ] Delete template with hover X
- [ ] "Copy Yesterday's Menu" → only on today's date, pre-fills both meals
- [ ] Past date → card is grayed out, save disabled with "Past date — view only"