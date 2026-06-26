# TEMP_IMPLEMENTATION.MD — ProductModal Add-On Toggle Bug Fix

> **Project:** VD's Hunger Hub (`softvibeservices-vdshungerhub`)
> **Stack:** Next.js 16 · Prisma (PostgreSQL) · Tailwind CSS v4 · React 19
> **Issue:** `ProductModal.tsx` — "Available for Add-On" toggle incorrectly opens a NEW form/modal for add-on items instead of showing an inline section for the current product being added.

---

## 1. Root Cause

The current `ProductModal.tsx` has a bug in the `isAddOnAvailable` toggle handler. When the toggle is switched to `true`, instead of revealing an **inline add-on items section** inside the same Product Modal, it navigates the user to (or mounts) a separate "Add On Items" form. This means:

- The user loses context of the product they were creating.
- The add-on items are not associated with the current product in the same submit call.
- The correct behavior: `isAddOnAvailable = true` → show a dynamic list within the SAME modal where the admin can add/remove add-on item rows (name + price), and all of it submits together when "Save Product" is clicked.

The API already supports this correctly:

```ts
// POST /api/products — already accepts addOns inline
const { name, nameGu, quantity, price, isAddOnAvailable, addOns } = await req.json();
// addOns: { name: string; price: number; sortOrder: number }[]
```

---

## 2. What Needs to Change

**Only one file needs to change:**

| File | Action |
|---|---|
| `src/components/modals/ProductModal.tsx` | **FULL REPLACE** — fix the toggle behavior + add inline add-on rows |

No API changes, no schema changes, no other files.

---

## 3. Complete Fixed `ProductModal.tsx`

**File path:** `src/components/modals/ProductModal.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/hooks/useToast";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AddonRow {
  name: string;
  price: string; // string so input is controlled cleanly; converted to number on submit
}

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
}

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function emptyAddon(): AddonRow {
  return { name: "", price: "0" };
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function ProductModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductModalProps) {
  const toast = useToast();
  const isEdit = !!product;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [nameGu, setNameGu] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [isAddOnAvailable, setIsAddOnAvailable] = useState(false);
  const [addOnRows, setAddOnRows] = useState<AddonRow[]>([emptyAddon()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Reset when modal opens/changes ─────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setName(product?.name ?? "");
      setNameGu(product?.nameGu ?? "");
      setQuantity(product?.quantity ?? "");
      setPrice(product?.price?.toString() ?? "");
      setIsAddOnAvailable(product?.isAddOnAvailable ?? false);

      // Populate existing add-on rows when editing
      if (product?.isAddOnAvailable && product.addOns?.length > 0) {
        setAddOnRows(
          product.addOns.map((a) => ({
            name: a.name,
            price: a.price.toString(),
          }))
        );
      } else {
        setAddOnRows([emptyAddon()]);
      }

      setErrors({});
    }
  }, [isOpen, product]);

  // ── Add-on row helpers ─────────────────────────────────────────────────────

  const addRow = () => {
    setAddOnRows((prev) => [...prev, emptyAddon()]);
  };

  const removeRow = (idx: number) => {
    setAddOnRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateRow = (idx: number, field: keyof AddonRow, value: string) => {
    setAddOnRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: value } : row))
    );
  };

  const handleToggleAddOn = () => {
    // KEY FIX: toggling changes state IN THIS MODAL, not opening a new form
    const next = !isAddOnAvailable;
    setIsAddOnAvailable(next);
    if (next && addOnRows.length === 0) {
      setAddOnRows([emptyAddon()]);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!name.trim()) errs.name = "Product name is required";
    if (!quantity.trim()) errs.quantity = "Quantity is required";

    const parsedPrice = Number(price);
    if (!price || isNaN(parsedPrice) || parsedPrice < 0) {
      errs.price = "Valid price is required";
    }

    if (isAddOnAvailable) {
      const validRows = addOnRows.filter((r) => r.name.trim());
      if (validRows.length === 0) {
        errs.addOns = "Add at least one add-on item, or turn off the toggle.";
      }
      const invalidPrice = validRows.some(
        (r) => isNaN(Number(r.price)) || Number(r.price) < 0
      );
      if (invalidPrice) {
        errs.addOns = "All add-on prices must be valid numbers (0 or more).";
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async () => {
    if (!validate()) return;
    setIsSubmitting(true);

    // Build clean add-on list — only rows with a name
    const cleanAddOns = isAddOnAvailable
      ? addOnRows
          .filter((r) => r.name.trim())
          .map((r, idx) => ({
            name: r.name.trim(),
            price: Number(r.price) || 0,
            sortOrder: idx,
          }))
      : [];

    try {
      const url = isEdit ? `/api/products/${product.id}` : "/api/products";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          nameGu: nameGu.trim() || null,
          quantity: quantity.trim(),
          price: Number(price),
          isAddOnAvailable,
          addOns: cleanAddOns,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");

      toast.success(isEdit ? "Product updated!" : "Product created!");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <Button variant="primary" onClick={onSubmit} isLoading={isSubmitting}>
            {isEdit ? "Save Changes" : "Save Product"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">

        {/* ── Name (English) ─────────────────────────────────────────────── */}
        <Input
          label="Product Name"
          placeholder="e.g. Palak Paneer"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />

        {/* ── Name (Gujarati) ────────────────────────────────────────────── */}
        <Input
          label="નામ (Gujarati Name)"
          placeholder="દા.ત. પાલક પનીર"
          value={nameGu}
          onChange={(e) => setNameGu(e.target.value)}
        />

        {/* ── Quantity + Price ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Quantity"
            placeholder="e.g. 1 bowl, 4 pcs"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            error={errors.quantity}
          />
          <Input
            label="Price (₹)"
            type="number"
            min="0"
            placeholder="e.g. 30"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            error={errors.price}
          />
        </div>

        {/* ── Available for Add-On toggle ────────────────────────────────── */}
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl">
          <div>
            <p className="text-sm font-medium text-gray-800">
              Available as Add-On
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Customers can add this item to their thali order
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggleAddOn}
            className="flex-shrink-0 transition-colors"
            aria-label="Toggle add-on availability"
          >
            {isAddOnAvailable ? (
              <ToggleRight size={32} className="text-orange-500" />
            ) : (
              <ToggleLeft size={32} className="text-gray-300" />
            )}
          </button>
        </div>

        {/* ── Add-On Items (shown inline ONLY when toggle is ON) ─────────── */}
        {isAddOnAvailable && (
          <div className="space-y-3 border border-orange-200 rounded-xl p-4 bg-orange-50/40">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-orange-700">
                Add-On Items
              </p>
              <p className="text-xs text-gray-500">
                What can customers add to their order?
              </p>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_100px_32px] gap-2 px-1">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Item Name
              </span>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                Price (₹)
              </span>
              <span />
            </div>

            {/* Add-on rows */}
            <div className="space-y-2">
              {addOnRows.map((row, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-[1fr_100px_32px] gap-2 items-center"
                >
                  <input
                    type="text"
                    placeholder={`e.g. Extra Roti`}
                    value={row.name}
                    onChange={(e) => updateRow(idx, "name", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={row.price}
                    onChange={(e) => updateRow(idx, "price", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    disabled={addOnRows.length === 1}
                    className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Remove this add-on row"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Error for add-ons */}
            {errors.addOns && (
              <p className="text-xs text-red-500">{errors.addOns}</p>
            )}

            {/* Add another row */}
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700 transition-colors mt-1"
            >
              <Plus size={13} />
              Add another item
            </button>

            {/* Helper text */}
            <p className="text-[11px] text-gray-400 pt-1 border-t border-orange-100">
              💡 Set price to <strong>0</strong> for free add-ons (e.g. Buttermilk, Jaggery).
            </p>
          </div>
        )}

      </div>
    </Modal>
  );
}
```

---

## 4. Key Behavioral Changes Explained

### Before (broken)
```
User opens "Add Product" modal
  → fills name, qty, price
  → clicks "Available for Add-On" toggle
  → ❌ NEW modal/form opens for "Add On Items"  ← wrong
  → context lost, add-ons NOT tied to current product in same submit
```

### After (fixed)
```
User opens "Add Product" modal
  → fills name, qty, price
  → clicks "Available for Add-On" toggle
  → ✅ Toggle turns orange, inline "Add-On Items" section appears BELOW the toggle
  → user fills in item rows (name + price) WITHIN the same modal
  → clicks "Save Product"
  → single API call with { name, qty, price, isAddOnAvailable: true, addOns: [...] }
  → product + add-ons created together ✅
```

---

## 5. UX Details

| Element | Behavior |
|---|---|
| Toggle OFF → ON | Orange `ToggleRight` icon appears; add-on section slides in below; starts with 1 blank row |
| Toggle ON → OFF | Section hides; existing row data cleared (no orphaned state) |
| "+ Add another item" | Appends a new blank row |
| Trash icon | Removes that row (disabled when only 1 row remains) |
| Price = 0 | Allowed; free add-ons like Buttermilk are valid |
| Empty name row | Skipped on submit (not validated, not sent to API) |
| Edit mode | Pre-populates with existing add-ons from `product.addOns` |
| Toggle OFF in edit mode | Sends `isAddOnAvailable: false`, `addOns: []` → API deletes existing add-ons |

---

## 6. How the API handles it

The API in `src/app/api/products/route.ts` (POST) and `src/app/api/products/[id]/route.ts` (PUT) already handle this correctly:

**POST:**
```ts
const { name, nameGu, quantity, price, isAddOnAvailable, addOns } = await req.json();
// ...
if (isAddOnAvailable && Array.isArray(addOns)) {
  // builds addonList from addOns[]
}
const product = await prisma.product.create({
  data: {
    name, quantity, price,
    isAddOnAvailable: Boolean(isAddOnAvailable),
    addOns: { create: addonList },  // ← created together
  }
});
```

**PUT:**
```ts
// Deletes existing add-ons first, then recreates from new list
await prisma.productAddon.deleteMany({ where: { productId: id } });
const product = await prisma.product.update({
  data: {
    isAddOnAvailable: Boolean(isAddOnAvailable),
    addOns: { create: addonList },  // ← recreated in same update
  }
});
```

**No API changes needed.** Only `ProductModal.tsx` needs to be replaced.

---

## 7. Acceptance Checklist

- [ ] Open "Add Product" modal → toggle is OFF by default, no add-on section visible
- [ ] Toggle "Available as Add-On" → section appears inline, toggle turns orange
- [ ] Add 2–3 add-on rows, set names and prices (including a ₹0 price)
- [ ] Click "Save Product" → single API call, product created with add-ons
- [ ] In `_ProductsTab`, the product shows "✦ Add-On" badge and lists the add-on names
- [ ] Edit the product → add-on rows pre-populated from existing data
- [ ] Toggle OFF while editing → add-ons cleared, badge disappears after save
- [ ] Remove a row → row disappears, remaining rows unaffected
- [ ] Trash icon disabled when only 1 row remains → cannot reduce to 0 rows
- [ ] Submitting with `isAddOnAvailable: true` but all name fields empty → validation error shown inline in modal (not a new modal)
- [ ] `npm run lint` passes with no new errors

---

## 8. Files Changed

| File | Change |
|---|---|
| `src/components/modals/ProductModal.tsx` | **FULL REPLACE** with the code in Section 3 |

**Nothing else changes.** Schema, API routes, `_ProductsTab.tsx`, and all other files remain untouched.

---

*Plan prepared for SoftVibe Services · VD's Hunger Hub · ProductModal Add-On Fix*