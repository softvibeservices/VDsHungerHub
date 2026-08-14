# VDH HungerHub — Admin Panel Theme Alignment & SaaS Polish
## Implementation Plan for AI Coding Agent (Claude Code / Cursor)

**Target repo:** `softvibeservices-vdshungerhub` (Next.js 14+ App Router, Tailwind CSS v4, TypeScript)
**Scope:** `src/app/(admin)/**`, `src/components/admin/**`, `src/components/ui/**`
**Goal:** Every admin page must look like it belongs to the same product. One accent color, one container width, one heading system, one filter/toolbar pattern, one tab pattern, zero raw/duplicated UI, zero dead CSS classes.

> **Execution rule for the agent:** Work section by section, in the order given in §9. After each file edit, run the grep commands in §8 relevant to that file before moving to the next. Do not batch-edit files you have not opened and confirmed match the "Before" snippet — some snippets below are exact anchors taken directly from the current source; if a file doesn't match exactly, re-read the file first and adapt the edit, don't skip it.

---

## 0. Why this document exists

This is not a redesign from scratch — the base UI kit in `src/components/ui/` (Button, Input, Select, Badge, Table, Modal, SearchInput) is already well built and about 90% consistent. The problem is that **individual pages stopped using it consistently**, and one module (Credit) quietly grew its own competing color palette. That's exactly what makes a client project start looking like a side project: every page was built correctly in isolation, but nobody enforced one system across all of them.

This plan:
1. Documents every concrete inconsistency found in the current code (§1), with file + line references.
2. Defines the one design system every page must follow (§2–§4).
3. Adds two small shared components that remove the need for pages to hand-roll layout (§5).
4. Gives exact before/after edits for every affected file (§6–§7).
5. Gives grep-based QA commands so the agent (or you) can mechanically prove the fix is complete (§8).

---

## 1. Audit Findings — what's actually inconsistent right now

### 1.1 A second, competing color theme exists inside the Credit module
`src/app/(admin)/credit/page.tsx` and `src/app/(admin)/credit/_HistoryModal.tsx` hardcode a navy-and-gold palette (`#0F1E3D`, `#1B2D5A`, `#C9A84C`) that appears nowhere else in the app. The rest of the admin panel — Button, Input, Select, Sidebar active states, Badge, every other page — uses **orange-500 as the single accent color** on a white/gray-900 neutral base. Examples:
- `credit/page.tsx:327-328` — page title rendered in `text-[#0F1E3D]` with a `text-[#C9A84C]` icon, instead of the standard `text-gray-900` title style every other page uses.
- `credit/page.tsx:349-351` — the "Export PDF Report" button bypasses the shared `Button` primary style (orange) and hardcodes `bg-[#0F1E3D] hover:bg-[#1B2D5A]` with a gold icon.
- `credit/_HistoryModal.tsx:179` — an entire dark navy hero panel (`bg-gradient-to-r from-navy-900 to-indigo-900 bg-[#0F1E3D]`) is nested inside an otherwise light, white-card modal. Note this line is also buggy on its own: `from-navy-900`/`to-indigo-900` aren't real Tailwind color stops for a "navy" scale (Tailwind has no `navy` color) and get immediately overridden by the flat `bg-[#0F1E3D]` right after — the gradient classes are dead code.
- `credit/_HistoryModal.tsx:181,223,232,242,267` — more `#0F1E3D` / `#C9A84C` usage for text, focus rings, and stat numbers.
- Gold also leaks into two places outside Credit: the sidebar brand label (`Sidebar.tsx:150`, `text-[#C9A84C]`) and the auth-checking spinner (`(admin)/layout.tsx:65`, `border-[#C9A84C]`).

**Decision:** Retire `#0F1E3D` and `#C9A84C` entirely. Single accent = orange-500/600, matching the other 90% of the app. (If a two-tone premium brand identity is wanted later, that's a deliberate rebrand applied everywhere at once — not something left half-applied to one page. Default here is full consistency.)

### 1.2 Invalid / dead Tailwind utility classes (silently do nothing)
Tailwind's default palette only defines steps `50,100,200,300,400,500,600,700,800,900,950`. The following classes reference **steps that don't exist**, so Tailwind generates no CSS for them and the element silently falls back to no border-color / no text-color override:
- `border-gray-250` → `credit/page.tsx:413,420`, `orders/page.tsx:391,396,603`, `settings/meal-cutoff/_OrderWindowTimeline.tsx:93`, **`components/ui/TimeField.tsx:133`** (a shared component — every page using TimeField is affected)
- `bg-gray-150` → `settings/meal-cutoff/_OrderWindowTimeline.tsx:93`
- `bg-orange-550` → `orders/page.tsx:563`
- `hover:text-orange-650` → `components/admin/SabjiPicker.tsx:62`
- `text-yellow-750` → `orders/page.tsx:373` area (pending-count pill)

**Decision:** Every one of these gets clamped to the nearest real step (`250→200`, `150→100`, `550→500`, `650→600`, `750→700`). This is a pure bugfix, not a style opinion.

### 1.3 The page title is rendered twice on almost every page
`src/components/admin/Header.tsx` already renders a per-route title + description in the sticky top bar via a `pageTitles` map (e.g. `/users` → "Users" / "Manage customer accounts, verification, and access"). But most page bodies **also** render their own `<h1>`/`<h2>` + description directly underneath:
- `dashboard/page.tsx:139` renders "Today" (contextual, not a strict duplicate — keep, see §7.1)
- `orders/page.tsx:363` renders "Orders" again
- `users/page.tsx:356` renders "Users" / "Manage tiffin subscribers" again
- `staff/page.tsx:290` renders "Manage Staff" again
- `companies/page.tsx:267` renders "Companies" / "Manage tiffin client companies" again
- `catalog/layout.tsx:5-6` renders **the exact same text** Header.tsx already shows for `/catalog` ("Catalog" / "Manage products, thalis, and categories") — a byte-for-byte duplicate on screen
- `credit/page.tsx:327-330` renders a *third, different* title ("Admin Credit & Ledger Statement") that doesn't even match Header.tsx's "Credit" — so the page title changes text depending on whether you look at the top bar or the page body
- `settings/meal-cutoff/page.tsx:87` renders its own heading too

This wastes vertical space, and in Credit's case actively shows **two different titles for the same page**.

**Decision:** Header.tsx is the single, only owner of the page title + description. Every per-page title/description block is deleted. Pages keep only their action buttons and filters (see §5.1 `PageToolbar`).

### 1.4 Every page invents its own container width and vertical rhythm
| Page | Container | Vertical rhythm |
|---|---|---|
| Dashboard | `max-w-6xl mx-auto` | `space-y-6` |
| Orders | `max-w-6xl mx-auto` | `space-y-6` |
| Daily Menu | `max-w-6xl mx-auto` | `space-y-3` |
| Users | `max-w-6xl mx-auto` | `space-y-5` |
| Companies | `max-w-5xl mx-auto` | `space-y-5` |
| Catalog (layout) | `max-w-5xl mx-auto` | `space-y-5` |
| Settings/meal-cutoff | `max-w-4xl mx-auto` | `space-y-6` |
| Staff | *(no constraint — full width)* | `space-y-6` |
| Credit | *(no constraint — full width)* | `space-y-4` |

Five different max-widths and four different spacing scales, all meant to express the same thing: "this is a page." That's the single biggest reason the app reads as inconsistent even before you look at colors.

**Decision:** Container width is set **once**, in `(admin)/layout.tsx`, and removed from every individual page. Vertical rhythm is standardized to `space-y-6` at the page root everywhere.

### 1.5 Heading weight is inconsistent for the same visual role
Page/section titles use `font-bold` (Dashboard, Orders, Users, Staff, Companies, Catalog), `font-extrabold` (Settings/meal-cutoff), and `font-black` (Credit) interchangeably for what is supposed to be the identical "page heading" style. Stat numbers on the Credit summary cards also use `font-black` while the Dashboard's identical-purpose `StatCard` uses `font-bold`.

**Decision:** One heading weight scale, defined in §4.

### 1.6 Two incompatible tab components exist for the same UI concept
- `catalog/_CatalogTabs.tsx` — segmented "pill" tabs: `bg-gray-100 p-1 rounded-xl`, active tab gets `bg-white shadow-sm`.
- `companies/page.tsx:279-291` — underlined tabs: `border-b-2`, active tab gets `border-orange-500 text-orange-600`, inline in the page instead of a component.

Neither is wrong on its own (pill tabs suit section navigation, underline tabs suit record-status filters — both are legitimate SaaS patterns), but they're implemented as one-off, uncomponentized code with no shared sizing/typography/transition contract, so any third tab need in the app will likely invent a *third* pattern.

**Decision:** Extract both into one shared `<Tabs>` component with a `variant` prop (§5.2). Same component, same typography/transition rules, two visual variants used deliberately (pill = section nav, underline = status filter).

### 1.7 Filter/toolbar bars are laid out differently on every page, and several bypass the shared Input/Select components
- Staff wraps its filter row in a white bordered card: `bg-white p-4 rounded-2xl border border-gray-200 shadow-sm`.
- Orders wraps its filter grid in a slightly different card: `bg-white border border-gray-200 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm`.
- Credit wraps its filter block in yet another variant: `bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm space-y-3`.
- Users and Companies leave filters bare on the gray page background (`flex flex-wrap gap-3`, no card at all).
- Orders (`orders/page.tsx:388-397`) and Credit (`credit/page.tsx:411-421`, `_HistoryModal.tsx:214-232`) use **raw `<input type="date">` and raw `<select>`** with one-off classes instead of the shared `Input`/`Select` components — meaning date pickers and one status/company dropdown look and behave slightly differently from every other dropdown/date field in the app (and are the source of the `border-gray-250` dead-class bug in 1.2).

**Decision:** One shared `<PageToolbar>` layout (filters left, actions right, no card, sits directly under the page header) and mandatory use of `Input`/`Select` for every field, everywhere (§5.1, §4).

### 1.8 Sidebar mixes two accent colors with no defined rule
`components/admin/Sidebar.tsx` uses `orange-500`/`orange-400` for active nav highlighting, the user avatar, and the online status dot — correct, matches the rest of the app — but then uses gold `#C9A84C` for the "Admin Panel"/"Staff Panel" wordmark label directly above it. Two accents sitting three lines apart with no system.

**Decision:** Covered by 1.1 — gold is removed, that label becomes `text-gray-400` (matches the rest of the sidebar's secondary-text treatment).

---

## 2. Design direction / reference

The existing base (white cards, `gray-50` page background, `orange-500` accent, `rounded-lg`/`rounded-xl`/`rounded-2xl` radius scale, subtle `border-gray-200` + `shadow-sm` instead of heavy drop shadows, Inter font) is already the right direction for a **professional, data-dense SaaS admin** — it reads similarly to Stripe Dashboard, Linear, and Vercel's dashboard in structure: a fixed dark sidebar, a light content canvas, restrained use of a single accent color reserved for primary actions and active states, and generous but not excessive whitespace. The fix here is discipline, not reinvention:

- **One accent color** (orange-500/600) used only for: primary buttons, active nav/tab states, focus rings, links, and small "brand" touches (logo glow, active dot). Never for large blocks of chrome.
- **One neutral scale** (`gray-*`) for everything else — text, borders, backgrounds, secondary buttons.
- **One semantic palette** for status (already defined in `Badge.tsx` — emerald=success/active, amber=warning/lunch, red=danger, blue=info, indigo=dinner, gray=neutral/inactive). Reuse these everywhere status needs color; never invent a new status color per page.
- **Consistent spacing/typography/radius scale** (§4) so every page's "shape" is predictable even before you read its content.

No new fonts, no new component library, no visual redesign of the sidebar/header/table/button — those are already correct and should be left alone except for the specific line-level fixes below.

---

## 3. Design tokens

Tailwind v4 is already in use (`@import "tailwindcss"` in `globals.css`, `@tailwindcss/postcss` in `package.json`, no `tailwind.config.js`). Given the codebase's existing convention of using Tailwind utilities directly (including arbitrary values like `w-[260px]`) rather than a custom CSS-variable color layer, **do not** introduce a parallel color-token system — that would be a second abstraction competing with the first fix. Instead:

- Colors, radius, spacing, typography = standard Tailwind utility classes, used per the rules table in §4. No changes to `globals.css` are required — it is already clean (no violations found there).
- The only new "token" is a single container width, set once in the admin layout (§6.2).

---

## 4. Design system rules (reference table — apply everywhere)

| Concern | Rule |
|---|---|
| **Page container** | `max-w-[1440px] mx-auto w-full`, set **once** in `(admin)/layout.tsx`'s `<main>`. Never add a `max-w-*` wrapper inside an individual page again. If a page needs a narrower reading column for a form (e.g. Settings), wrap only that inner form card in `max-w-2xl` — the page-level container stays full width. |
| **Page title / description** | Owned exclusively by `components/admin/Header.tsx`'s `pageTitles` map. Never re-render a page title or description inside a page body. |
| **Page-root vertical rhythm** | `space-y-6` on the outermost element every page returns. |
| **Cards / panels / table container / modal** | `bg-white border border-gray-200 rounded-2xl shadow-sm`. Padding `p-4 md:p-5` for panels, `p-5 py-4` for modal sections (already correct in `Modal.tsx`). |
| **Interactive controls (input, select, search, buttons size sm/md)** | `rounded-lg`. |
| **Large/standalone buttons, date pills, icon-only buttons** | `rounded-xl`. |
| **Accent color** | `orange-500` default state, `orange-600` hover/active, `orange-500/30` focus ring. Never a hex literal, never `gray-250`/`orange-550`/`orange-650`/`yellow-750`/`gray-150` or any other non-existent Tailwind step. |
| **Page/section title weight** | `font-bold text-gray-900` (Header.tsx already correct — do not change to extrabold/black anywhere). |
| **Eyebrow / filter label** | `text-[10px] font-bold text-gray-400 uppercase tracking-wider` (already used correctly in Orders' filter labels and Sidebar's section labels — reuse this exact class string anywhere a small caption label is needed). |
| **Section subheading** (e.g. Dashboard's "Today") | `text-base font-semibold text-gray-900`. |
| **Stat/metric numbers** | `text-2xl font-bold text-gray-900` (or semantic color for the number itself, e.g. `text-red-600` for an outstanding-balance figure) — never `font-black`. |
| **Body/table text** | `text-sm text-gray-700`. |
| **Buttons** | Always the shared `Button` component. No raw `<button className="...">` for anything that is a primary/secondary/danger/ghost action. |
| **Text inputs, selects, dates** | Always the shared `Input` / `Select` components (`Input` accepts `type="date"` directly — no need for a separate date component). No raw `<input>`/`<select>`. |
| **Tabs** | Always the shared `Tabs` component (§5.2) — `variant="pill"` for section/view navigation, `variant="underline"` for record-status filtering. |
| **Filter + action row** | Always the shared `PageToolbar` component (§5.1) — filters left, actions right, single row, no card wrapper. |
| **Status colors** | Only via `Badge`'s existing variant map (`active/inactive/lunch/dinner/success/warning/danger/info/neutral`). Don't hardcode a new status color inline. |

---

## 5. New shared components

### 5.1 `src/components/ui/PageToolbar.tsx` (new file)

Replaces every page's one-off "title row + filter row" layout with one component. Filters go on the left, primary actions on the right, on one row that wraps on mobile. `children` is an optional second row for things that don't fit the left/right split (Credit's date-range presets, Orders' live count pills).

```tsx
import { cn } from "@/lib/utils";

interface PageToolbarProps {
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function PageToolbar({
  filters,
  actions,
  children,
  className,
}: PageToolbarProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {filters && (
          <div className="flex flex-wrap items-center gap-3">{filters}</div>
        )}
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
```

### 5.2 `src/components/ui/Tabs.tsx` (new file)

Unifies `_CatalogTabs.tsx`'s pill pattern and Companies' inline underline pattern into one component with two variants sharing the same typography/transition rules.

```tsx
"use client";

import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ElementType;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  variant?: "pill" | "underline";
  className?: string;
}

export default function Tabs({
  items,
  value,
  onChange,
  variant = "underline",
  className,
}: TabsProps) {
  if (variant === "pill") {
    return (
      <div className={cn("flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit", className)}>
        {items.map(({ value: v, label, icon: Icon }) => {
          const isActive = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                isActive
                  ? "bg-white text-gray-900 shadow-sm font-bold"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {Icon && <Icon size={15} />}
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("border-b border-gray-200", className)}>
      <nav className="flex gap-4" aria-label="Tabs">
        {items.map(({ value: v, label }) => {
          const isActive = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "py-3 px-1 border-b-2 font-medium text-sm transition-all focus:outline-none capitalize",
                isActive
                  ? "border-orange-500 text-orange-600 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
```

No other new components are needed — `Input`, `Select`, `Button`, `Badge`, `Table`, `Modal`, `SearchInput`, `ConfirmDialog`, `ToggleSwitch`, `Loader` all already follow the correct system and stay as-is except for the specific line fixes in §6.

---

## 6. Global file edits

### 6.1 `src/app/globals.css`
No changes required — file is already clean. Confirm no edits are made here.

### 6.2 `src/app/(admin)/layout.tsx`
Two fixes: (a) set the single content max-width here so no page needs its own, (b) remove the gold spinner.

**Before:**
```tsx
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white space-y-4">
        <div className="w-10 h-10 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-gray-300">Verifying Admin Permissions…</p>
      </div>
```
**After:**
```tsx
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white space-y-4">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-gray-300">Verifying Admin Permissions…</p>
      </div>
```

**Before:**
```tsx
        <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-12">{children}</main>
```
**After:**
```tsx
        <Header onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-12">
          <div className="max-w-[1440px] mx-auto w-full">{children}</div>
        </main>
```

### 6.3 `src/components/admin/Sidebar.tsx`
Remove gold from the brand label.

**Before:**
```tsx
              <p className="text-[#C9A84C] text-[10px] font-semibold tracking-widest uppercase">{panelLabel}</p>
```
**After:**
```tsx
              <p className="text-gray-400 text-[10px] font-semibold tracking-widest uppercase">{panelLabel}</p>
```

### 6.4 `src/components/ui/Table.tsx`
Bump container radius from `rounded-xl` to `rounded-2xl` to match card/modal radius rule in §4.

**Before:**
```tsx
      className={cn(
        "bg-white rounded-xl border border-gray-200 overflow-hidden",
        className
      )}
```
**After:**
```tsx
      className={cn(
        "bg-white rounded-2xl border border-gray-200 overflow-hidden",
        className
      )}
```

### 6.5 `src/components/ui/TimeField.tsx`
Fix the dead `border-gray-250` class (this is a shared component — fixing it fixes every page that uses it, including Settings/meal-cutoff) and unify the focus ring opacity to `/30` to match `Input`/`Select`/`SearchInput`.

**Before:**
```tsx
          "w-full flex items-center justify-between px-3.5 py-2.5 text-sm border border-gray-250 bg-white rounded-xl shadow-sm hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all cursor-pointer font-bold text-gray-900",
```
**After:**
```tsx
          "w-full flex items-center justify-between px-3.5 py-2.5 text-sm border border-gray-200 bg-white rounded-xl shadow-sm hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all cursor-pointer font-bold text-gray-900",
```

### 6.6 `src/components/admin/SabjiPicker.tsx`
Fix the dead `orange-650` class.

**Before:**
```tsx
            className="text-xs text-orange-500 hover:text-orange-650 font-semibold cursor-pointer"
```
**After:**
```tsx
            className="text-xs text-orange-500 hover:text-orange-600 font-semibold cursor-pointer"
```

---

## 7. Per-page edits

For each page: **(a)** delete the local page-title block (Header.tsx already owns it — see §1.3), **(b)** remove any local `max-w-*`/root `space-y-*` wrapper and replace with the standard `space-y-6` root (container width now comes from the layout, §6.2), **(c)** rebuild the filter/action row using `PageToolbar`.

### 7.1 Dashboard — `src/app/(admin)/dashboard/page.tsx`

Dashboard's "Today" heading is contextual (it labels the "today's menu status" section, it isn't a duplicate of the page title "Dashboard"), so **keep it**, but standardize its container and confirm its weight matches the rules table.

**Before:**
```tsx
    <div className="space-y-6 max-w-6xl mx-auto">
```
**After:**
```tsx
    <div className="space-y-6">
```
Locate the `<h1 className="text-xl font-bold text-gray-900 leading-tight">Today</h1>` block — leave the heading text and weight as-is (`font-bold` already matches the rules table's section-subheading intent closely enough given it's a compact dashboard header row; no change needed there beyond the container fix above).

Also apply the `StatCard` number-weight rule check: `text-2xl font-bold text-gray-900` at line 59 is already correct — no change.

### 7.2 Orders — `src/app/(admin)/orders/page.tsx`

**Step 1 — container:**
**Before:** `<div className="max-w-6xl mx-auto space-y-6">`
**After:** `<div className="space-y-6">`

**Step 2 — delete the duplicate title, keep the live-count pills and date/refresh controls, move them into `PageToolbar`.**

Find the block starting at:
```tsx
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-orange-500 flex-shrink-0" size={22} />
            <h2 className="text-xl font-bold text-gray-900 leading-none">Orders</h2>
          </div>
          {data && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 sm:pt-0">
              ...status pills...
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="text-sm border border-gray-250 rounded-xl px-3 py-2 bg-white text-gray-800 font-medium focus:ring-2 focus:ring-orange-500/30 outline-none cursor-pointer shadow-sm hover:border-gray-300 transition-colors"
          />
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-250 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-40 shadow-sm"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>
```
Replace with:
```tsx
      {/* Live status pills + date/refresh controls */}
      <PageToolbar
        filters={
          data && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-extrabold bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Total: {data.totalOrders}
              </span>
              <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm border ${
                pendingCount > 0
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse"
                  : "bg-gray-50 text-gray-500 border-gray-200"
              }`}>
                Pending: {pendingCount}
              </span>
              <span className="text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Lunch: {data.lunch.count}
              </span>
              <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider shadow-sm">
                Dinner: {data.dinner.count}
              </span>
            </div>
          )
        }
        actions={
          <>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-auto"
            />
            <Button
              variant="secondary"
              onClick={() => fetchOrders(true)}
              disabled={refreshing}
              leftIcon={<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />}
            >
              Refresh
            </Button>
          </>
        }
      />
```
Note: `text-yellow-750` is fixed to `text-yellow-700` in the snippet above (§1.2). Add `import PageToolbar from "@/components/ui/PageToolbar";` and `import Input from "@/components/ui/Input";` to the top imports.

**Step 3 — the raw company/status `<select>`s.** Find (around what was line ~427 before the edit above, re-locate after editing):
```tsx
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 text-gray-900 bg-white rounded-lg appearance-none focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors pr-9 cursor-pointer shadow-sm hover:border-gray-300"
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <Building2 size={15} />
              </div>
```
Replace the whole `<div className="relative">...</div>` wrapper around it with the shared `Select`:
```tsx
              <Select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                placeholder="All Companies"
                options={companies.map((c) => ({ value: c.id, label: c.name }))}
              />
```
Do the same for the status `<select>` immediately below it (same pattern — convert to `Select` with its existing options list). Add `import Select from "@/components/ui/Select";` if not already imported.

**Step 4 — dead classes remaining in this file.** Also fix, wherever they still appear after the edits above:
- `bg-orange-550` → `bg-orange-500` (order-count avatar badge, was line 563)
- any remaining `border-gray-250` → `border-gray-200` (e.g. the "Clear filters" button around the old line 603) — and convert that raw `<button>` to `<Button variant="secondary" size="sm">` per the rules table.

### 7.3 Users — `src/app/(admin)/users/page.tsx`

**Before:**
```tsx
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage tiffin subscribers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Upload size={15} />} onClick={() => setBulkOpen(true)}>
            Bulk Import
          </Button>
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => { setEditUser(null); setModalOpen(true); }}
          >
            Add User
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or number..." className="w-64" />
        <Select options={companyOptions} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-52" />
        <Select options={verifiedOptions} value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value)} className="w-48" />
        <Select options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44" />
      </div>
```
**After:**
```tsx
    <div className="space-y-6">
      <PageToolbar
        filters={
          <>
            <SearchInput value={search} onChange={setSearch} placeholder="Search by name or number..." className="w-64" />
            <Select options={companyOptions} value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="w-52" />
            <Select options={verifiedOptions} value={verifiedFilter} onChange={(e) => setVerifiedFilter(e.target.value)} className="w-48" />
            <Select options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44" />
          </>
        }
        actions={
          <>
            <Button variant="secondary" size="sm" leftIcon={<Upload size={15} />} onClick={() => setBulkOpen(true)}>
              Bulk Import
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus size={16} />}
              onClick={() => { setEditUser(null); setModalOpen(true); }}
            >
              Add User
            </Button>
          </>
        }
      />
```
Add `import PageToolbar from "@/components/ui/PageToolbar";`. Everything from `<Table columns={columns} ...` onward stays unchanged — just make sure the closing `</div>` of the root still matches (root wrapper is now a single `<div className="space-y-6">`).

### 7.4 Staff — `src/app/(admin)/staff/page.tsx`

**Before:**
```tsx
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Manage Staff</h2>
          <p className="text-xs text-gray-500 mt-1">
            Create, moderate, and manage permissions of staff members
          </p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={15} />} onClick={handleOpenAdd}>
          Add Staff Member
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search staff by name or mobile..."
          className="w-full md:max-w-md"
        />

        <div className="w-full md:w-48">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "ALL", label: "All Statuses" },
              { value: "ACTIVE", label: "Active Only" },
              { value: "INACTIVE", label: "Inactive Only" },
            ]}
          />
        </div>
      </div>
```
**After:**
```tsx
    <div className="space-y-6">
      <PageToolbar
        filters={
          <>
            <SearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search staff by name or mobile..."
              className="w-64"
            />
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-48"
              options={[
                { value: "ALL", label: "All Statuses" },
                { value: "ACTIVE", label: "Active Only" },
                { value: "INACTIVE", label: "Inactive Only" },
              ]}
            />
          </>
        }
        actions={
          <Button variant="primary" leftIcon={<Plus size={15} />} onClick={handleOpenAdd}>
            Add Staff Member
          </Button>
        }
      />
```
Add `import PageToolbar from "@/components/ui/PageToolbar";`. This also removes the white-card wrapper around the filter bar per §1.7's decision (no card, matches Users/Companies/Orders now that Orders' pill/date row is separated from its filter grid — see note below).

> **Note on Orders' filter grid card:** Orders' *second* filter block (`bg-white border border-gray-200 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm` — the Search/Company/Status/Sort 4-column grid) is a deliberately denser, multi-field filter panel and is fine to keep as a bordered card, since it holds 4 fields plus labels and benefits from visual grouping (this matches Credit's equally dense filter panel, §7.6). The rule in §1.7 is about the **simple, 1–3 field toolbar row** (title-row replacement) being card-free via `PageToolbar` — dense multi-field filter grids (Orders' 4-field grid, Credit's date-range + 4-field grid) may stay in a `bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-sm` card **as a second element below `PageToolbar`**, since that's a genuinely different, denser UI need than a simple search+button row. Keep Orders' existing 4-column filter grid card as-is (just fix the `gray-250`/raw-select issues per §7.2 step 3) — do not try to merge it into `PageToolbar`.

### 7.5 Companies — `src/app/(admin)/companies/page.tsx`

**Before:**
```tsx
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Companies</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage tiffin client companies</p>
        </div>
        <Button
          variant="primary"
          leftIcon={<Plus size={16} />}
          onClick={() => { setEditCompany(null); setModalOpen(true); }}
        >
          Add Company
        </Button>
      </div>

      {/* Tabs Layout */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4" aria-label="Tabs">
          {(["verified", "pending", "flagged"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-all focus:outline-none capitalize ${
                tab === t
                  ? "border-orange-500 text-orange-600 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search companies..." className="max-w-xs" />
      </div>
```
**After:**
```tsx
    <div className="space-y-6">
      <PageToolbar
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            onClick={() => { setEditCompany(null); setModalOpen(true); }}
          >
            Add Company
          </Button>
        }
      />

      <Tabs
        variant="underline"
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
        items={[
          { value: "verified", label: "Verified" },
          { value: "pending", label: "Pending" },
          { value: "flagged", label: "Flagged" },
        ]}
      />

      <div className="flex flex-wrap gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search companies..." className="max-w-xs" />
      </div>
```
Add `import PageToolbar from "@/components/ui/PageToolbar";` and `import Tabs from "@/components/ui/Tabs";`.

### 7.6 Credit — `src/app/(admin)/credit/page.tsx` (main de-navy-fication)

**Step 1 — container + duplicate/mismatched title.**
**Before:**
```tsx
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-[#0F1E3D] flex items-center gap-2">
            <Wallet className="w-6 h-6 text-[#C9A84C]" /> Admin Credit & Ledger Statement
          </h1>
          <p className="text-xs text-gray-500">
            Track user balances, filter by custom date ranges, record payments, and export PDF statements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyGroupDigest}
            className="gap-1.5 text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100 font-bold text-xs"
          >
            <Copy className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Digest
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleBulkExportPdf}
            className="gap-1.5 bg-[#0F1E3D] hover:bg-[#1B2D5A] text-white border-0 font-bold text-xs"
          >
            <Download className="w-3.5 h-3.5 text-[#C9A84C]" /> Export PDF Report
          </Button>
        </div>
      </div>
```
**After:**
```tsx
    <div className="space-y-6">
      <PageToolbar
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyGroupDigest}
              className="gap-1.5 text-emerald-700 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100"
            >
              <Copy className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp Digest
            </Button>

            <Button
              variant="primary"
              size="sm"
              onClick={handleBulkExportPdf}
            >
              <Download className="w-3.5 h-3.5" /> Export PDF Report
            </Button>
          </>
        }
      />
```
This removes the duplicate/mismatched title entirely — Header.tsx's existing "Credit / Track customer balances, credit, and payments" entry already covers it, and remains the single source of truth. Add `import PageToolbar from "@/components/ui/PageToolbar";`.

**Step 2 — summary metric cards: `font-black` → `font-bold` (3 instances).**
**Before (repeat pattern ×3, only the color class differs per card):**
```tsx
            <p className="text-xl font-black text-red-600 mt-0.5">
```
```tsx
            <p className="text-xl font-black text-emerald-600 mt-0.5">
```
```tsx
            <p className="text-xl font-black text-gray-900 mt-0.5">
```
**After:** change `font-black` to `font-bold` and `text-xl` to `text-2xl` in all three, matching the Dashboard `StatCard` number style exactly (§4 rules table).

**Step 3 — the date-range toolbar (the worst offender).**
**Before:**
```tsx
      {/* Unified Filter & Date Range Toolbar */}
      <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        {/* Top Row: Inline Date Range & Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-extrabold text-[#0F1E3D] flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#C9A84C]" /> Statement Period:
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-gray-250 rounded-lg bg-gray-50 text-gray-900 font-bold outline-none focus:ring-1 focus:ring-[#C9A84C]"
            />
            <span className="text-xs text-gray-400 font-bold">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-gray-250 rounded-lg bg-gray-50 text-gray-900 font-bold outline-none focus:ring-1 focus:ring-[#C9A84C]"
            />
          </div>
```
**After:**
```tsx
      {/* Unified Filter & Date Range Toolbar */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        {/* Top Row: Inline Date Range & Quick Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" /> Statement Period:
            </span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-auto"
            />
            <span className="text-xs text-gray-400 font-bold">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-auto"
            />
          </div>
```
Note the padding is bumped from `p-3.5`/`space-y-3` to `p-4 md:p-5`/`space-y-4` to match the rules table's card padding standard (was previously its own one-off value). Add `import Input from "@/components/ui/Input";`.

**Step 4 — remaining gold icons in this file (2 more instances).**
- `<History className="w-3.5 h-3.5 text-[#0F1E3D]" /> Statement` → `<History className="w-3.5 h-3.5" /> Statement` (icon inherits button text color; drop the override entirely)
- `<Download className="w-3.5 h-3.5 text-[#0F1E3D]" /> PDF` → `<Download className="w-3.5 h-3.5" /> PDF`
- `<Building2 className="w-4 h-4 text-[#C9A84C]" /> {group.companyName}` → `<Building2 className="w-4 h-4 text-gray-400" /> {group.companyName}`

### 7.7 Credit — `src/app/(admin)/credit/_HistoryModal.tsx`

**Step 1 — the dark navy hero panel becomes a light panel matching the rest of the app.**
**Before:**
```tsx
            {/* Date Range Selector Toolbar */}
            <div className="bg-gradient-to-r from-navy-900 to-indigo-900 bg-[#0F1E3D] p-4 rounded-xl text-white space-y-3 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#C9A84C] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Statement Date Range Selector
                </p>

                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={handlePreset1to15}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                  >
                    1st – 15th
                  </button>
                  <button
                    onClick={handlePreset16toEnd}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                  >
                    16th – End
                  </button>
                  <button
                    onClick={handlePresetThisMonth}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white"
                  >
                    This Month
                  </button>
                  {(startDate || endDate) && (
                    <button
                      onClick={handleClearDateRange}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-200 transition-colors flex items-center gap-1"
                    >
                      <FilterX className="w-3 h-3" /> All Time
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-300 mb-1">From Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleApplyDateRange(e.target.value, endDate)}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-white text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-gray-300 mb-1">To Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleApplyDateRange(startDate, e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg bg-white text-gray-900 font-semibold outline-none focus:ring-2 focus:ring-[#C9A84C]"
                  />
                </div>
              </div>
            </div>
```
**After:**
```tsx
            {/* Date Range Selector Toolbar */}
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" /> Statement Date Range Selector
                </p>

                {/* Preset Chips */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={handlePreset1to15}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors text-gray-700"
                  >
                    1st – 15th
                  </button>
                  <button
                    onClick={handlePreset16toEnd}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors text-gray-700"
                  >
                    16th – End
                  </button>
                  <button
                    onClick={handlePresetThisMonth}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:bg-gray-100 transition-colors text-gray-700"
                  >
                    This Month
                  </button>
                  {(startDate || endDate) && (
                    <button
                      onClick={handleClearDateRange}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors flex items-center gap-1"
                    >
                      <FilterX className="w-3 h-3" /> All Time
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <Input
                  label="From Date"
                  type="date"
                  value={startDate}
                  onChange={(e) => handleApplyDateRange(e.target.value, endDate)}
                />
                <Input
                  label="To Date"
                  type="date"
                  value={endDate}
                  onChange={(e) => handleApplyDateRange(startDate, e.target.value)}
                />
              </div>
            </div>
```
Add `import Input from "@/components/ui/Input";` to this file's imports if not already present.

**Step 2 — remaining `font-extrabold`/`#0F1E3D` in the summary metrics and filter badge (this file).**
- `<p className="text-lg font-extrabold text-[#0F1E3D] mt-0.5">{formatCurrency(detail.totalDebit)}</p>` → `<p className="text-lg font-bold text-gray-900 mt-0.5">{formatCurrency(detail.totalDebit)}</p>`
- The other two `font-extrabold` stat numbers in the same 3-column summary grid (`text-emerald-700`, and the conditional red/emerald balance figure) → change `font-extrabold` to `font-bold` on both, values unchanged.
- `<span className="text-xs text-[#0F1E3D] font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">Filtered by Date Range</span>` → `<span className="text-xs text-gray-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">Filtered by Date Range</span>`

### 7.8 Credit — `src/app/(admin)/credit/_PaymentModal.tsx`
Audited in full — already compliant with the shared component system (uses `Modal`, `Button`, `Input`, standard gray/orange/emerald palette throughout, no hex literals, no dead classes). **No changes required.**

### 7.9 Catalog — `src/app/(admin)/catalog/layout.tsx` + `_CatalogTabs.tsx`

**`layout.tsx` — Before:**
```tsx
import CatalogTabs from "./_CatalogTabs";

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900 leading-tight">Catalog</h2>
        <p className="text-sm text-gray-500 mt-0.5 font-medium">Manage products, thalis, and categories</p>
      </div>
      <CatalogTabs />
      <div className="mt-4">{children}</div>
    </div>
  );
}
```
**After:**
```tsx
import CatalogTabs from "./_CatalogTabs";

export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <CatalogTabs />
      <div>{children}</div>
    </div>
  );
}
```
The title block is deleted entirely — it was a byte-for-byte duplicate of Header.tsx's `/catalog` entry (§1.3).

**`_CatalogTabs.tsx` — replace the hand-rolled pill markup with the shared `Tabs` component (`variant="pill"`) so Catalog and any future pill-tab use share one implementation.**
Since this file currently derives active state from the route (`usePathname`) rather than local state, keep it as a thin wrapper around `Tabs` rather than fully collapsing it — routing-based tabs still benefit from one shared visual implementation:

**Before (full file body):**
```tsx
export default function CatalogTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
      {tabs.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
              isActive ? "bg-white text-gray-900 shadow-sm font-bold" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon size={15} />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
```
**After:**
```tsx
export default function CatalogTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const active = tabs.find((t) => t.href === pathname)?.href ?? tabs[0].href;

  return (
    <Tabs
      variant="pill"
      value={active}
      onChange={(href) => router.push(href)}
      items={tabs.map((t) => ({ value: t.href, label: t.label, icon: t.icon }))}
    />
  );
}
```
Add `import { useRouter } from "next/navigation";` (alongside the existing `usePathname` import) and `import Tabs from "@/components/ui/Tabs";`. The `Link`/`cn` imports can be removed if no longer used elsewhere in the file.

### 7.10 Daily Menu — `src/app/(admin)/daily-menu/page.tsx` + subcomponents

**Before:**
```tsx
    <div className="max-w-6xl mx-auto space-y-3">
```
**After:**
```tsx
    <div className="space-y-6">
```
This page has no duplicate title block (confirmed by audit — it relies on Header.tsx correctly already). No `PageToolbar` change needed here; the `WeekStrip` component already serves as this page's primary navigation control and should stay as-is structurally.

`font-black` was found via search in `_SabjiPickerModal.tsx`, `_DishCategoryCard.tsx`, and `_WeekStrip.tsx`. **Audit each occurrence individually before changing** — some may be intentional emphasis on a single large price/quantity figure inside a compact card (acceptable use per the rules table's "stat/metric numbers" row only allows `font-bold`, so any `font-black` on a genuine stat number should still be downgraded to `font-bold`), but do not blanket-replace without opening the file, since a couple of these may be styling a decorative badge rather than a heading/stat. Rule of thumb: if the text is a **page/section title or a stat number**, change `font-black`→`font-bold` per §4. If it's a single-character/short badge (e.g. a quantity chip), it's an acceptable exception and can stay — but should still not use `text-[#...]` hex colors; confirm colors are Tailwind classes only.

### 7.11 Settings / Meal Cutoff — `src/app/(admin)/settings/meal-cutoff/page.tsx` + `_OrderWindowTimeline.tsx`

**`page.tsx` — Before:**
```tsx
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 flex items-center gap-2 leading-tight">
```
**After:**
```tsx
    <div className="space-y-6">
      <div className="max-w-2xl">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 leading-tight">
```
This is the one page where the *inner form content* legitimately wants a narrower reading column even though the page-level container is now the standard full `max-w-[1440px]` — per §4's rule, wrap only the form content in `max-w-2xl`, not the page root. Also fix `font-extrabold` → `font-bold` on this heading — but note the title text itself may be worth keeping locally here (unlike Catalog/Users/etc., check whether this heading's copy differs meaningfully from Header.tsx's `/settings/meal-cutoff` entry ("Order Cutoff Times" / "Configure when ordering opens and closes"); if it's the same text, delete it per §1.3's rule instead of just re-styling it — re-open the file and compare before deciding).

**`_OrderWindowTimeline.tsx` — Before:**
```tsx
              : "bg-gray-150 text-gray-400 border border-gray-250"
```
**After:**
```tsx
              : "bg-gray-100 text-gray-400 border border-gray-200"
```
Also change any `font-black` found in this file to `font-bold` if it styles a title or stat number (per §7.10's rule of thumb).

---

## 8. QA / verification checklist

Run these from the repo root after implementing §6–§7. Every command should return **zero results** when the migration is complete (except where noted).

```bash
# 1. No hardcoded hex colors left in the admin surface (should be empty)
grep -rn "#[0-9A-Fa-f]\{3,6\}" src/app/\(admin\) src/components/admin src/components/ui \
  --include="*.tsx" | grep -v "node_modules"

# 2. No invalid Tailwind color steps anywhere in the app (should be empty)
grep -rnE "(gray|orange|yellow|red|blue|green|emerald|amber|indigo)-(150|250|350|450|550|650|750|850)" \
  src/app src/components --include="*.tsx"

# 3. No page-level max-w wrapper left outside the layout (should only match (admin)/layout.tsx)
grep -rln "max-w-[4-7]xl mx-auto" src/app/\(admin\) --include="*.tsx"

# 4. No raw <input type="date"> or unstyled <select> left in admin pages (should be empty)
grep -rn '<input$\|<input ' src/app/\(admin\) --include="*.tsx" | grep -i "type=\"date\""
grep -rn "<select" src/app/\(admin\) --include="*.tsx"

# 5. No font-black left in admin pages (should be empty after §7.10/7.11 review)
grep -rln "font-black" src/app/\(admin\) --include="*.tsx"

# 6. Confirm Header.tsx pageTitles map still has an entry for every admin route
grep -n "^\s*\"/" src/components/admin/Header.tsx

# 7. Visual pass: run the dev server and click through every sidebar link, confirming
#    the top bar title is the ONLY title shown, the content column has consistent
#    left/right margins on every page, and there is exactly one accent color (orange)
#    visible across Dashboard, Orders, Users, Staff, Companies, Credit, Catalog,
#    Daily Menu, and Settings.
npm run dev
```

---

## 9. Suggested execution order

1. §5 — create `PageToolbar.tsx` and `Tabs.tsx` first (nothing else compiles cleanly without them once pages start importing them).
2. §6 — global fixes: `(admin)/layout.tsx`, `Sidebar.tsx`, `Table.tsx`, `TimeField.tsx`, `SabjiPicker.tsx`.
3. §7.6–7.8 — Credit module (highest-impact, most off-brand, do it while the rules are freshest).
4. §7.2 — Orders (second most complex).
5. §7.3–7.5 — Users, Staff, Companies (same pattern, quick).
6. §7.9 — Catalog.
7. §7.1, §7.10, §7.11 — Dashboard, Daily Menu, Settings (lightest touch).
8. §8 — run every grep command, fix anything that still matches, then do the manual click-through pass.