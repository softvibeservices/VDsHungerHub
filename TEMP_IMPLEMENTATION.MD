# VD's Hunger Hub — Implementation Guide
**SoftVibe Services · VDsHungerHub · June 2026**

---

## Overview

Two targeted, independent fixes based on screenshots and full codebase review.

| # | Fix | Files Changed | Effort |
|---|-----|--------------|--------|
| 1 | Admin SabjiPicker — remove selection cap so admin can curate ALL available sabjis | `SabjiPicker.tsx`, `(admin)/menu/page.tsx` | ~15 min / 3 lines |
| 2 | User (Public) Menu Panel — full mobile responsiveness overhaul | `menu/[slug]/page.tsx`, `OtpModal.tsx`, `OrderConfirmModal.tsx` | ~45–60 min |

---

---

# FIX #1 — Admin SabjiPicker: Remove Max-Selection Cap

---

## 1.1 The Problem

The Admin **Daily Menu** page renders a `SabjiPicker` component for each thali category. When the admin selects which sabjis to make available for the day, the picker enforces a hard cap equal to `thali.sabjiCount` (the customer-facing choice count, e.g. `1` or `2`). This is **wrong** because:

1. The admin is **curating the pool** of options customers may choose from — not making the customer's own selection.
2. A thali with `sabjiCount = 2` should allow the admin to list 5, 7, or all 10 available sabjis. The customer then picks exactly 2 from that pool.
3. The screenshot shows: **"3 of 7 options selected (Max choice: 2)"** — the admin is blocked from selecting the 4th sabji even though all 7 must be made available.

### Root Cause

**In `SabjiPicker.tsx`:** The `toggle()` function and button `disabled` state cap selections at `maxCount`. The footer label hard-prints `Max choice: {maxCount}` — treating the admin as if they were an end-user placing an order.

**In `(admin)/menu/page.tsx`:** `SabjiPicker` is called with `maxCount={group.sabjiCount}` where `group.sabjiCount` is the customer-choice count (e.g. `1` or `2`). No `adminMode` prop exists to bypass this.

---

## 1.2 Correct Mental Model

| | Admin Panel (Curation) | User Panel (Selection) |
|--|------------------------|------------------------|
| **Question** | "Which sabjis are available today?" | "Choose exactly N from the available pool" |
| **Limit** | **None** — pick as many as needed | Hard cap = `thali.sabjiCount` |
| **Status** | ❌ Broken — must fix | ✅ Already correct — do not touch |

---

## 1.3 Files to Change

| File | Action | What Changes |
|------|--------|-------------|
| `src/components/admin/SabjiPicker.tsx` | EDIT | Add `adminMode` prop; bypass cap in button disabled; update footer label |
| `src/app/(admin)/menu/page.tsx` | EDIT | Pass `adminMode={true}` to every `<SabjiPicker>` call |

---

## 1.4 `SabjiPicker.tsx` — Exact Changes

### A. Interface — add `adminMode` prop

Find the `SabjiPickerProps` interface (around line 14) and add one optional boolean:

```tsx
interface SabjiPickerProps {
  products: Product[];
  selected: string[];
  onChange: (ids: string[]) => void;
  maxCount: number;           // still needed — used by minRequired selector dropdown
  minRequired?: number;
  onMinChange?: (n: number) => void;
  label?: string;
  adminMode?: boolean;        // NEW — when true, no selection cap is enforced
}
```

---

### B. Destructure the new prop

In the function signature (around line 22), add `adminMode = false`:

```tsx
export default function SabjiPicker({
  products,
  selected,
  onChange,
  maxCount,
  minRequired = 1,
  onMinChange,
  label,
  adminMode = false,          // NEW
}: SabjiPickerProps) {
```

---

### C. Compute `isAtCap` before the return

Add this one line right before the `return (` statement:

```tsx
// In adminMode there is no cap. In user mode, cap at maxCount.
const isAtCap = !adminMode && selected.length >= maxCount;
```

---

### D. Fix the product list button

Find the `<button>` rendered for each product in the scrollable list (the one with `onClick={() => toggle(product.id)}`). Update its `onClick` guard and `className` conditional:

```tsx
{sorted.map((product) => {
  const isSelected = selected.includes(product.id);
  const isDisabled = isAtCap && !isSelected; // NEW

  return (
    <button
      key={product.id}
      type="button"
      onClick={() => {
        if (isDisabled) return; // NEW guard
        toggle(product.id);
      }}
      disabled={isDisabled}    // NEW
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
        isSelected
          ? "border-orange-400 bg-orange-50/50 text-orange-700"
          : isDisabled                                              // NEW branch
          ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
          : "border-gray-100 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {/* ... checkbox + name content unchanged ... */}
    </button>
  );
})}
```

> **Note:** The existing `toggle()` function body itself does NOT need to change — the guard above is sufficient.

---

### E. Fix the footer label

Find the selection summary `<div>` at the bottom of the component (the one that currently prints `Max choice: {maxCount}`):

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<span>
  {selected.length} of {products.length} options selected (Max choice: {maxCount})
</span>

// ─── NEW ──────────────────────────────────────────────────────────────────────
<span>
  {selected.length} of {products.length} options selected
  {adminMode ? " (Admin — no limit)" : ` (Max choice: ${maxCount})`}
</span>
```

---

## 1.5 `(admin)/menu/page.tsx` — Exact Change

The `<SabjiPicker>` is rendered inside a `.map()` around line 486 (inside the `MealPanel` component). The `MealPanel` is rendered twice — once for LUNCH and once for DINNER — but they share the same component so one change covers both. Add `adminMode={true}`:

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<SabjiPicker
  key={group.key}
  label={`Sabji for category: ${group.label}`}
  products={pool}
  selected={draft.sabjiMap[group.key] ?? []}
  maxCount={group.sabjiCount}
  minRequired={group.sabjiCount}
  onChange={(ids) =>
    onUpdateDraft({
      sabjiMap: { ...draft.sabjiMap, [group.key]: ids },
    })
  }
/>

// ─── NEW ──────────────────────────────────────────────────────────────────────
<SabjiPicker
  key={group.key}
  label={`Sabji for category: ${group.label}`}
  products={pool}
  selected={draft.sabjiMap[group.key] ?? []}
  maxCount={group.sabjiCount}
  minRequired={group.sabjiCount}
  adminMode={true}             {/* NEW */}
  onChange={(ids) =>
    onUpdateDraft({
      sabjiMap: { ...draft.sabjiMap, [group.key]: ids },
    })
  }
/>
```

---

## 1.6 What Does NOT Change

- **`menu/[slug]/page.tsx`** — `toggleSabji()` already correctly enforces `thali.sabjiCount` for customers. Zero changes needed.
- **API / Database** — `sabjiConfig` stores product IDs chosen by admin. Storing more IDs is fine; no schema migration needed.
- **"Select All" button** in `SabjiPicker.tsx` — already correct; calls `onChange(products.map(p => p.id))` with no cap.
- **The `minRequired` dropdown** — still uses `maxCount` as the upper bound for how many sabjis a customer *must* pick. This is correct and unchanged.

---

## 1.7 Verification Checklist

- [ ] Open Admin > Daily Menu. Select a thali category with 7 sabji options.
- [ ] Confirm you can click and select **all 7 items** without any being greyed out.
- [ ] Footer reads: **"7 of 7 options selected (Admin — no limit)"**
- [ ] **"Select All (7)"** button still works and selects all at once.
- [ ] Save the menu. Open the public URL (`/menu/[slug]`).
- [ ] On the user page, confirm customers can still only select `thali.sabjiCount` sabjis (e.g. 1 or 2) — not all 7.
- [ ] Attempting to select a 3rd sabji on a `sabjiCount=2` thali shows the existing toast error.

---

---

# FIX #2 — User (Public) Menu Panel: Full Mobile Responsiveness

---

## 2.1 The Problem

The public menu page (`menu/[slug]/page.tsx`) and its two modals (`OtpModal.tsx`, `OrderConfirmModal.tsx`) were built for a desktop `max-w-2xl` layout. On mobile devices (320px–430px) these issues exist:

| Issue | Location | Symptom |
|-------|----------|---------|
| 2-col thali grid overflows on narrow screens | `menu/[slug]/page.tsx` Step 1 | Cards clip horizontally on 320–375px |
| 2-col sabji grid too narrow | `menu/[slug]/page.tsx` Step 2 | Gujarati names truncate badly, checkboxes squish |
| Bill summary price overflows name | `menu/[slug]/page.tsx` Bill section | Price column collides with thali name text |
| Place Order button buried in scroll | `menu/[slug]/page.tsx` | Users miss it on long menus |
| OTP modal bottom-sheet misaligned on Android | `OtpModal.tsx` | `max-w-lg mx-auto` has no effect on `position:fixed` |
| 6 OTP digit boxes overflow 320px viewport | `OtpModal.tsx` | Boxes clip off screen on small Androids |
| Order confirm modal clips on short screens | `OrderConfirmModal.tsx` | Modal taller than 667px viewport |
| Action buttons too narrow on 320px | `OrderConfirmModal.tsx` | "Yes, Confirm" label barely fits |

---

## 2.2 Files to Change

| File | Action |
|------|--------|
| `src/app/menu/[slug]/page.tsx` | Fix thali grid, sabji grid, bill layout, sticky Place Order button, safe-area padding |
| `src/components/public/OtpModal.tsx` | Fix bottom-sheet width/centering, OTP box sizing, use `dvh` |
| `src/components/public/OrderConfirmModal.tsx` | Fix viewport overflow, scrollable modal body, action button stacking |

---

## 2.3 Optional: Add `xs` Breakpoint to `tailwind.config.ts`

Several changes below use an `xs:` breakpoint. Add it once to avoid verbose `min-[480px]:` syntax everywhere:

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        xs: '480px',  // NEW — sits between base mobile and sm (640px)
      },
    },
  },
  plugins: [],
}

export default config
```

If you prefer not to touch the config, replace every `xs:` class in the snippets below with `min-[480px]:`.

---

## 2.4 `menu/[slug]/page.tsx` — Exact Changes

### A. Page outer wrapper — add safe-area bottom padding

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<div className="min-h-screen bg-gray-50/50 py-10 px-4 md:px-6">

// ─── NEW ──────────────────────────────────────────────────────────────────────
<div className="min-h-screen bg-gray-50/50 pt-8 pb-28 px-4 sm:py-10 sm:px-4 md:px-6">
```

> `pb-28` (112px) gives bottom clearance for the sticky "Place Order" button above the Android system nav bar. On `sm+` screens (`sm:py-10`) restores the original symmetric padding.

---

### B. Thali selector grid — single column on all sizes

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

// ─── NEW ──────────────────────────────────────────────────────────────────────
<div className="grid grid-cols-1 gap-2.5">
```

> **Rationale:** Each thali card contains a name, Gujarati subtitle, price badge, `sabjiCount` label, and fixed-item chips. Two columns at 375px gives each card only ~175px width — far too cramped. Single column reads cleanly on all phones. On the `max-w-2xl` desktop layout it still looks great.

---

### C. Thali card — fix price badge overlap

Find the `<button>` for each thali card. Update the flex layout and add `min-w-0` to the left content:

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<button
  className={`p-4 rounded-2xl border text-left flex justify-between items-start transition-all cursor-pointer shadow-sm ${...}`}
>
  <div className="space-y-1">                     {/* left side */}
    ...
  </div>
  <span className="text-sm font-extrabold px-2.5 py-0.5 rounded-lg border flex-shrink-0 ml-2 ${...}">
    {formatCurrency(thali.price)}
  </span>
</button>

// ─── NEW ──────────────────────────────────────────────────────────────────────
<button
  className={`p-3.5 sm:p-4 rounded-2xl border text-left flex justify-between items-start gap-2 transition-all cursor-pointer shadow-sm ${...}`}
>
  <div className="space-y-1 min-w-0 flex-1">      {/* left side — allow shrinking */}
    ...
  </div>
  <span className="text-sm font-extrabold px-2.5 py-0.5 rounded-lg border flex-shrink-0 self-start ${...}">
    {formatCurrency(thali.price)}
  </span>
</button>
```

> Key changes: added `gap-2` on parent, `min-w-0 flex-1` on left div, `self-start` on badge (removes `ml-2`).

---

### D. Sabji selector step header — prevent counter badge wrapping

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-2 py-0.5 rounded-md border border-orange-100">
  {count} / {total} selected
</span>

// ─── NEW ──────────────────────────────────────────────────────────────────────
<span className="text-[10px] bg-orange-50 text-orange-600 font-bold px-2 py-0.5 rounded-md border border-orange-100 whitespace-nowrap">
  {count} / {total} selected
</span>
```

> `whitespace-nowrap` prevents "3 / 7 selected" from wrapping to two lines on small viewports.

---

### E. Sabji selector grid — single column on all sizes

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

// ─── NEW ──────────────────────────────────────────────────────────────────────
<div className="grid grid-cols-1 gap-2">
```

> Same rationale as thali grid. Each sabji button has an English name, Gujarati name, and a checkbox. Two columns at 375px = ~170px per button — the Gujarati text truncates aggressively.

---

### F. Bill summary rows — prevent price overflow

Find every row in the bill breakdown section and apply `gap-2`, `min-w-0 flex-1`, and `flex-shrink-0`:

```tsx
// ─── OLD (thali row) ──────────────────────────────────────────────────────────
<div className="flex justify-between text-gray-700">
  <span>{selectedMenuThali.thali.name}</span>
  <span className="font-semibold">{formatCurrency(selectedMenuThali.thali.price)}</span>
</div>

// ─── NEW (thali row) ──────────────────────────────────────────────────────────
<div className="flex justify-between gap-2 text-gray-700">
  <span className="min-w-0 flex-1 break-words">{selectedMenuThali.thali.name}</span>
  <span className="font-semibold flex-shrink-0">{formatCurrency(selectedMenuThali.thali.price)}</span>
</div>
```

```tsx
// ─── OLD (add-on rows) ────────────────────────────────────────────────────────
<div key={addon.id} className="flex justify-between items-center text-sm">
  <span className="text-gray-700">{addon.name}</span>
  <span className="font-semibold text-gray-800">+{formatCurrency(addon.price)}</span>
</div>

// ─── NEW (add-on rows) ────────────────────────────────────────────────────────
<div key={addon.id} className="flex justify-between items-center gap-2 text-sm">
  <span className="text-gray-700 min-w-0 flex-1 truncate">{addon.name}</span>
  <span className="font-semibold text-gray-800 flex-shrink-0">+{formatCurrency(addon.price)}</span>
</div>
```

```tsx
// ─── OLD (total row) ──────────────────────────────────────────────────────────
<div className="border-t border-gray-200 pt-3 flex justify-between items-center">
  <p className="font-bold text-gray-900">Total</p>
  <p className="font-extrabold text-orange-600 text-lg">{formatCurrency(total)}</p>
</div>

// ─── NEW (total row) ──────────────────────────────────────────────────────────
<div className="border-t border-gray-200 pt-3 flex justify-between items-center gap-2">
  <p className="font-bold text-gray-900">Total</p>
  <p className="font-extrabold text-orange-600 text-lg flex-shrink-0">{formatCurrency(total)}</p>
</div>
```

---

### G. Place Order button — sticky bottom on mobile

Wrap the entire "Bill summary + Place Order" section with a sticky-on-mobile container. The section currently sits inside a `<div className="bg-white rounded-2xl border ...">`.

```tsx
// ─── OLD (bottom card wrapper) ────────────────────────────────────────────────
{selectedMenuThali && (
  <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
    {/* bill breakdown */}
    {/* place order button */}
  </div>
)}

// ─── NEW — split the sticky button out of the card ────────────────────────────
{selectedMenuThali && (
  <>
    {/* Bill breakdown card — stays in normal document flow */}
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
      {/* ... all bill breakdown JSX unchanged ... */}
    </div>

    {/* Place Order button — sticky on mobile, inline on desktop */}
    <div className="
      fixed bottom-0 left-0 right-0 z-30
      px-4 pb-6 pt-3
      bg-white/95 backdrop-blur-sm border-t border-gray-100 shadow-lg
      sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:z-auto
      sm:px-0 sm:pb-0 sm:pt-0 sm:bg-transparent sm:border-t-0 sm:shadow-none sm:backdrop-blur-none
    ">
      {/* ... Place Order button JSX unchanged ... */}
    </div>
  </>
)}
```

> On mobile: the button sticks to the bottom viewport edge, always visible. On `sm+`: `sm:relative` pulls it back into normal document flow. The `pb-28` added in **step A** ensures the last bill card is never hidden behind the sticky bar.

---

## 2.5 `OtpModal.tsx` — Exact Changes

### A. Bottom-sheet container — fix Android centering and use `dvh`

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col max-h-[90vh]
                bg-white rounded-t-3xl shadow-2xl max-w-lg mx-auto
                animate-in slide-in-from-bottom duration-300">

// ─── NEW ──────────────────────────────────────────────────────────────────────
<div className="
  fixed inset-x-0 bottom-0 z-50
  flex flex-col max-h-[92dvh]
  bg-white rounded-t-3xl shadow-2xl
  animate-in slide-in-from-bottom duration-300
  sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-full sm:max-w-lg
">
```

> **Why:** `max-w-lg mx-auto` has no effect on a `position:fixed` element with `left-0 right-0` — the element always stretches full width on Android. The fix uses `inset-x-0` for mobile full-width and overrides at `sm:` with the centred approach. `dvh` (dynamic viewport height) accounts for the software keyboard collapsing the viewport on iOS/Android.

---

### B. OTP digit boxes — scale down on 320px screens

Six `w-12` (48px) boxes + 5 gaps of 8px = 288px + 40px = 328px — this overflows a 320px viewport.

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<input
  className="w-12 h-14 text-center text-xl font-bold border-2 rounded-xl outline-none
             border-gray-200 focus:border-orange-500 transition-colors text-gray-900"
/>

// ─── NEW ──────────────────────────────────────────────────────────────────────
<input
  className="w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-bold
             border-2 rounded-xl outline-none
             border-gray-200 focus:border-orange-500 transition-colors text-gray-900"
/>
```

> On mobile: 6 × 40px + 5 × 8px = 280px — comfortably inside 320px. On `sm+`: returns to original `48×56px`.

Also reduce the gap in the container to match:

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>

// ─── NEW ──────────────────────────────────────────────────────────────────────
<div className="flex gap-1.5 sm:gap-2 justify-center" onPaste={handleOtpPaste}>
```

---

### C. Inner padding — reduce on mobile

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<div className="p-6 pb-10 overflow-y-auto">

// ─── NEW ──────────────────────────────────────────────────────────────────────
<div className="p-4 pb-8 sm:p-6 sm:pb-10 overflow-y-auto">
```

---

## 2.6 `OrderConfirmModal.tsx` — Exact Changes

### A. Modal inner container — scrollable with `dvh` cap

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
  <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5
                  animate-in slide-in-from-bottom duration-300 sm:slide-in-from-bottom-0 sm:zoom-in-95">

// ─── NEW ──────────────────────────────────────────────────────────────────────
<div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4">
  <div className="bg-white rounded-3xl p-4 sm:p-6 w-full max-w-md shadow-2xl
                  space-y-4 sm:space-y-5
                  max-h-[90dvh] overflow-y-auto
                  animate-in slide-in-from-bottom duration-300 sm:zoom-in-95">
```

> `max-h-[90dvh] overflow-y-auto` lets the entire modal scroll internally when it's taller than the viewport on short phones (SE, Pixel 4a). The `sm:zoom-in-95` animation is kept for desktop.

---

### B. Action buttons — stack vertically on very small screens

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<div className="flex gap-3">
  <button className="flex-1 py-3 rounded-xl border-2 border-gray-200 ...">
    Go Back
  </button>
  <button className="flex-1 py-3 rounded-xl bg-orange-500 ...">
    Yes, Confirm
  </button>
</div>

// ─── NEW ──────────────────────────────────────────────────────────────────────
<div className="flex flex-col-reverse xs:flex-row gap-2.5 sm:gap-3">
  <button className="w-full xs:flex-1 py-3 rounded-xl border-2 border-gray-200 ...">
    Go Back
  </button>
  <button className="w-full xs:flex-1 py-3 rounded-xl bg-orange-500 ...">
    Yes, Confirm
  </button>
</div>
```

> `flex-col-reverse` stacks "Yes, Confirm" on top (more prominent CTA) and "Go Back" below on very small screens. `xs:flex-row` returns to side-by-side at 480px+.

---

### C. User info text — prevent long names overflowing

```tsx
// ─── OLD ──────────────────────────────────────────────────────────────────────
<p className="font-bold text-gray-900 text-base">{user.name}</p>
<p className="text-sm text-gray-600">{user.companyName}</p>
<p className="text-sm text-gray-400">+91 {user.number}</p>

// ─── NEW ──────────────────────────────────────────────────────────────────────
<p className="font-bold text-gray-900 text-sm sm:text-base truncate">{user.name}</p>
<p className="text-xs sm:text-sm text-gray-600 truncate">{user.companyName}</p>
<p className="text-xs sm:text-sm text-gray-400">+91 {user.number}</p>
```

---

## 2.7 Verification Checklist

Test in Chrome DevTools > **Toggle device toolbar** at these sizes:
- `375×812` — iPhone 12/13
- `390×844` — iPhone 14
- `360×780` — Pixel 6
- `320×568` — iPhone SE / small Android

- [ ] **Thali cards** — single column, price badge aligned right without overlapping name text
- [ ] **Sabji list** — single column, Gujarati names fully visible and not truncated
- [ ] **Bill rows** — thali name and price never collide; long names wrap cleanly
- [ ] **Place Order button** — sticks to the bottom viewport on mobile; disappears into flow on desktop
- [ ] **Content not hidden** — scroll the page to the very bottom; the last visible element is not hidden behind the sticky button
- [ ] **OTP Modal** — open on 375px: all 6 digit boxes visible without horizontal scroll
- [ ] **OTP Modal on 320px** — all 6 boxes still fit (40px × 6 + gaps = 280px)
- [ ] **Order Confirm Modal** — on a 667px-height device, the modal is fully scrollable; both buttons are tappable
- [ ] **Real device** — test on Android Chrome + iOS Safari (dvh supported on iOS 15.4+, Chrome 108+)

---

---

# Implementation Order & Risks

## Recommended Order

1. **Fix #1 first** — 3 lines, zero risk, can be committed independently in 15 minutes.
2. **Fix #2 second** — purely additive Tailwind class changes, no logic changes, no API changes.

## Risk Table

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Admin saves more sabjis than expected, confuses customers | Low (admin is a trusted operator) | No mitigation needed — by design |
| `dvh` unit unsupported on old Android WebView (pre-2022) | Low (target audience likely has modern phones) | Replace `90dvh` with `90vh` as fallback |
| Sticky Place Order button overlaps content on some Android | Low if `pb-28` is applied | Increase to `pb-32` and test on Pixel 6 Chrome |
| `xs:` breakpoint not in Tailwind config | Will cause build error | Either add the config entry (section 2.3) or replace `xs:` with `min-[480px]:` |

---

*SoftVibe Services · VD's Hunger Hub · Fix #1 + Fix #2 Implementation Guide*