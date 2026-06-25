# Implementation Plan — Public Homepage (VD's Hunger Hub)

**Goal:** Add a real public-facing homepage for end users (tiffin customers) at `/`. Move admin login into a navbar button instead of it being the default landing route. Static content only — no new API routes, no DB calls. Reuse existing UI primitives (`Button`) and theme tokens already in the codebase. Scoped for a single fast build session.

---

## 1. Current State (what exists today)

| File | Current behavior |
|---|---|
| `src/app/page.tsx` | `redirect("/login")` — `/` has no real content today |
| `src/app/layout.tsx` | Root layout. `metadata.title = "VD's Hunger Hub – Admin"`, loads Inter font + `react-hot-toast` |
| `src/proxy.ts` | `PUBLIC_PATHS = ["/login", "/api/auth/login"]`. Everything else under `PROTECTED_PAGE_PREFIXES` (`/dashboard`, `/companies`, `/users`, `/products`, `/thalis`, `/staff`, `/menu`) requires a valid `vd_admin_token` cookie. `/` is currently unmatched by either list — it falls through to `NextResponse.next()`, so it's already technically "open," it just has no content. |
| `src/app/(admin)/layout.tsx` | Sidebar + Header shell for all admin pages |
| `src/components/ui/Button.tsx` | Existing reusable button — variants `primary` (orange-500 fill), `secondary` (white/border), `danger`, `ghost`; sizes `sm`/`md`/`lg`; supports `leftIcon`/`rightIcon`/`isLoading` |
| `src/app/(auth)/login/page.tsx` | Existing admin login page/form — **not touched** by this plan |

**Theme tokens already established in the codebase (must reuse, not reinvent):**

| Token | Value |
|---|---|
| Font | Inter (`font-sans`, already global via `layout.tsx`) |
| Primary accent | `orange-500` / `orange-600`, gradient `from-orange-500 to-orange-600` |
| Page background | `bg-gray-100` (admin) / public page alternates `bg-white` and `bg-gray-50` per section |
| Body text | `text-gray-900` (headings), `text-gray-600` (body), `text-gray-400` (muted) |
| Borders | `border-gray-200` |
| Radius | `rounded-2xl` (cards/panels), `rounded-xl` (buttons, nav pills, icon tiles) |
| Shadow | `shadow-sm` |
| Brand mark | `UtensilsCrossed` (lucide-react) inside an orange tile, or 🍱 emoji (used in Sidebar) |
| Focus ring | `focus:ring-2 focus:ring-orange-500/40 focus:ring-offset-1` |

---

## 2. Scope

**In scope:**
- Static public homepage at `/` (replaces the redirect)
- `Navbar` component — sticky, brand mark, in-page anchor nav links, "Admin Login" button (routes to `/login`)
- `Footer` component — brand blurb, quick links, WhatsApp contact
- `proxy.ts` — explicitly add `/` to `PUBLIC_PATHS` (defensive, not a behavior change)
- `layout.tsx` — metadata title/description update so it no longer says "Admin" (since `/` is now the public entry point and `/login` is the admin entry point)

**Out of scope (explicitly, so nothing creeps in mid-build):**
- Any new API route (no `/api/public/menu`, no DB reads from the homepage)
- Live "today's menu" — replaced with static, on-brand "What We Offer" cards
- Self-serve ordering / cart / checkout
- Staff login or any login type other than Admin
- Editing `(auth)/login/page.tsx` or any `(admin)/*` page
- Editing any API route under `src/app/api/*`

---

## 3. File-by-File Plan

### 3.1 `src/proxy.ts` — edit

```diff
- const PUBLIC_PATHS = ["/login", "/api/auth/login"];
+ const PUBLIC_PATHS = ["/", "/login", "/api/auth/login"];
```

**Why:** `/` isn't in `PROTECTED_PAGE_PREFIXES` so it already renders without a token — this is a no-op for runtime behavior. It's added explicitly so the public root is self-documenting and can't be accidentally caught by a future broadened matcher.

**Acceptance check:** visiting `/` while logged out still works (it already did); visiting `/dashboard` while logged out still redirects to `/login` (unchanged).

---

### 3.2 `src/app/layout.tsx` — edit

```diff
export const metadata: Metadata = {
-  title: "VD's Hunger Hub – Admin",
-  description: "Admin panel for VD's Hunger Hub tiffin service",
+  title: "VD's Hunger Hub – Fresh Tiffin, Delivered Daily",
+  description: "Order fresh, home-style thalis for lunch and dinner. Message us on WhatsApp to get started.",
};
```

Nothing else in this file changes — font setup and `Toaster` config stay exactly as is, since admin pages still use the same root layout.

---

### 3.3 `src/components/public/Navbar.tsx` — new

**Type:** Client component (`"use client"`) — needs local state for the mobile menu toggle.

**Props:** none (self-contained).

**Structure:**
```tsx
<header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-200">
  <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
    {/* Brand */}
    <Link href="/" className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
        <UtensilsCrossed className="w-5 h-5 text-white" />
      </div>
      <span className="font-bold text-gray-900 text-sm md:text-base leading-tight">
        VD&apos;s Hunger Hub
      </span>
    </Link>

    {/* Desktop nav links — anchor scroll, not routes */}
    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
      <a href="#how-it-works" className="hover:text-orange-600 transition-colors">How It Works</a>
      <a href="#offerings" className="hover:text-orange-600 transition-colors">Our Thalis</a>
      <a href="#why-us" className="hover:text-orange-600 transition-colors">Why Us</a>
    </nav>

    {/* Right side */}
    <div className="flex items-center gap-2">
      <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="hidden sm:block">
        <Button variant="primary" size="md" leftIcon={<MessageCircle size={16} />}>
          Order on WhatsApp
        </Button>
      </a>
      <Link href="/login">
        <Button variant="secondary" size="md" leftIcon={<LogIn size={16} />}>
          Admin Login
        </Button>
      </Link>
      {/* mobile hamburger — toggles a simple dropdown panel with the 3 anchor links + both buttons stacked */}
      <button
        className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100"
        aria-label="Toggle menu"
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>
    </div>
  </div>

  {/* Mobile dropdown panel — conditionally rendered */}
  {mobileOpen && (
    <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3">
      <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700">How It Works</a>
      <a href="#offerings" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700">Our Thalis</a>
      <a href="#why-us" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700">Why Us</a>
      <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="block">
        <Button variant="primary" size="md" className="w-full" leftIcon={<MessageCircle size={16} />}>Order on WhatsApp</Button>
      </a>
      <Link href="/login" className="block">
        <Button variant="secondary" size="md" className="w-full" leftIcon={<LogIn size={16} />}>Admin Login</Button>
      </Link>
    </div>
  )}
</header>
```

**Icons needed (lucide-react):** `UtensilsCrossed`, `MessageCircle`, `LogIn`, `Menu`, `X`.

**Constant import:** `WHATSAPP_LINK` from `@/lib/constants` (see Section 4).

**Acceptance check:** "Admin Login" is a real `<Link href="/login">` wrapping the `Button`, not a styled element with no destination. Anchor links scroll to matching section `id`s (requires `id="how-it-works"`, `id="offerings"`, `id="why-us"` to exist exactly on `page.tsx`, plus `scroll-smooth` on `<html>` for a smooth scroll instead of a jump — add this utility class to the `<html>` tag in `layout.tsx` if not already present, or accept the default jump behavior to save time).

---

### 3.4 `src/components/public/Footer.tsx` — new

**Type:** Server component (no interactivity needed — no `"use client"`).

**Structure:**
```tsx
<footer className="bg-gray-900 text-gray-400">
  <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
    {/* Brand column */}
    <div>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center">
          <UtensilsCrossed className="w-4 h-4 text-white" />
        </div>
        <span className="font-bold text-white text-sm">VD&apos;s Hunger Hub</span>
      </div>
      <p className="text-sm leading-relaxed">
        Fresh, home-style thalis delivered to your doorstep or office — every lunch, every dinner.
      </p>
    </div>

    {/* Quick links */}
    <div>
      <p className="text-white font-semibold text-sm mb-3">Quick Links</p>
      <ul className="space-y-2 text-sm">
        <li><a href="#how-it-works" className="hover:text-orange-400 transition-colors">How It Works</a></li>
        <li><a href="#offerings" className="hover:text-orange-400 transition-colors">Our Thalis</a></li>
        <li><a href="#why-us" className="hover:text-orange-400 transition-colors">Why Us</a></li>
        <li><Link href="/login" className="hover:text-orange-400 transition-colors">Admin Login</Link></li>
      </ul>
    </div>

    {/* Contact */}
    <div>
      <p className="text-white font-semibold text-sm mb-3">Get In Touch</p>
      <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm hover:text-orange-400 transition-colors mb-2">
        <MessageCircle size={16} /> Chat on WhatsApp
      </a>
      <p className="text-sm">+91 63563 50086</p>
    </div>
  </div>

  <div className="border-t border-gray-800 py-4 text-center text-xs">
    © {new Date().getFullYear()} VD&apos;s Hunger Hub. All rights reserved.
  </div>
</footer>
```

**Icons needed:** `UtensilsCrossed`, `MessageCircle`.
**Imports:** `Link` from `next/link`, `WHATSAPP_LINK` from `@/lib/constants`.

---

### 3.5 `src/app/page.tsx` — full replace

**Type:** Server component (static content — no client state at the page level; only `Navbar`'s internal mobile-menu toggle is client-side, isolated inside that component).

**Composition:** `<Navbar /> + <main>{6 sections}</main> + <Footer />`

#### Section A — Hero (no `id`; first viewport)

```tsx
<section className="bg-gradient-to-b from-orange-50 to-white py-16 md:py-24 px-4">
  <div className="max-w-3xl mx-auto text-center">
    <span className="inline-block bg-orange-100 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
      🍱 Fresh Tiffin Service
    </span>
    <h1 className="text-3xl md:text-5xl font-bold text-gray-900 leading-tight mb-4">
      Home-Style Thalis,<br />Delivered On Time.
    </h1>
    <p className="text-gray-600 text-base md:text-lg mb-8 max-w-xl mx-auto">
      Lunch and dinner thalis made fresh daily — for individuals, companies, and teams. Order in seconds, right from WhatsApp.
    </p>
    <div className="flex flex-col sm:flex-row gap-3 justify-center">
      <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
        <Button variant="primary" size="lg" leftIcon={<MessageCircle size={18} />}>
          Order on WhatsApp
        </Button>
      </a>
      <a href="#how-it-works">
        <Button variant="secondary" size="lg">
          See How It Works
        </Button>
      </a>
    </div>
  </div>
</section>
```

#### Section B — How It Works (`id="how-it-works"`, `bg-white py-16 px-4`)

Heading block:
```tsx
<h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-2">How It Works</h2>
<p className="text-center text-gray-600 mb-10">Three simple steps to your next meal.</p>
```

Grid: `<div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">`, each card:
```tsx
<div className="bg-white border border-gray-200 rounded-2xl p-6 text-center shadow-sm">
  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4">
    <Icon className="text-orange-600" size={22} />
  </div>
  <p className="text-xs font-semibold text-orange-600 mb-1">STEP {n}</p>
  <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
  <p className="text-sm text-gray-600">{description}</p>
</div>
```

| Step | Icon | Title | Description |
|---|---|---|---|
| 1 | `MessageCircle` | Message Us | Send us a WhatsApp message to say hello and get started. |
| 2 | `UtensilsCrossed` | Pick Your Thali | Tell us your meal preference — we'll guide you through today's options. |
| 3 | `Truck` | Get Delivered | Your fresh thali arrives hot and on time, every single day. |

#### Section C — What We Offer (`id="offerings"`, `bg-gray-50 py-16 px-4`)

Heading: `What We Offer` / subtext: `A few of our regular thali styles.`

Grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6` inside `max-w-5xl mx-auto`. Card:
```tsx
<div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
  <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-600" />
  <div className="p-6">
    <h3 className="font-semibold text-gray-900 mb-1">{name}</h3>
    <p className="text-sm text-gray-600 mb-3">{description}</p>
    <ul className="text-xs text-gray-500 space-y-1">
      {items.map((i) => <li key={i}>• {i}</li>)}
    </ul>
  </div>
</div>
```

| Name | Description | Items |
|---|---|---|
| Standard Thali | Our everyday favorite, balanced and filling. | Roti, Dal, Rice, Sabji, Salad |
| Deluxe Thali | Extra portions with a choice of sabji. | Roti, Dal, Rice, 2 Sabji, Sweet, Salad |
| Light Thali | A lighter option for a simpler meal. | Roti, Dal, Rice, Sabji |

> These 3 cards are **static, hardcoded data** — explicitly not pulled from the `Thali` table (out of scope per Section 2). They exist purely to give the visitor a sense of what's offered.

Below the grid:
```tsx
<p className="text-center text-sm text-gray-500 mt-8">
  Menus rotate daily — message us on WhatsApp to see what&apos;s on today&apos;s menu.
</p>
```

#### Section D — Why Choose Us (`id="why-us"`, `bg-white py-16 px-4`)

Heading: `Why Choose Us`. Grid: `grid-cols-2 md:grid-cols-4 gap-6` inside `max-w-4xl mx-auto`. Card (lighter than Section B — icon + label only):
```tsx
<div className="text-center">
  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto mb-3">
    <Icon className="text-orange-600" size={20} />
  </div>
  <p className="text-sm font-semibold text-gray-900">{label}</p>
</div>
```

| Icon | Label |
|---|---|
| `ShieldCheck` | Hygienic & Fresh |
| `Clock` | Always On Time |
| `Building2` | Company Billing Available |
| `Smile` | Trusted by Regulars |

#### Section E — Final CTA banner

```tsx
<section className="bg-gradient-to-br from-orange-500 to-orange-600 py-14 px-4 text-center">
  <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Hungry? Let&apos;s Fix That.</h2>
  <p className="text-orange-100 mb-6 max-w-md mx-auto">Message us now and get your first thali on the way.</p>
  <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
    <Button variant="secondary" size="lg" leftIcon={<MessageCircle size={18} />}>
      Order on WhatsApp
    </Button>
  </a>
</section>
```

#### Section F — Footer

`<Footer />` from 3.4.

**Full import list for `page.tsx`:**
```ts
import { MessageCircle, UtensilsCrossed, Truck, ShieldCheck, Clock, Building2, Smile } from "lucide-react";
import Button from "@/components/ui/Button";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { WHATSAPP_LINK } from "@/lib/constants";
```

---

## 4. Shared Constant — WhatsApp link

To avoid drift between `Navbar`, `Footer`, and `page.tsx`, define once and import everywhere.

**New file:** `src/lib/constants.ts`
```ts
export const WHATSAPP_NUMBER = "916356350086"; // TODO: replace with real business WhatsApp number
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hi! I'd like to order a tiffin."
)}`;
```

---

## 5. Build Order

1. `src/lib/constants.ts` — new
2. `src/proxy.ts` — one-line edit
3. `src/app/layout.tsx` — metadata edit
4. `src/components/public/Navbar.tsx` — new
5. `src/components/public/Footer.tsx` — new
6. `src/app/page.tsx` — full replace, assembles everything
7. `npm run dev` and manually verify against Section 7 below

## 6. Why no `(public)` route group

`src/app/page.tsx` must live directly at `src/app/page.tsx` to serve `/` — Next.js route groups (`(public)`) don't change URL structure, they only let you scope a shared `layout.tsx` to a folder of *nested* routes. Since there's only one public route today, wrapping it in a route group adds a layer of indirection with zero present benefit. `Navbar`/`Footer` are rendered directly in `page.tsx` instead. If `/menu`, `/about`, etc. get added later, *that's* the right time to introduce `src/app/(public)/layout.tsx` and move shared routes under it.

## 7. Acceptance Criteria

- [ ] Visiting `/` (logged out) renders the homepage — no redirect to `/login`
- [ ] Visiting `/dashboard` (logged out) still redirects to `/login` — proxy guard unaffected
- [ ] "Admin Login" in the navbar routes to `/login` and the existing login page/flow is untouched
- [ ] "Order on WhatsApp" buttons (navbar, hero, final CTA, footer) all open `wa.me` in a new tab with a pre-filled message
- [ ] Anchor nav links (`How It Works`, `Our Thalis`, `Why Us`) scroll to the matching section
- [ ] Page is responsive: navbar collapses to hamburger below `md`, grids collapse to 1–2 columns on mobile
- [ ] No new API calls fired from `/` (check Network tab — only static assets)
- [ ] No changes to any file under `src/app/(admin)/*`, `src/app/(auth)/*`, or `src/app/api/*`
- [ ] `npm run lint` passes with no new errors

## 8. Explicitly Deferred (next iteration, not this build)

- Public-safe `/api/public/menu` endpoint + wiring "What We Offer" to real `Thali`/`DailyMenu` data
- Dedicated `/menu`, `/about`, `/contact` routes under a `(public)` group
- Replacing the placeholder WhatsApp number with the real one
- Testimonials / social proof section
- SEO metadata beyond the basic title/description (OG tags, JSON-LD) — flagged for later, similar to the SEO work already done on IceSaathi