# VD's Hunger Hub — Customer Registration, OTP/PIN Auth, Device Anti-Abuse & Multi-Thali Ordering
## Complete Implementation Plan

---

### How to use this document
This plan is written to be handed to any developer (or AI coding tool) and implemented section by section. Model names, field names, and file paths follow your existing conventions (`AppUser` for admin/staff, Next.js App Router, Prisma/PostgreSQL, JWT-based sessions, UTC storage + IST display utility). Your live schema/route files weren't attached to this conversation, so I've introduced a distinct `Customer` model to avoid clashing with your admin/staff `AppUser` table — **rename to match whatever your existing customer-facing user model is actually called** (you referenced it as `User` in your OTP research). If you paste or upload `schema.prisma` and your current `src/app/api/auth/` routes in a follow-up, I can convert this into an exact diff against your real files.

**Requirement → Section map** (so you can verify all 13 points are covered):

| # | Requirement | Covered in |
|---|---|---|
| 1 | Mandatory registration before ordering; added to admin Customer List | §4, §5.1, §13 |
| 2 | Cost/abuse control on OTP (IT-crowd prank risk), long-lived JWT | §7, §9, §10 |
| 3 | Registration form: name, work/home address, company dropdown + add-new | §5.1, §11 |
| 4 | Mobile + OTP verification gate before company shows in dashboard | §5.2, §11 |
| 5 | 6-digit PIN creation after verification | §5.3, §9 |
| 6 | Device fingerprint storage + strict abuse prevention everywhere | §6, §7 |
| 7 | 3 dashboard states: Login / Register / Verify, all strictly rate-limited | §4, §13 |
| 8 | Only verified users can order / enter site | §4, §5.4 |
| 9 | Single `/menu` URL replacing scattered menu pages | §13 |
| 10 | Multi-thali ordering, per-thali sabji choice, max 10 per mobile | §12 |
| 11 | Add-ons max 30, both limits configurable | §12 |
| 12 | New-device flow: PIN or OTP login + Forgot PIN | §5.5, §9, §10 |
| 13 | Hidden lat/long fields, admin-only, for staff navigation | §2, §14 |

---

## 1. High-Level Architecture Change Summary

**Before:** Firebase OTP for customers → ad-hoc check-then-send → single thali per order → menu spread across multiple pages → no PIN, no device tracking, no company directory.

**After:**
- Message Central VerifyNow replaces Firebase for customer OTP (per your existing research — kept as-is here, see reference notes for provider setup).
- Registration is mandatory and gated: **Details → Mobile+OTP → PIN** is a strict linear funnel; nothing after step 1 is optional.
- A `Customer` record is created (unverified) the moment step 1 is submitted, so it appears in the admin Customer List immediately (satisfies #1) — but the associated `Company` stays `PENDING` and invisible in the dashboard/dropdown until OTP verification succeeds (satisfies #4). This reconciliation is intentional: it lets admins see registration attempts while still preventing prank/garbage company names from cluttering the dashboard.
- Every customer-facing auth action is rate-limited on three independent axes: mobile number, IP address, and device fingerprint.
- Sessions use short-lived access JWTs + long-lived, rotating, device-bound refresh tokens (mirrors the 100-day persistence pattern you already use for Admin/Staff).
- One canonical `/menu` route renders the full experience; auth state (anonymous / draft-pending-verification / verified) is resolved server-side on that same route and swaps in the right UI slice.

---

## 2. Database Schema Changes (Prisma)

Add the following to `schema.prisma`. Field/model names are illustrative — align to your actual naming.

```prisma
// ---------- Customer-facing identity ----------

model Customer {
  id                 String    @id @default(cuid())
  fullName           String
  mobile             String    @unique          // stored as 10-digit, no country code
  workAddress        String                       // required
  homeAddress        String?                      // optional
  companyId          String
  company            Company   @relation(fields: [companyId], references: [id])

  pinHash            String?                      // null until step 3 completed
  pinFailedAttempts  Int       @default(0)
  pinLockedUntil     DateTime?

  isVerified         Boolean   @default(false)
  verifiedAt         DateTime?

  // Hidden from customer UI entirely — admin-editable only (Req #13)
  latitude           Float?
  longitude          Float?

  createdAtUtc       DateTime  @default(now())
  updatedAtUtc       DateTime  @updatedAt

  deviceFingerprints DeviceFingerprint[]
  sessions           CustomerSession[]
  orders             Order[]

  @@index([isVerified])
}

model Company {
  id                String        @id @default(cuid())
  name              String        @unique
  status            CompanyStatus @default(PENDING)
  addedByCustomerId String?
  createdAtUtc      DateTime      @default(now())
  confirmedAtUtc    DateTime?
  customers         Customer[]
}

enum CompanyStatus {
  PENDING    // not yet shown in dropdown or admin dashboard
  CONFIRMED  // visible everywhere, once the adding customer verifies OTP
}

// ---------- Device fingerprinting ----------

model DeviceFingerprint {
  id              String   @id @default(cuid())
  customerId      String
  customer        Customer @relation(fields: [customerId], references: [id])
  fingerprintHash String              // sha256(clientVisitorId + serverSalt)
  userAgent       String
  ipAtFirstSeen   String
  firstSeenAtUtc  DateTime @default(now())
  lastSeenAtUtc   DateTime @updatedAt
  isTrusted       Boolean  @default(false)  // becomes true after first successful full login

  @@unique([customerId, fingerprintHash])
  @@index([fingerprintHash])
}

// ---------- OTP bridge table (works with any provider incl. Message Central) ----------

model OtpVerification {
  id             String    @id @default(cuid())
  mobile         String
  purpose        OtpPurpose
  verificationId String              // returned by the OTP provider's "send" call
  customerId     String?             // linked once a Customer draft exists
  attempts       Int       @default(0)
  expiresAtUtc   DateTime
  consumedAtUtc  DateTime?
  createdAtUtc   DateTime  @default(now())

  @@index([mobile, purpose])
}

enum OtpPurpose {
  REGISTER
  LOGIN
  FORGOT_PIN
}

// ---------- Sessions (customer JWT refresh tokens) ----------

model CustomerSession {
  id                    String    @id @default(cuid())
  customerId            String
  customer              Customer  @relation(fields: [customerId], references: [id])
  refreshTokenHash      String    @unique   // never store the raw token
  deviceFingerprintHash String
  createdAtUtc          DateTime  @default(now())
  expiresAtUtc          DateTime            // now + 100 days, matches Admin/Staff pattern
  revokedAtUtc          DateTime?
  replacedBySessionId   String?             // set on rotation, enables reuse detection

  @@index([customerId])
}

// ---------- Rate limiting ledger ----------

model RateLimitEvent {
  id         String   @id @default(cuid())
  scopeType  RateLimitScope
  scopeKey   String              // the mobile / ip / fingerprintHash value
  action     RateLimitAction
  createdAtUtc DateTime @default(now())

  @@index([scopeType, scopeKey, action, createdAtUtc])
}

enum RateLimitScope {
  MOBILE
  IP
  DEVICE
}

enum RateLimitAction {
  SEND_OTP_REGISTER
  SEND_OTP_LOGIN
  SEND_OTP_FORGOT_PIN
  VERIFY_OTP
  LOGIN_PIN_ATTEMPT
  ADD_COMPANY
}

// ---------- Configurable order limits ----------

model SystemSetting {
  id           String   @id @default(cuid())
  key          String   @unique     // e.g. "MAX_THALI_PER_ORDER"
  value        String               // stored as string, parsed by consumer
  updatedAtUtc DateTime @updatedAt
}

// ---------- Order structure (multi-thali + add-ons) ----------
// Merge these fields into your existing Order model rather than
// duplicating it if an Order model already exists.

model Order {
  id           String   @id @default(cuid())
  customerId   String
  customer     Customer @relation(fields: [customerId], references: [id])
  thaliItems   OrderThaliItem[]
  addonItems   OrderAddonItem[]
  createdAtUtc DateTime @default(now())
  // ...existing order fields (status, delivery slot, payment, etc.)
}

model OrderThaliItem {
  id               String @id @default(cuid())
  orderId          String
  order            Order  @relation(fields: [orderId], references: [id])
  dailyMenuSabjiId String            // FK into that day's sabji options
  quantity         Int    @default(1)
}

model OrderAddonItem {
  id             String @id @default(cuid())
  orderId        String
  order          Order  @relation(fields: [orderId], references: [id])
  addonProductId String
  quantity       Int
}
```

Run:
```bash
npx prisma migrate dev --name customer_auth_ordering_overhaul
```

---

## 3. Environment Variables

```env
# Message Central (customer OTP provider)
MESSAGECENTRAL_CUSTOMER_ID=
MESSAGECENTRAL_AUTH_TOKEN=
MESSAGECENTRAL_BASE_URL=https://cpaas.messagecentral.com

# Customer JWT
CUSTOMER_JWT_ACCESS_SECRET=
CUSTOMER_JWT_REFRESH_SECRET=
CUSTOMER_ACCESS_TOKEN_TTL_MIN=15
CUSTOMER_REFRESH_TOKEN_TTL_DAYS=100

# Fingerprint hashing salt (server-side pepper, never sent to client)
DEVICE_FINGERPRINT_SERVER_SALT=

# PIN hashing
PIN_HASH_ROUNDS=12
```

Never expose `MESSAGECENTRAL_AUTH_TOKEN`, `CUSTOMER_JWT_*`, or `DEVICE_FINGERPRINT_SERVER_SALT` to the client — they must only ever be read inside `src/app/api/**/route.ts` files (server-side).

---

## 4. Core Auth State Machine

Every request to `/menu` resolves to exactly one of these states server-side before rendering:

```
                        ┌─────────────────────┐
                        │   ANONYMOUS          │  no session cookie, no draft cookie
                        └──────────┬───────────┘
                                   │
              ┌────────────────────┼─────────────────────┐
              ▼                    ▼                     ▼
        [Register tab]       [Login tab]           [Verify tab]
        (Req #7, #3)      (Req #12)              (Req #7 — resume
                                                    a pending registration)
              │                    │                     │
              ▼                    ▼                     ▼
     ┌─────────────────┐   ┌───────────────┐     ┌────────────────────┐
     │ DRAFT_PENDING_   │   │ Mobile+PIN or │     │ enter mobile →      │
     │ VERIFICATION     │   │ Mobile+OTP    │     │ if a pending draft  │
     │ (Customer row    │   └───────┬───────┘     │ exists, resend/     │
     │ exists,          │           │             │ verify OTP for it   │
     │ isVerified=false)│           ▼             └──────────┬─────────┘
     └────────┬─────────┘   VERIFIED_SESSION                 │
              │              (full JWT issued)                ▼
              ▼                                        DRAFT_PENDING_
        OTP verify                                      VERIFICATION
              │
              ▼
     PIN_SETUP_REQUIRED
              │
              ▼
     VERIFIED_SESSION ──── only this state may reach the ordering UI (Req #8)
```

Server-side resolution logic (pseudocode, e.g. in a shared `resolveCustomerAuthState()` used by `/menu`'s server component and by an auth middleware):

```typescript
async function resolveCustomerAuthState(req: NextRequest) {
  const accessToken = req.cookies.get("customer_access")?.value;
  if (accessToken) {
    const claims = verifyAccessJwt(accessToken); // throws on invalid/expired
    if (claims) return { state: "VERIFIED_SESSION", customerId: claims.sub };
  }

  // access token missing/expired — try silent refresh
  const refreshToken = req.cookies.get("customer_refresh")?.value;
  if (refreshToken) {
    const rotated = await tryRotateRefreshToken(refreshToken, req);
    if (rotated) return { state: "VERIFIED_SESSION", customerId: rotated.customerId };
  }

  const draftId = req.cookies.get("reg_draft")?.value;
  if (draftId) {
    const draft = await getPendingDraft(draftId);
    if (draft && !draft.isVerified) return { state: "DRAFT_PENDING_VERIFICATION", draftId };
  }

  return { state: "ANONYMOUS" };
}
```

Only `VERIFIED_SESSION` is allowed to call the order-creation endpoint — enforce this **server-side on every write route**, not just in the UI (Req #8).

---

## 5. API Route Specifications

All routes below live under `src/app/api/customer/` unless noted. Every route validates Indian mobile format first (§8) and checks rate limits (§7) before doing anything else — reject fast, cheaply, before touching the OTP provider.

### 5.1 `POST /api/customer/register` (Req #1, #3)
**Request:**
```json
{
  "fullName": "string, 2-80 chars",
  "workAddress": "string, required, 10-300 chars",
  "homeAddress": "string, optional, 10-300 chars",
  "companyId": "string | null",
  "newCompanyName": "string | null",
  "deviceFingerprint": "string, from client-side fingerprint SDK"
}
```
Exactly one of `companyId` / `newCompanyName` must be present.

**Server logic:**
1. Validate all fields; reject on any missing required field (no partial drafts).
2. Rate-limit check: `DEVICE` scope, `ADD_COMPANY` action if `newCompanyName` present (max 2/device/day — prevents junk-company spam even before OTP is involved).
3. If `newCompanyName`: create `Company` with `status = PENDING`, `addedByCustomerId` filled in after the Customer row exists (two-step insert or a transaction).
4. Create `Customer` row: `isVerified = false`, `pinHash = null`.
5. Create/refresh a `DeviceFingerprint` row (not yet trusted) for this customer.
6. Set an httpOnly, signed `reg_draft` cookie (customerId, 30-min TTL) so the user can resume at the Verify tab if they abandon the flow.
7. Response: `{ "draftId": "...", "nextStep": "MOBILE_OTP" }`

**Why the Customer row is created immediately, not the Company:** admins want visibility into registration attempts (Req #1), but a prank/duplicate company name shouldn't pollute the dropdown until a real verified human stands behind it (Req #4).

### 5.2 `POST /api/customer/send-otp` (Req #2, #4, #6)
**Request:** `{ "draftId": "string", "mobile": "10-digit string" }`

**Server logic:**
1. Validate mobile against the strict Indian-number regex (§8). Reject immediately on failure — never call the OTP provider with an invalid number.
2. Rate limits (§7): `MOBILE` scope max 3/hour, `IP` scope max 5/hour, `DEVICE` scope max 10/day, plus a 60-second resend cooldown per mobile.
3. Reject if `mobile` is already `isVerified = true` on a **different** Customer row → respond `{"error": "MOBILE_ALREADY_REGISTERED"}` and point the client to the Login tab instead.
4. Call Message Central "Send OTP" → get `verificationId`.
5. Insert `OtpVerification` row: `purpose = REGISTER`, `expiresAtUtc = now + 5 min`, linked to the draft's `customerId`.
6. Update `Customer.mobile` on the draft row (was empty/placeholder until now).
7. Response: `{ "otpSent": true, "expiresInSeconds": 300 }`

### 5.3 `POST /api/customer/verify-otp` (Req #4, #5)
**Request:** `{ "draftId": "string", "otp": "6-digit string" }`

**Server logic:**
1. Rate limit: `VERIFY_OTP` max 5 attempts per `OtpVerification` row; on the 5th failed attempt, invalidate the row entirely and require a fresh `send-otp` call (forces a new cooldown window — stops brute-forcing a single OTP).
2. Call Message Central "Verify OTP" with `verificationId` + submitted code.
3. On success (within transaction):
   - `Customer.isVerified = true`, `verifiedAt = now()`
   - If the linked `Company.status === PENDING`, flip to `CONFIRMED`, set `confirmedAtUtc = now()` → **this is the moment the company becomes visible in the admin dashboard and future dropdowns** (Req #4).
   - Mark `OtpVerification.consumedAtUtc = now()`.
4. Issue a short-lived **pre-auth token** (not a full session JWT yet — PIN isn't set) redirecting to PIN setup.
5. Response: `{ "verified": true, "nextStep": "SET_PIN" }`

### 5.4 `POST /api/customer/set-pin` (Req #5, #8)
**Request:** `{ "preAuthToken": "string", "pin": "6-digit string", "confirmPin": "6-digit string" }`

**Server logic:**
1. Validate `pin === confirmPin`, exactly 6 digits, reject trivial PINs (`000000`, `123456`, `111111`, etc. — small denylist).
2. Hash with bcrypt (`PIN_HASH_ROUNDS`), store on `Customer.pinHash`.
3. Mark the `DeviceFingerprint` used for this flow as `isTrusted = true`.
4. Issue full session: access JWT (15 min) + refresh token (100 days), create `CustomerSession` row bound to `deviceFingerprintHash`.
5. Clear the `reg_draft` cookie; set `customer_access` + `customer_refresh` cookies.
6. Response: `{ "loggedIn": true }` → client redirects into `/menu` fully authenticated (Req #8 — this is the only path that unlocks ordering).

### 5.5 Login variants (Req #12)

**`POST /api/customer/login-pin`**
`{ "mobile": "string", "pin": "string", "deviceFingerprint": "string" }`
- Rate limit: 5 failed attempts → set `Customer.pinLockedUntil = now + 15 min`. Three lockouts within 24h → force OTP-only login for that mobile for the next 24h (defeats sustained brute force even across many short lockouts).
- On success: issue new session bound to this device's fingerprint; if this fingerprint isn't already trusted for this customer, create it as untrusted-but-valid (a PIN alone is sufficient proof of identity — don't force OTP on top of a correct PIN, that would contradict Req #12's "two options").

**`POST /api/customer/login-otp/send` and `/verify`**
Same shape as §5.2/§5.3 but `purpose = LOGIN`, requires `Customer.isVerified = true` already, and does not touch the Company or PIN.

**`POST /api/customer/forgot-pin/send-otp` and `/reset`**
`purpose = FORGOT_PIN`. On successful OTP verify, allow one `set-pin`-equivalent call to overwrite `pinHash`. Cap at 3 resets/day/mobile (§7) — this is a sensitive action even though it's OTP-gated.

### 5.6 `GET /api/customer/companies` (Req #3)
Returns only `status = CONFIRMED` companies, alphabetical, for the dropdown. Never leak `PENDING` companies to any customer-facing endpoint — they don't exist publicly until confirmed.

### 5.7 `GET /menu` — single canonical route (Req #9)
Server component calls `resolveCustomerAuthState()` (§4) and renders:
- `ANONYMOUS` → `<AuthTabs default="register" />` (Login / Register / Verify tabs) overlaying/above the read-only menu preview.
- `DRAFT_PENDING_VERIFICATION` → `<AuthTabs default="verify" draftId={draftId} />`
- `VERIFIED_SESSION` → full ordering UI (§12).

No other route should render menu/ordering content — redirect any legacy menu URLs (`/order`, `/thali`, etc.) to `/menu` with a 308 permanent redirect.

### 5.8 `POST /api/orders` (Req #10, #11)
Requires `VERIFIED_SESSION`. See §12 for validation details.

---

## 6. Device Fingerprinting Strategy (Req #6)

**Client side:** use the open-source FingerprintJS (`@fingerprintjs/fingerprintjs`, not the paid Pro tier) to generate a `visitorId` from canvas hash, WebGL renderer string, timezone, screen metrics, font subset, and hardware concurrency. Send this `visitorId` with every auth-flow request (registration, send-otp, verify-otp, login).

**Server side:** never trust the client's raw `visitorId` alone as the stored value.
```typescript
function computeFingerprintHash(visitorId: string, userAgent: string, salt: string) {
  return sha256(`${visitorId}|${userAgent}|${salt}`);
}
```
Store only the hash (`DeviceFingerprint.fingerprintHash`), never the raw client identifier, using `DEVICE_FINGERPRINT_SERVER_SALT` as a server-side pepper so the hash can't be reconstructed from leaked client data alone.

**Abuse rules built on top of the fingerprint:**
- Same fingerprint attempting `register` for **more than 1 distinct mobile number** within 24h → flag the fingerprint (`isTrusted` stays false permanently, log to an `abuse_flags` audit trail) and require staff review before further OTPs from it are sent.
- Same fingerprint tied to more than, say, 3 verified customers total (rare, e.g. shared office kiosk) → allow but flag for review rather than hard-block, since false positives are real (see honesty note below).
- A refresh token replay from a fingerprint that doesn't match the one it was issued to → treat as compromised, revoke the entire session family (§10).

**Important honesty note to keep this practical:** No fingerprinting technique is 100% stable or unique — private browsing modes, browser updates, and privacy-focused browsers (Brave, Firefox strict mode) will legitimately rotate a user's fingerprint. Treat fingerprint mismatches as **one signal that raises scrutiny (e.g., require OTP step-up)**, not as an automatic hard block that could lock out a real paying customer. "Most strict" should mean *layered* (mobile + IP + fingerprint + PIN lockouts together), not a single brittle check that produces false positives.

---

## 7. Rate Limiting & Abuse Prevention (Req #2, #6, #7)

Every limited action writes a `RateLimitEvent` row; checks count rows in a sliding window before allowing the action. This is a plain-Postgres approach (no Redis dependency required) — swap to Redis `INCR`+`EXPIRE` later purely as a performance optimization if traffic grows, the logic doesn't change.

```typescript
async function checkRateLimit(
  scopeType: "MOBILE" | "IP" | "DEVICE",
  scopeKey: string,
  action: RateLimitAction,
  windowMs: number,
  maxEvents: number
) {
  const since = new Date(Date.now() - windowMs);
  const count = await prisma.rateLimitEvent.count({
    where: { scopeType, scopeKey, action, createdAtUtc: { gte: since } },
  });
  if (count >= maxEvents) throw new RateLimitExceededError(action);
  await prisma.rateLimitEvent.create({ data: { scopeType, scopeKey, action } });
}
```

| Action | Mobile limit | IP limit | Device limit | Extra rule |
|---|---|---|---|---|
| Send OTP (register) | 3 / hour | 5 / hour | 10 / day | 60s resend cooldown |
| Verify OTP | 5 attempts / OTP row | — | — | row invalidated after 5th fail |
| Send OTP (login) | 5 / hour | 10 / hour | 15 / day | 60s resend cooldown |
| Send OTP (forgot PIN) | 3 / day | 5 / hour | 5 / day | — |
| Login via PIN | 5 fails → 15-min lock | 20 / hour | — | 3 lockouts/24h → OTP-only for 24h |
| Add new company | 2 / device / day | 5 / IP / day | — | company stays PENDING regardless |

Apply all limits **before** calling Message Central — every blocked request should cost you ₹0, not just be rate-limited after the SMS already went out. This directly protects the cost-optimization concern in Req #2 (IT-crowd prank risk).

---

## 8. Indian Mobile Number Validation (Req #6)

```typescript
const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

function normalizeAndValidateMobile(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, "");
  const stripped = digitsOnly.startsWith("91") && digitsOnly.length === 12
    ? digitsOnly.slice(2)
    : digitsOnly;

  if (!INDIAN_MOBILE_REGEX.test(stripped)) {
    throw new InvalidMobileNumberError();
  }
  return stripped; // always store/compare as bare 10-digit
}
```
Run this validator as the **very first line** of `send-otp`, `login-otp/send`, and `forgot-pin/send-otp` — reject before any DB write or provider call. Store `mobile` consistently as the bare 10-digit form everywhere (no `+91` prefix inconsistencies that would create duplicate-looking rows).

---

## 9. PIN System Design (Req #5, #12)

- 6 digits, numeric only, confirmed twice on entry.
- Denylist trivial PINs: `000000`, `111111`...`999999`, `123456`, `654321`.
- Hash with bcrypt at `PIN_HASH_ROUNDS = 12` (bcryptjs — pure JS, avoids native-module build issues on serverless deploys; switch to `argon2` only if you're on a persistent Node server, not edge/serverless functions).
- Lockout: 5 failed attempts → 15-minute lock (`Customer.pinLockedUntil`); reset `pinFailedAttempts` to 0 on any successful login.
- Escalation: 3 lockouts within a rolling 24h window → force that mobile into OTP-only login for the next 24h, regardless of PIN correctness, to shut down sustained brute-force attempts that pace themselves around the 15-minute lock.
- Forgot PIN (§5.5) always requires a fresh OTP — a PIN can never be reset by knowing the old PIN alone.

---

## 10. JWT / Session Design for Customers (Req #2, #12)

- **Access token:** JWT, 15-minute TTL, claims `{ sub: customerId, role: "CUSTOMER", fph: deviceFingerprintHash }`, signed with `CUSTOMER_JWT_ACCESS_SECRET`.
- **Refresh token:** opaque random 256-bit value; only its SHA-256 hash is stored (`CustomerSession.refreshTokenHash`), never the raw value server-side after issuance. TTL = 100 days (matches your existing Admin/Staff persistence choice, so the whole app behaves consistently).
- **Device binding:** refresh token is only honored if the request's current computed fingerprint hash matches `CustomerSession.deviceFingerprintHash`. Mismatch → do **not** silently issue a new access token; force a step-up challenge (PIN or OTP) before renewing.
- **Rotation + reuse detection:** every refresh call issues a brand-new refresh token and immediately revokes the old one (`revokedAtUtc`, `replacedBySessionId`). If a *revoked* refresh token is ever presented again, treat it as a stolen/replayed token: revoke the entire session chain for that customer and require full re-login. This is the same pattern used by Auth0/Supabase and is the single biggest defense against a leaked cookie being reused indefinitely.
- Cookies: `httpOnly`, `secure`, `sameSite=lax`, scoped to your domain — never accessible to client JS, which also means the fingerprint SDK must run independently of the auth cookies.

---

## 11. Company Add Flow & Admin Dashboard Sync (Req #3, #4)

1. Registration step 1 dropdown fetches `GET /api/customer/companies` (CONFIRMED only).
2. "My company isn't listed" reveals a free-text input → submitted as `newCompanyName` in `POST /register`.
3. Server creates `Company { status: PENDING }` immediately, so uniqueness constraints catch accidental duplicates early (case-insensitive comparison recommended — normalize with `.trim().toLowerCase()` before the uniqueness check, but store the user's original casing for display).
4. The company **only** becomes `CONFIRMED` (and thus visible in the admin dashboard's Company List and in future dropdowns) at the moment that specific registering customer completes OTP verification (§5.3 step 3).
5. Add a scheduled cleanup job (daily cron / Vercel cron) that deletes `Company` rows still `PENDING` after 48 hours **if** no `Customer` row references them anymore (i.e., the registration was abandoned) — keeps the table from accumulating dead prank entries.

---

## 12. Order Limits: Multi-Thali + Add-ons (Req #10, #11)

**Configurable constants** — store in `SystemSetting` (DB-backed) rather than a hardcoded file, so admins can change limits without a redeploy:

```typescript
const DEFAULT_MAX_THALI_PER_ORDER = 10;
const DEFAULT_MAX_ADDON_PER_ORDER = 30;

async function getOrderLimit(key: "MAX_THALI_PER_ORDER" | "MAX_ADDON_PER_ORDER", fallback: number) {
  const row = await prisma.systemSetting.findUnique({ where: { key } });
  return row ? parseInt(row.value, 10) : fallback;
}
```
(If you'd rather skip the admin-editable UI for now, a plain exported constants file `src/config/order-limits.ts` is a fine simpler starting point — just note it requires a redeploy to change, unlike the DB-backed version above.)

**`POST /api/orders` validation, server-side (never trust client-side counts):**
```typescript
const maxThali = await getOrderLimit("MAX_THALI_PER_ORDER", DEFAULT_MAX_THALI_PER_ORDER);
const maxAddon = await getOrderLimit("MAX_ADDON_PER_ORDER", DEFAULT_MAX_ADDON_PER_ORDER);

const totalThaliQty = thaliItems.reduce((sum, t) => sum + t.quantity, 0);
const totalAddonQty = addonItems.reduce((sum, a) => sum + a.quantity, 0);

if (totalThaliQty > maxThali) throw new OrderLimitExceededError("thali", maxThali);
if (totalAddonQty > maxAddon) throw new OrderLimitExceededError("addon", maxAddon);
if (totalThaliQty < 1) throw new EmptyOrderError();
```

**Interpretation note:** I've read "max 10 thali per mobile number" as a per-order-submission cap (a single checkout can contain up to 10 thalis, each independently configured with its own sabji, per Req #10's "different thali with different sabji options"). If you actually intend a *daily* cumulative cap across multiple separate orders instead, the check needs to aggregate `SUM(quantity) WHERE customerId = X AND createdAtUtc >= startOfTodayIST` — let me know and I'll adjust the validator; the schema above supports either interpretation without changes.

Each `OrderThaliItem` carries its own `dailyMenuSabjiId`, so the frontend must render one sabji-selector per thali line, not one global selector for the whole order.

---

## 13. `/menu` Consolidation & Frontend UI State Flow (Req #7, #9)

Single route `src/app/menu/page.tsx` (server component) → `resolveCustomerAuthState()` → passes state into a client component that renders one of:

- **`<AuthTabs>`** (state = `ANONYMOUS` or `DRAFT_PENDING_VERIFICATION`) with three tabs:
  - **Register** — the step 1 form (§5.1)
  - **Login** — mobile + choice of PIN or OTP (§5.5)
  - **Verify** — mobile input → looks up pending draft → resumes OTP entry (§5.2/§5.3); shows a clear "no pending registration found" message if none exists, with a CTA back to Register.
- **`<OrderingExperience>`** (state = `VERIFIED_SESSION`) — the actual multi-thali + add-on ordering UI (§12), reading `getOrderLimit()` values to render "X of 10 thalis used" style counters client-side (purely UX; the real enforcement is server-side per §12).

Redirect all legacy menu-related URLs to `/menu` with `permanentRedirect()` (Next.js) so bookmarks/links don't break.

---

## 14. Admin Panel Changes (Req #1, #4, #13)

**Customer List** (new/updated page under your existing admin routes):
- Columns: Name, Mobile, Company, Work Address, Home Address, Verified (badge), Registered At (IST), Verified At (IST), Device Count, Last Login At (IST).
- Filter by verified/unverified so staff can see registration attempts that never completed (Req #1's "added to customer list" — including the not-yet-verified ones, which is useful operationally even though their company stays hidden per Req #4).

**Company List** (new page):
- Columns: Name, Status (Pending/Confirmed), Added By, Added At (IST), Customer Count, Confirmed At (IST).
- Action: "Merge duplicate" (handles near-identical company names typed slightly differently by different customers).

**Lat/Long editing** (Req #13):
- Add to the existing Customer detail view in admin only — plain numeric lat/lng inputs, never rendered anywhere in customer-facing code.
- These feed directly into the delivery/live-map work already in progress on the admin side, so staff can locate a customer precisely without the customer ever seeing or setting coordinates themselves.

---

## 15. Security Hardening Checklist

- [ ] All auth routes validate mobile format server-side before any DB write or provider call (§8).
- [ ] Rate limits enforced on MOBILE + IP + DEVICE independently for every OTP-triggering action (§7).
- [ ] OTP verification capped at 5 attempts per `verificationId`, then invalidated (§5.3).
- [ ] PIN hashed with bcrypt (12 rounds), never stored or logged in plaintext anywhere, including error logs.
- [ ] Refresh tokens stored only as hashes; raw token never persisted after issuance (§10).
- [ ] Refresh token rotation + reuse detection implemented — a replayed revoked token kills the whole session family (§10).
- [ ] Device fingerprint hash computed server-side with a private salt; raw client `visitorId` never stored (§6).
- [ ] Company rows stay `PENDING`/invisible until the registering customer's OTP verifies (§11).
- [ ] Order limits (thali/add-on) enforced server-side on every write, never trusting client-submitted totals (§12).
- [ ] `MESSAGECENTRAL_AUTH_TOKEN`, JWT secrets, and the fingerprint salt only ever read in server-side route handlers, never bundled to client JS.
- [ ] Legacy menu URLs 308-redirect to `/menu`; no other route can create an order (§13).
- [ ] Cleanup cron removes abandoned `PENDING` companies and expired `OtpVerification`/draft rows (§11).
- [ ] Admin-only lat/long fields excluded from every customer-facing API response (`select` explicitly, don't rely on omission).

---

## 16. Phased Build & Rollout Order

1. **Schema & migration** — all models in §2, run `prisma migrate dev`.
2. **Rate limiting infrastructure** — `RateLimitEvent` model + `checkRateLimit()` helper (§7), since every later route depends on it.
3. **Message Central client module** — `src/lib/message-central.ts` (send/verify functions), env vars (§3).
4. **Registration + OTP routes** — §5.1–§5.3, wired to rate limiting and mobile validation from steps 2–3.
5. **PIN system** — set-pin, login-pin, forgot-pin (§5.4, §5.5, §9).
6. **Device fingerprinting** — client SDK integration + server hashing (§6), retrofitted into steps 4–5's routes.
7. **JWT/session issuance + rotation** — §10, replacing the pre-auth token from step 4 with full sessions.
8. **`/menu` consolidation** — §13, `resolveCustomerAuthState()`, redirect legacy routes.
9. **Multi-thali + add-on ordering** — §12, including the `SystemSetting`-backed configurable limits.
10. **Admin dashboard: Customer List, Company List, Lat/Long fields** — §14.
11. **Security pass + abuse simulation** — deliberately hammer send-otp/login-pin from a test script to confirm rate limits actually trigger before wiring in real Message Central spend.

---

## 17. Testing / QA Checklist

- [ ] Registering with an invalid (non-Indian-format) mobile number is rejected before any OTP is sent.
- [ ] Sending 4 OTPs to the same mobile within an hour is blocked on the 4th.
- [ ] Entering a wrong OTP 5 times invalidates that OTP row and requires a fresh send.
- [ ] A new company stays absent from the dropdown and admin Company List until its registering customer verifies.
- [ ] Abandoning registration after step 1 (no OTP sent) leaves the Customer row visible in admin as unverified, but never creates a visible Company.
- [ ] Setting a PIN of `123456` or `000000` is rejected.
- [ ] 5 wrong PIN attempts locks login for 15 minutes; a correct PIN attempt during the lock is still rejected.
- [ ] 3 separate lockouts in 24h forces that mobile into OTP-only login, confirmed by attempting a correct PIN during the forced window and having it rejected.
- [ ] Logging in on a second, unrecognized device with a valid PIN succeeds without requiring OTP (confirms the "either/or" nature of Req #12).
- [ ] Forgot PIN flow requires OTP and cannot be completed with only the old PIN.
- [ ] Submitting an order with 11 total thali units is rejected; 10 succeeds.
- [ ] Submitting an order with 31 total add-on units is rejected; 30 succeeds.
- [ ] Each thali line in a multi-thali order can carry a different sabji selection independently.
- [ ] An unverified customer hitting `POST /api/orders` directly (e.g., via curl, bypassing the UI) is rejected server-side.
- [ ] A stolen/replayed (already-rotated) refresh token triggers full session-family revocation, confirmed by the legitimate device also being logged out.
- [ ] Lat/long fields never appear in any customer-facing API response payload, confirmed by inspecting the raw JSON, not just the rendered UI.

---

## 18. Open Questions Before You Start Coding

1. **Thali limit scope** — confirmed as per-order-submission in this plan (§12); flag if you meant a daily cumulative cap instead.
2. **Existing customer model name** — this plan uses `Customer` throughout; tell me the real model name (or upload `schema.prisma`) if you want an exact-diff version instead of a parallel plan.
3. **Message Central account status** — confirm you've already completed the signup/Customer ID/auth token steps from your OTP research doc, since §3's env vars depend on those existing.
4. **Sabji source** — this plan assumes `dailyMenuSabjiId` already exists from your daily-menu-creation work; if that schema differs, §2's `OrderThaliItem` foreign key needs adjusting to match.

---

*End of plan. All 13 stated requirements are addressed per the mapping table at the top — flag anything that still feels underspecified and I'll expand that specific section further.*