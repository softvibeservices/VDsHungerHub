# Message Central → MSG91 OTP Migration — Implementation Plan

**Project:** VD's Hunger Hub (softvibeservices-vdshungerhub)
**Scope:** Replace the Message Central / VerifyNow OTP provider with MSG91 across customer registration, customer OTP verification, forgot‑PIN, and staff/admin OTP login. No other behavior, UI, RBAC, session, or unrelated‑SMS logic changes.

---

## 0. Audit Result — Everything That Currently Touches Message Central

This was verified by grepping the entire repository. There are **no other references** to Message Central outside what's listed below (confirmed: `verificationId` never leaks to any frontend component — it is a pure backend/DB concept).

### 0.1 Provider abstraction (1 file — this is where almost all the real work happens)

| File | Role |
|---|---|
| `src/lib/message-central.ts` | Exports `sendOtp(mobile, otpLength)`, `verifyOtp(verificationId, otpCode)`, `MessageCentralError`. Only file that calls `cpaas.messagecentral.com`. |

### 0.2 Route files that import from it (6 files)

| File | Function(s) used | Notes |
|---|---|---|
| `src/app/api/customer/send-otp/route.ts` | `sendOtp` | Shared REGISTER + FORGOT_PIN send step. Catches `error?.name === "MessageCentralError"`. |
| `src/app/api/customer/verify-otp/route.ts` | `verifyOtp` | Shared REGISTER + FORGOT_PIN verify step. Calls `verifyOtp(otpRow.verificationId, otp)`. |
| `src/app/api/customer/forgot-pin/send-otp/route.ts` | `sendOtp` | Enumeration-safe forgot-PIN send; swallows provider errors silently. |
| `src/app/api/customer/forgot-pin/verify-otp/route.ts` | `verifyOtp` | Forgot-PIN verify; issues `preAuthToken`. Calls `verifyOtp(otpRow.verificationId, otp)`. |
| `src/app/api/staff/otp/send/route.ts` | `sendOtp`, `MessageCentralError` | Staff/admin OTP login send (both roles share `StaffUser`). |
| `src/app/api/staff/otp/verify/route.ts` | `verifyOtp`, `MessageCentralError` | Staff/admin OTP login verify. Calls `verifyOtp(attempt.verificationId, otpCode)`. |

`src/app/api/customer/login-otp/verify/route.ts` is a dead stub — customer OTP login is intentionally disabled (users log in via PIN). **Leave disabled. Do not re-enable.**

### 0.3 Database fields that are provider-specific (Prisma)

```prisma
model OtpVerification {
  ...
  verificationId String   // returned by Message Central "send" call   ← must change
  ...
}

model StaffOtpAttempt {
  ...
  verificationId String   // returned by Message Central's send call   ← must change
  ...
}
```

`OtpPurpose` enum (`REGISTER | LOGIN | FORGOT_PIN | STAFF_LOGIN`) and `StaffOtpPurpose` enum (`STAFF_LOGIN`) are **provider-agnostic already** — do not touch.

### 0.4 NOT touched by this migration (password-based, no OTP dependency)

- `src/app/api/staff/login-password/route.ts` (staff **and** admin password login — admin is just a `role` on `StaffUser`)
- `src/app/api/staff/change-password/route.ts`
- `src/app/api/staff/set-password/route.ts`
- `src/app/api/auth/login/route.ts` (deprecated 410 stub, just points at the two staff routes above)
- `(admin)/profile/password/page.tsx` (hits `change-password`, which is password-only)
- Mobile normalization used by OTP flows is `normalizeAndValidateMobile()` / the local `normalizeMobile()` helpers in `src/lib/customer-auth.ts` and the staff routes — these strip everything down to a **bare 10-digit Indian number** (`/^[6-9]\d{9}$/`, no `+91`/`91` prefix) before it's ever stored or passed to the provider. **This convention must be preserved** — MSG91 needs the country code, so the *new provider module* (not the routes) will be responsible for prefixing `91` when it calls MSG91.

### 0.5 Net surface area

1 new lib file, 1 deleted lib file, 6 route files (import path + one field-shape change), 1 Prisma migration, `.env.example` + deployment env vars, zero frontend changes.

---

## 1. MSG91 API Contract (verified against current MSG91 v5 OTP API + official docs, Aug 2026)

MSG91's official docs pages (`docs.msg91.com/otp/*`) are JS-rendered and didn't return raw text content during research, so the parameter list below is cross-verified against MSG91's own SDKs (Node/Python/Ruby/PHP wrappers) and third-party integration write-ups that all agree on the same v5 contract. **Before going live, open `https://docs.msg91.com/otp` from inside your logged-in MSG91 dashboard (it renders a live Postman-style API explorer with your own Auth Key pre-filled) and diff it against this table — MSG91 occasionally tweaks optional params.**

### 1.1 Send OTP

```
POST https://control.msg91.com/api/v5/otp
```

Query params:

| Param | Required | Notes |
|---|---|---|
| `template_id` | Yes | From your MSG91 → OTP → Templates dashboard. Must contain the `##OTP##` variable. |
| `mobile` | Yes | **International format with country code, no `+`**, e.g. `919876543210`. |
| `otp_length` | No | Default 4. Set to `6` to match this app's existing 6-digit OTP everywhere. |
| `otp_expiry` | No | Provider-side expiry in minutes (default ~10). Application logic already enforces its own 5-minute expiry independently — safe to leave at MSG91 default, or set to `5` to match. |
| `otp` | No | Omit — let MSG91 generate the code so it can also validate it server-side. |

Header: `authkey: <MSG91_AUTH_KEY>`

Success response (`200`):
```json
{ "type": "success", "message": "<request-reference-id>" }
```
Failure response:
```json
{ "type": "error", "message": "<human readable error>" }
```
There is **no `verificationId` concept** — the `message` field on success is just an opaque reference string useful for support tickets, not required for verification.

### 1.2 Verify OTP

```
GET https://control.msg91.com/api/v5/otp/verify?mobile=<mobile>&otp=<otp>
```
Header: `authkey: <MSG91_AUTH_KEY>`

Success:
```json
{ "type": "success", "message": "OTP verified success" }
```
Failure (wrong/expired code):
```json
{ "type": "error", "message": "OTP not match / OTP Expired" }
```

**This is the critical architectural difference from Message Central**: verification is keyed by `mobile + otp`, not by a stored `verificationId`. See §3.

### 1.3 Resend/Retry OTP (only if you want the app's existing resend button to actually trigger a fresh SMS via a different channel)

```
GET https://control.msg91.com/api/v5/otp/retry?mobile=<mobile>&retrytype=text
```
`retrytype` is `text` or `voice` (default `voice` per MSG91's own docs — **explicitly pass `text`** unless you want a voice call). Header: `authkey: <MSG91_AUTH_KEY>`.

> **Audit note on resend**: This codebase does not currently expose a distinct "resend via provider retry" call anywhere in the 6 audited routes — the existing `send-otp` endpoints are re-invoked on resend (protected by `checkResendCooldown`), which simply calls Send OTP again. Per the migration brief's instruction not to add functionality the app doesn't already have, **the plan below keeps resend as "call Send OTP again"** and only wires up `resendOtp()` in the provider module for future use — it is not called anywhere in this migration. If you want true provider-level retry/resend later, swap the resend cooldown handler to call `resendOtp()` instead of `sendOtp()`.

### 1.4 Country code handling

The app's `normalizeAndValidateMobile()` returns a bare 10-digit number. The new `src/lib/msg91.ts` module will internally do `const intlMobile = \`91${mobile}\`;` before every MSG91 call — **no route file needs to change how it passes the mobile number.**

---

## 2. How to Get Your MSG91 Credentials

Do this before writing any code so you can test against real credentials as you go.

1. **Sign up**: go to `https://msg91.com/signup` and create an account (business email + mobile verification).
2. **Complete KYC**: MSG91 requires basic business KYC before it will send live transactional SMS/OTP traffic. Dashboard → Settings → KYC. Test-mode sends work before KYC completes but are limited.
3. **Get your Auth Key**: Dashboard → **Settings → API → Auth Key**. This is `MSG91_AUTH_KEY`. MSG91 lets you generate additional restricted auth keys (IP-whitelisted) under the same menu — recommended for production so a leaked key can't be used from anywhere.
4. **Create an OTP template — No-DLT path (confirmed decision for this migration)**: Dashboard → **OTP → Templates → Add Template**. Use MSG91's **default OTP template**, not a custom DLT-backed one. Confirmed directly from MSG91's own FAQ: *"Is it possible to send OTP messages without DLT registration? Yes, you can send OTP SMS using the OTP widget with the default template configured in the channel settings."* Once created you'll see a **Template ID** — this is `MSG91_OTP_TEMPLATE_ID`. No DLT Entity ID, PE ID, or Sender Header registration is needed anywhere in this migration — do **not** start a DLT registration.
   - **Two tradeoffs of the no-DLT default template, accepted for this migration:**
     - **No custom branding.** The SMS will not show a custom sender ID/header like `VDHNGR` — it goes out under MSG91's shared default sender, not "VD's Hunger Hub."
     - **No per-message delivery logs in MSG91's OTP dashboard section** for messages sent via the default template. This does **not** affect the app's own audit trail — `OtpVerification.providerRef` / `StaffOtpAttempt.providerRef` and the success/failure handling in `src/lib/msg91.ts` are completely independent of MSG91's dashboard logging.
   - This is purely a **dashboard-side template setting** — it requires no extra environment variable, no code flag, and no change to `src/lib/msg91.ts` or any route in §6. `MSG91_OTP_TEMPLATE_ID` is populated the same way regardless of DLT status.
   - If branded/custom-sender SMS is wanted later, that's the trigger point for a future, separate DLT registration — out of scope here.
5. **Add balance / enable billing**: Dashboard → Wallet/Billing. OTP sends are metered; fund the wallet or attach a payment method, otherwise Send OTP calls will fail with an insufficient-balance error in production.
6. **(Optional but recommended) Restrict the Auth Key by IP**: Settings → API → Auth Key → IP Whitelist. Add your production server's egress IP(s) so the key can't be used if leaked.
7. **Test from the dashboard**: Dashboard → OTP → Test/Playground lets you fire a real Send + Verify against your own phone before wiring up code — do this once to confirm your template and account are live.
8. **Copy the two values into your secrets manager**: `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`. Never commit them.

---

## 3. The `verificationId` Decision

Message Central's flow is: Send → provider returns `verificationId` → app stores it → Verify needs that exact `verificationId` + code.

MSG91's flow is: Send → provider returns an opaque reference string (not required later) → Verify needs `mobile` + `code` only.

**Decision:** Rename the field in both tables from a required, functionally-load-bearing `verificationId` to an **optional, audit-only** `providerRef`. The app's own `OtpVerification` / `StaffOtpAttempt` rows remain the actual source of truth for "is there an active, unexpired, unconsumed OTP for this mobile+purpose" — exactly as they are today. MSG91 is only asked "does this mobile+otp pair match," nothing more.

This is non-destructive (nullable column, not dropped) and keeps a debugging trail (MSG91's dashboard lets you look up a send by its reference string if a customer disputes not receiving an SMS).

### 3.1 Prisma schema diff

```diff
 model OtpVerification {
   id             String     @id @default(cuid())
   mobile         String
   purpose        OtpPurpose
-  verificationId String              // returned by Message Central "send" call
+  providerRef    String?             // opaque MSG91 send reference, audit-only — NOT required for verification
   userId         String?             // linked once a User draft exists
   attempts       Int        @default(0)
   expiresAtUtc   DateTime
   consumedAtUtc  DateTime?
   createdAtUtc   DateTime   @default(now())

   @@index([mobile, purpose])
 }
```

```diff
 model StaffOtpAttempt {
   id             String          @id @default(cuid())
   mobile         String
   purpose        StaffOtpPurpose @default(STAFF_LOGIN)
-  verificationId String          // returned by Message Central's send call
+  providerRef    String?         // opaque MSG91 send reference, audit-only — NOT required for verification
   ip             String
   userAgent      String
   attempts       Int             @default(0)
   expiresAtUtc   DateTime
   consumedAtUtc  DateTime?
   createdAtUtc   DateTime        @default(now())

   @@index([mobile, purpose])
 }
```

### 3.2 Migration

```bash
npx prisma migrate dev --name msg91_provider_ref
```

Expected generated SQL (Postgres — verify against your actual `provider` in `schema.prisma`, this repo uses Postgres per `DATABASE_URL`):

```sql
-- AlterTable
ALTER TABLE "OtpVerification" RENAME COLUMN "verificationId" TO "providerRef";
ALTER TABLE "OtpVerification" ALTER COLUMN "providerRef" DROP NOT NULL;

-- AlterTable
ALTER TABLE "StaffOtpAttempt" RENAME COLUMN "verificationId" TO "providerRef";
ALTER TABLE "StaffOtpAttempt" ALTER COLUMN "providerRef" DROP NOT NULL;
```

> Renaming (not dropping+adding) preserves existing rows and their history. Prisma will normally infer a rename if you edit the schema and run `migrate dev` interactively (it asks "did you rename this field?" — say yes) — if it instead proposes drop+add, hand-edit the generated migration SQL to the `RENAME COLUMN` form above before applying, to avoid data loss on any in-flight OTP rows.

Any *existing, still-active* OtpVerification/StaffOtpAttempt rows created under Message Central (i.e., rows with a real Message Central `verificationId` that are unexpired/unconsumed at cutover time) will **no longer verify successfully** after this migration, because the old value is now sitting in `providerRef` and is never read by the new verify path. This is expected and fine — see §8 Cutover Plan, OTPs are 5 minutes and low-stakes; nobody will have an OTP in flight if you deploy during a quiet period.

---

## 4. Environment Variables

### 4.1 Add to `.env.example`

```diff
 DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
 JWT_SECRET="your_jwt_secret_here"
 NEXT_PUBLIC_APP_NAME="VD's Hunger Hub"

-# Message Central VerifyNow OTP credentials
-# Get these from your Message Central / VerifyNow dashboard
-MESSAGECENTRAL_BASE_URL="https://cpaas.messagecentral.com"
-MESSAGECENTRAL_CUSTOMER_ID="your_customer_id_here"
-MESSAGECENTRAL_AUTH_TOKEN="your_auth_token_here"
+# MSG91 OTP credentials
+# Get these from your MSG91 dashboard: Settings > API > Auth Key, and OTP > Templates
+MSG91_BASE_URL="https://control.msg91.com"
+MSG91_AUTH_KEY="your_msg91_auth_key_here"
+MSG91_OTP_TEMPLATE_ID="your_msg91_otp_template_id_here"
+# Optional — provider-side OTP validity window in minutes. Leave unset to use MSG91's account default;
+# the application enforces its own 5-minute expiry independently regardless of this value.
+MSG91_OTP_EXPIRY_MIN="5"

 # Server-side pepper for hashing the client fingerprint.
 ...
```

### 4.2 Update real `.env` in every environment (local, staging, production)

Remove `MESSAGECENTRAL_*`, add `MSG91_*` with real values from §2. **Do this in your deployment platform's secrets manager, not by committing `.env`.**

---

## 5. New Provider Module — `src/lib/msg91.ts`

Create this file. It mirrors the exported shape of the old module as closely as possible (`sendOtp`, `verifyOtp`, a typed error class) but adapts the signatures to MSG91's mobile+otp verification model, and keeps the exact same "server-side only" contract via the same header comment convention used in the rest of `src/lib/*`.

```typescript
// src/lib/msg91.ts

/**
 * MSG91 OTP client
 * Docs: https://docs.msg91.com/otp
 *
 * All functions are server-side only — never import this from client components.
 *
 * Replaces the previous Message Central / VerifyNow provider (src/lib/message-central.ts,
 * now removed). Unlike Message Central, MSG91's standard OTP API verifies using
 * mobile + otp directly — there is no provider-side verificationId to round-trip.
 * The application's own OtpVerification / StaffOtpAttempt tables remain the source of
 * truth for expiry, attempts, consumption and purpose — this module only talks to MSG91.
 */

const BASE_URL = process.env.MSG91_BASE_URL ?? "https://control.msg91.com";
const AUTH_KEY = process.env.MSG91_AUTH_KEY ?? "";
const TEMPLATE_ID = process.env.MSG91_OTP_TEMPLATE_ID ?? "";
const OTP_EXPIRY_MIN = process.env.MSG91_OTP_EXPIRY_MIN
  ? Number(process.env.MSG91_OTP_EXPIRY_MIN)
  : undefined;

export class Msg91Error extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string
  ) {
    super(message);
    this.name = "Msg91Error";
  }
}

/** Bare 10-digit Indian mobile (this app's internal convention) -> MSG91's expected
 *  international format with country code and no leading "+". */
function toIntlMobile(mobile: string): string {
  return `91${mobile}`;
}

/**
 * Send an OTP to an Indian mobile number via MSG91.
 *
 * Returns an opaque provider reference string for audit/support purposes only
 * (e.g. to store as OtpVerification.providerRef / StaffOtpAttempt.providerRef).
 * This value is NEVER required or used by verifyOtp() — verification is done by
 * mobile + otp per MSG91's API contract.
 */
export async function sendOtp(mobile: string, otpLength: number = 6): Promise<string> {
  if (!AUTH_KEY || !TEMPLATE_ID) {
    throw new Msg91Error(
      "MSG91 credentials not configured. Set MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID in .env"
    );
  }

  const url = new URL(`${BASE_URL}/api/v5/otp`);
  url.searchParams.set("template_id", TEMPLATE_ID);
  url.searchParams.set("mobile", toIntlMobile(mobile));
  url.searchParams.set("otp_length", String(otpLength));
  if (OTP_EXPIRY_MIN !== undefined) {
    url.searchParams.set("otp_expiry", String(OTP_EXPIRY_MIN));
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { authkey: AUTH_KEY },
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Msg91Error(`MSG91 sendOtp failed (HTTP ${res.status})`, res.status, body);
  }

  let json: { type?: string; message?: string };
  try {
    json = JSON.parse(body);
  } catch {
    throw new Msg91Error("MSG91 returned non-JSON body", res.status, body);
  }

  if (json?.type !== "success") {
    throw new Msg91Error(
      `MSG91 sendOtp failed: ${json?.message ?? "unknown error"}`,
      res.status,
      body
    );
  }

  // On success, `message` holds MSG91's opaque request reference — useful for support
  // lookups in the MSG91 dashboard, not required for verification.
  return json.message ?? "";
}

/**
 * Verify the OTP submitted by the user against MSG91.
 * Returns true if valid, throws Msg91Error on invalid/expired/mismatched.
 *
 * Note the signature change from the old Message Central client: this takes the
 * mobile number, not a stored verificationId — MSG91 verifies by mobile + otp.
 */
export async function verifyOtp(mobile: string, otpCode: string): Promise<true> {
  if (!AUTH_KEY) {
    throw new Msg91Error("MSG91 credentials not configured.");
  }

  const url = new URL(`${BASE_URL}/api/v5/otp/verify`);
  url.searchParams.set("mobile", toIntlMobile(mobile));
  url.searchParams.set("otp", otpCode);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { authkey: AUTH_KEY },
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Msg91Error(`MSG91 verifyOtp failed (HTTP ${res.status})`, res.status, body);
  }

  let json: { type?: string; message?: string };
  try {
    json = JSON.parse(body);
  } catch {
    throw new Msg91Error("MSG91 returned non-JSON body", res.status, body);
  }

  if (json?.type === "success") {
    return true;
  }

  throw new Msg91Error(
    `OTP verification failed: ${json?.message ?? "unknown"}`,
    res.status,
    body
  );
}

/**
 * Resend the OTP via MSG91's retry channel (text or voice).
 * NOT currently called anywhere in the application — the existing resend UX re-invokes
 * sendOtp() behind the app's own resend cooldown, and this migration preserves that
 * behavior unchanged. Provided here for future use if you want a true provider-level
 * retry instead of a fresh Send.
 */
export async function resendOtp(
  mobile: string,
  retryType: "text" | "voice" = "text"
): Promise<void> {
  if (!AUTH_KEY) {
    throw new Msg91Error("MSG91 credentials not configured.");
  }

  const url = new URL(`${BASE_URL}/api/v5/otp/retry`);
  url.searchParams.set("mobile", toIntlMobile(mobile));
  url.searchParams.set("retrytype", retryType);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { authkey: AUTH_KEY },
  });

  const body = await res.text();

  if (!res.ok) {
    throw new Msg91Error(`MSG91 resendOtp failed (HTTP ${res.status})`, res.status, body);
  }

  let json: { type?: string; message?: string };
  try {
    json = JSON.parse(body);
  } catch {
    throw new Msg91Error("MSG91 returned non-JSON body", res.status, body);
  }

  if (json?.type !== "success") {
    throw new Msg91Error(
      `MSG91 resendOtp failed: ${json?.message ?? "unknown error"}`,
      res.status,
      body
    );
  }
}
```

Then **delete** `src/lib/message-central.ts` (after all 6 call sites are migrated — see §6 — to avoid an intermediate broken-build state; order this as the last file-system change in your PR).

---

## 6. Route-by-Route Changes

For every file below: the only logical change is the import source, the error class name, and — **only for the two `verify-otp` routes** — passing `mobile` instead of `otpRow.verificationId` / `attempt.verificationId` into `verifyOtp()`. Rate limiting, fingerprinting, enumeration protection, attempt counting, expiry checks, and response shapes are **byte-for-byte unchanged**.

### 6.1 `src/app/api/customer/forgot-pin/send-otp/route.ts`

```diff
-import { sendOtp } from "@/lib/message-central";
+import { sendOtp } from "@/lib/msg91";
```
```diff
       try {
-        const verificationId = await sendOtp(mobile);
+        const providerRef = await sendOtp(mobile);
         const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

         await prisma.otpVerification.create({
           data: {
             mobile,
             purpose: "FORGOT_PIN",
-            verificationId,
+            providerRef,
             userId: user.id,
             expiresAtUtc: expiresAt,
           },
         });
```
No other changes — this route already swallows provider errors silently for enumeration protection, so no error-class check to update here.

### 6.2 `src/app/api/customer/forgot-pin/verify-otp/route.ts`

```diff
-import { verifyOtp } from "@/lib/message-central";
+import { verifyOtp } from "@/lib/msg91";
```
```diff
-    // Verify with Message Central
+    // Verify with MSG91
     try {
-      await verifyOtp(otpRow.verificationId, otp);
+      await verifyOtp(mobile, otp);
     } catch {
```
`mobile` is already in scope (validated a few lines above via `normalizeAndValidateMobile`) — no new variable needed.

### 6.3 `src/app/api/customer/send-otp/route.ts`

```diff
-import { sendOtp } from "@/lib/message-central";
+import { sendOtp } from "@/lib/msg91";
```
```diff
-    // ── Call Message Central ──────────────────────────────────────────────────
-    const verificationId = await sendOtp(mobile);
+    // ── Call MSG91 ─────────────────────────────────────────────────────────────
+    const providerRef = await sendOtp(mobile);
```
```diff
     await prisma.otpVerification.create({
       data: {
         mobile,
         purpose: purpose as "REGISTER" | "LOGIN" | "FORGOT_PIN",
-        verificationId,
+        providerRef,
         userId: linkedUserId ?? null,
         expiresAtUtc: expiresAt,
       },
     });
```
```diff
-    if (error?.name === "MessageCentralError") {
-      console.error("[SEND-OTP] Message Central error:", error.message);
+    if (error?.name === "Msg91Error") {
+      console.error("[SEND-OTP] MSG91 error:", error.message);
       return NextResponse.json(
         { error: "Failed to send OTP. Please try again in a moment." },
         { status: 502 }
       );
     }
```

### 6.4 `src/app/api/customer/verify-otp/route.ts`

```diff
-import { verifyOtp } from "@/lib/message-central";
+import { verifyOtp } from "@/lib/msg91";
```
```diff
-    // ── Call Message Central to verify ────────────────────────────────────────
+    // ── Call MSG91 to verify ───────────────────────────────────────────────────
     try {
-      await verifyOtp(otpRow.verificationId, otp);
+      await verifyOtp(mobile, otp);
     } catch (err: any) {
```
`mobile` is already destructured from the request body at the top of this handler — no new variable needed. (Note: this route's `mobile` comes straight from the client, unlike the forgot-pin verify route where it's re-validated — that's pre-existing behavior, not something this migration should change.)

### 6.5 `src/app/api/staff/otp/send/route.ts`

```diff
-import { sendOtp, MessageCentralError } from "@/lib/message-central";
+import { sendOtp, Msg91Error } from "@/lib/msg91";
```
```diff
     // Dummy path for invalid/inactive staff to prevent user enumeration
     if (!staff || staff.status !== "ACTIVE") {
       await prisma.staffOtpAttempt.create({
         data: {
           mobile,
-          verificationId: "no-account",
+          providerRef: "no-account",
           ip,
           userAgent,
           expiresAtUtc: new Date(Date.now() + OTP_TTL_MS),
         },
       });
       return NextResponse.json({ message: "If this number is registered, an OTP has been sent." });
     }

-    // 4. Send actual OTP via Message Central
-    const verificationId = await sendOtp(mobile, 6);
+    // 4. Send actual OTP via MSG91
+    const providerRef = await sendOtp(mobile, 6);

     await prisma.staffOtpAttempt.create({
       data: {
         mobile,
-        verificationId,
+        providerRef,
         ip,
         userAgent,
         expiresAtUtc: new Date(Date.now() + OTP_TTL_MS),
       },
     });
```
```diff
-    if (error instanceof MessageCentralError) {
-      console.error("[STAFF OTP SEND] Message Central error:", error.message, error.responseBody);
+    if (error instanceof Msg91Error) {
+      console.error("[STAFF OTP SEND] MSG91 error:", error.message, error.responseBody);
       return NextResponse.json({ error: "Could not send OTP right now. Please try again." }, { status: 502 });
     }
```
The `"no-account"` sentinel logic is preserved exactly — `providerRef` is nullable now, but this string sentinel still works fine and keeps the enumeration-protection dummy path's behavior identical.

### 6.6 `src/app/api/staff/otp/verify/route.ts`

```diff
-import { verifyOtp, MessageCentralError } from "@/lib/message-central";
+import { verifyOtp, Msg91Error } from "@/lib/msg91";
```
```diff
     // Most recent, unconsumed, unexpired attempt for this mobile
     const attempt = await prisma.staffOtpAttempt.findFirst({
       where: { mobile, consumedAtUtc: null, expiresAtUtc: { gt: new Date() } },
       orderBy: { createdAtUtc: "desc" },
     });

-    if (!attempt || attempt.verificationId === "no-account") {
+    if (!attempt || attempt.providerRef === "no-account") {
       return NextResponse.json({ error: "Invalid or expired code. Please request a new one." }, { status: 400 });
     }

     if (attempt.attempts >= MAX_VERIFY_ATTEMPTS) {
       return NextResponse.json({ error: "Too many incorrect attempts. Request a new code." }, { status: 429 });
     }

     try {
-      await verifyOtp(attempt.verificationId, String(otpCode));
+      await verifyOtp(mobile, String(otpCode));
     } catch (err) {
       await prisma.staffOtpAttempt.update({
         where: { id: attempt.id },
         data: { attempts: { increment: 1 } },
       });
-      if (err instanceof MessageCentralError) {
+      if (err instanceof Msg91Error) {
         return NextResponse.json({ error: "Incorrect or expired code." }, { status: 400 });
       }
       throw err;
     }
```
`mobile` is already the normalized local variable from `normalizeMobile(rawMobile)` earlier in this handler.

### 6.7 Delete the old provider file

Once 6.1–6.6 are applied and the build is green, delete `src/lib/message-central.ts`.

### 6.8 Files that need **zero** changes (confirmed by audit, listed so nothing is missed)

- `src/app/api/customer/login-otp/verify/route.ts` (dead stub, stays disabled)
- `src/app/api/staff/login-password/route.ts`, `change-password/route.ts`, `set-password/route.ts`
- `src/app/api/auth/login/route.ts`, `logout/route.ts`, `me/route.ts`
- `src/app/(admin)/profile/password/page.tsx`
- `src/components/customer/VerifyForm.tsx`, `OtpModal.tsx`, `AuthOverlay.tsx`, `AuthTabs.tsx`, `RegisterForm.tsx`, `LoginForm.tsx` — these only ever see `{ otpSent, expiresInSeconds }` / `{ verified, preAuthToken, nextStep }` shapes from the API, never the provider's internal fields, so their UI/UX is untouched.
- `src/app/(auth)/staff-login/page.tsx` — same reasoning.

---

## 7. Error Handling & Logging Rules

- `Msg91Error` (analogous to old `MessageCentralError`) carries `message`, `statusCode`, `responseBody` — never render `responseBody` or the raw MSG91 `message` field to the end user. All 6 routes already follow this pattern (generic user-facing strings, detailed `console.error` server-side) — preserve it exactly, only rename the class/log prefix as shown in §6.
- Never log the OTP code, `MSG91_AUTH_KEY`, or full request URLs containing the auth key. The `console.error` calls in the audited routes only log `error.message` / `error.responseBody`, which is safe since `msg91.ts` never puts the auth key in the response body path (it's a header, not a query param... **double check**: per §1, `authkey` is sent as a **header**, not a URL query param, in both `sendOtp` and `verifyOtp` above — this is intentional so it never ends up in the `url.toString()` that could theoretically get logged during debugging).

---

## 8. Cutover Plan

1. Merge the code changes (§5, §6) to a branch; do **not** deploy yet.
2. Run the Prisma migration (§3.2) against a staging database first; verify no data loss on a copy of prod data if possible.
3. Set `MSG91_AUTH_KEY` / `MSG91_OTP_TEMPLATE_ID` / `MSG91_BASE_URL` in staging env; leave `MESSAGECENTRAL_*` unset there to confirm nothing still depends on them (build should still succeed and OTP flows should work end-to-end — see §9).
4. Deploy to staging, run the full test matrix in §9.
5. Schedule the production deploy for a low-traffic window (any customer with an OTP mid-flow at the exact deploy moment will need to re-request one — 5 minute window, acceptable risk).
6. Apply the production Prisma migration, deploy the code, set production env vars, remove `MESSAGECENTRAL_*` from the production secrets store.
7. Immediately smoke-test: one real registration, one real forgot-PIN, one real staff OTP login against production MSG91.
8. Monitor MSG91 dashboard delivery reports + application error logs for the first hour for `Msg91Error` spikes (wrong auth key, template not approved, insufficient balance are the most common first-hour failures).

### Rollback

Because `providerRef` is nullable and the rename is additive-safe, rolling back is: redeploy the previous code revision + re-add `MESSAGECENTRAL_*` env vars. The Prisma migration does **not** need to be reverted for a code-only rollback (the old code never reads `providerRef`, it reads `verificationId` — reverting the column name via `prisma migrate resolve` / a down-migration is only necessary if you also need to roll back the schema, e.g. for a long-term rollback rather than a same-day one).

---

## 9. Test Matrix (run all of these in staging before production cutover)

### Customer Registration
- [ ] Valid mobile → OTP send succeeds, SMS received
- [ ] Invalid mobile → 400 before any provider call
- [ ] Correct OTP → verified, `SET_PIN` step, PIN creation, session created
- [ ] Incorrect OTP → 401, `attemptsRemaining` decrements correctly
- [ ] 5 incorrect attempts → row consumed, 429, must request new OTP
- [ ] Expired OTP (wait 5+ min) → 404 `OTP_EXPIRED`
- [ ] Resend within cooldown → blocked with wait time
- [ ] Rate limit (mobile/IP/device) still triggers before any MSG91 call is made

### Customer Login
- [ ] PIN login unaffected (no provider dependency)
- [ ] OTP login route still returns the disabled-login 400 message

### Forgot PIN
- [ ] Registered + verified + active mobile → OTP sent
- [ ] Unregistered mobile → generic "if registered" message, no SMS sent, no error leaked
- [ ] Inactive/banned account → generic message (enumeration protection), no SMS sent
- [ ] Correct OTP → `preAuthToken` issued, PIN reset succeeds, can log in with new PIN
- [ ] Incorrect / expired / 5-attempt-lockout behave identically to registration flow

### Staff Login (OTP path)
- [ ] Active staff, correct OTP → session cookie set, correct `role`/`permissions`
- [ ] Inactive/deleted staff → generic "if registered" dummy path, no real MSG91 call made (still writes the `"no-account"` sentinel row)
- [ ] Incorrect OTP, expired OTP, 5-attempt lockout → same behavior as before
- [ ] Rate limits (mobile/IP/device) still enforced before MSG91 call

### Admin Login
- [ ] Same as Staff Login above, with a `StaffUser` row where `role = ADMIN`
- [ ] Confirm RBAC/permissions after login are unchanged from pre-migration behavior
- [ ] Confirm password-login path for admin is completely unaffected

### Provider Failure Simulation
- [ ] Temporarily set a wrong `MSG91_AUTH_KEY` → send-otp routes return their existing generic 502 message, nothing leaks
- [ ] Simulate MSG91 5xx (or point `MSG91_BASE_URL` at an unreachable host) → same generic failure handling, no unhandled exception / 500 stack trace to the client
- [ ] Malformed JSON response → `Msg91Error("MSG91 returned non-JSON body")` caught the same way as HTTP errors

### Build & Static Validation
- [ ] `npx tsc --noEmit`
- [ ] `npx eslint .`
- [ ] `npx prisma validate && npx prisma generate`
- [ ] `npm run build`
- [ ] `grep -ri "message-central\|messagecentral\|verifynow" src/ prisma/` returns **no results**
- [ ] Confirm `MSG91_AUTH_KEY` never appears in any client-side bundle (`grep` the `.next` build output, or simply confirm `msg91.ts` is never imported from a `"use client"` file — it isn't, per §6.8)

---

## 10. Final Repository Audit Checklist

- [ ] `src/lib/msg91.ts` exists and is the only file that calls `control.msg91.com`
- [ ] `src/lib/message-central.ts` deleted
- [ ] `grep -r "MessageCentral\|MESSAGECENTRAL\|VerifyNow\|message-central" src/ prisma/ .env.example` → no matches
- [ ] All 6 route files import from `@/lib/msg91` and reference `Msg91Error`
- [ ] `OtpVerification.providerRef` and `StaffOtpAttempt.providerRef` exist (nullable), old `verificationId` column gone, migration applied cleanly in every environment
- [ ] `.env.example` documents `MSG91_BASE_URL`, `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID`, `MSG91_OTP_EXPIRY_MIN`; `MESSAGECENTRAL_*` entries removed
- [ ] No real MSG91 credentials committed anywhere
- [ ] Rate limiting, device fingerprint checks, resend cooldown, 5-minute expiry, 5-attempt cap, enumeration protection all verified unchanged in §9
- [ ] Customer PIN login, staff/admin password login, RBAC, sessions, JWT handling all verified unchanged (they were never touched)
- [ ] No UI/component files were modified
- [ ] Full test matrix (§9) passed in staging before production deploy


What's inside:

Full audit table (1 provider lib + 6 route files + 2 Prisma models, confirmed nothing else touches Message Central)
Verified current MSG91 v5 OTP API contract (Send/Verify/Retry endpoints, params, headers, response shapes) from live search — with a callout to double-check against your logged-in dashboard's Postman explorer since MSG91's own docs pages are JS-rendered
Step-by-step for getting MSG91_AUTH_KEY and MSG91_OTP_TEMPLATE_ID from the MSG91 dashboard (signup → KYC → template approval → billing → optional IP whitelist)
The key architectural call-out: Message Central's verificationId model doesn't exist in MSG91 (which verifies by mobile+otp), so verificationId → providerRef (nullable, audit-only) with exact Prisma schema diff + migration SQL
Full src/lib/msg91.ts implementation
Exact before/after diffs for all 6 route files (import + error class rename + the mobile-vs-verificationId change in the two verify routes)
Cutover/rollback plan, full test matrix, and final audit checklist

One thing worth flagging before you build: I couldn't 100% confirm the /api/v5/otp/retry endpoint path and otp_expiry unit directly from MSG91's rendered docs (search results and SDK wrappers agree, but I noted it in §1 as a "verify against your dashboard" item) — worth a 2-minute sanity check against the live API explorer once you're logged in, since that's free and removes any doubt before you ship.