# MSG91 Widget OTP Migration — Implementation Plan

## Background & Problem Statement

### Why this plan exists

The current implementation (completed in `msg_91_implementation.md`) wires up MSG91's
**server-side OTP API** (`POST /api/v5/otp`, `GET /api/v5/otp/verify`). That API requires a
**DLT-registered OTP template** — without one, MSG91 accepts the request and returns
`{"type":"success"}` but **never delivers the SMS**. This is exactly the symptom observed:
`/api/customer/send-otp` returns `{"otpSent":true}` but no SMS arrives on the mobile.

### Root cause (confirmed)

`MSG91_OTP_TEMPLATE_ID="3668766a3065313831393738"` in `.env` is a **Widget ID**, not a
template ID. Widget IDs are not valid for the OTP API endpoints. MSG91 silently swallows
the request.

### Decision

Use the **MSG91 OTP Widget (No-DLT path)** instead. MSG91 confirmed in their own FAQ:
> *"Is it possible to send OTP messages without DLT registration? Yes, you can send OTP
> SMS using the OTP widget with the default template configured in the channel settings."*

DLT registration is **not needed** and **not started** for this migration.

---

## How the MSG91 Widget Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     MSG91 Widget Flow (exposeMethods: true)             │
│                                                                         │
│  1. Load widget JS once in app layout (invisible, no popup)             │
│     → window.initSendOTP(config) initialises the widget                 │
│                                                                         │
│  2. Send OTP — FRONTEND calls:                                          │
│       window.sendOTP()                                                  │
│     MSG91 Widget JS directly sends the SMS (no backend call needed)     │
│                                                                         │
│  3. User receives SMS, types OTP into OUR existing UI                   │
│                                                                         │
│  4. Verify OTP — FRONTEND calls:                                        │
│       window.verifyOTP(otpCode)                                         │
│     On success → widget's success() callback fires with a JWT token     │
│     On failure → widget's failure() callback fires with error reason    │
│                                                                         │
│  5. Frontend sends that JWT token to our backend:                       │
│       POST /api/customer/verify-otp { widgetToken, mobile, purpose }   │
│                                                                         │
│  6. Backend calls MSG91 to validate the token:                          │
│       POST https://control.msg91.com/api/v5/widget/verifyAccessToken    │
│     Response includes { "mobile": "917016625488", "type": "success" }  │
│                                                                         │
│  7. Backend extracts mobile, cross-checks with our DB, proceeds         │
│     exactly as before (OtpVerification table, preAuthToken, etc.)       │
└─────────────────────────────────────────────────────────────────────────┘
```

Key difference from the previous (broken) flow:

| Aspect | Old flow (broken) | New Widget flow |
|---|---|---|
| OTP send trigger | Backend calls MSG91 API | Frontend calls `window.sendOTP()` |
| OTP verify trigger | Backend calls MSG91 API | Frontend calls `window.verifyOTP(otp)`, gets JWT |
| Backend verify call | `GET /api/v5/otp/verify?mobile=…&otp=…` | `POST /api/v5/widget/verifyAccessToken` with JWT |
| DLT required? | ✅ Yes | ❌ No |
| Our UI changes? | None | Minimal (no design changes, same inputs) |

---

## §1 — Environment Variables

### Changes to `.env` and `.env.example`

Remove `MSG91_OTP_TEMPLATE_ID` (no longer needed for Widget flow).
Add `MSG91_WIDGET_ID` (already have the value).

```env
# Before (current .env)
MSG91_BASE_URL="https://control.msg91.com"
MSG91_AUTH_KEY="563057A6wYuosJ5R6a89764eP1"
MSG91_OTP_TEMPLATE_ID="3668766a3065313831393738"  ← REMOVE
MSG91_OTP_EXPIRY_MIN="5"

# After
MSG91_BASE_URL="https://control.msg91.com"
MSG91_AUTH_KEY="563057A6wYuosJ5R6a89764eP1"
MSG91_WIDGET_ID="3668766a3065313831393738"          ← NEW (same value, correct key name)
# MSG91_OTP_EXPIRY_MIN not needed — widget handles expiry on its side
```

No other env changes. Authkey stays identical.

---

## §2 — Files Changed / Added / Removed

### Full audit (7 files)

| File | Action | Reason |
|---|---|---|
| `src/lib/msg91.ts` | MODIFY | Remove `sendOtp()`. Replace `verifyOtp()` with `verifyWidgetToken()`. Keep `Msg91Error`. |
| `src/app/api/customer/send-otp/route.ts` | MODIFY | Remove MSG91 `sendOtp()` call. Still runs rate-limit, fingerprint, DB write. |
| `src/app/api/customer/verify-otp/route.ts` | MODIFY | Accept `widgetToken` instead of `otp`. Call `verifyWidgetToken()`. |
| `src/app/api/customer/forgot-pin/send-otp/route.ts` | MODIFY | Same as customer send-otp above. |
| `src/app/api/customer/forgot-pin/verify-otp/route.ts` | MODIFY | Same as customer verify-otp above. |
| `src/app/api/staff/otp/send/route.ts` | MODIFY | Remove MSG91 `sendOtp()` call. |
| `src/app/api/staff/otp/verify/route.ts` | MODIFY | Accept `widgetToken`. Call `verifyWidgetToken()`. |
| `src/components/customer/VerifyForm.tsx` | MODIFY | Load widget, call `window.sendOTP()` / `window.verifyOTP()`. |
| `src/components/customer/LoginForm.tsx` | MODIFY | Same as VerifyForm (forgot-pin flow). |
| `src/app/(auth)/staff-login/page.tsx` | MODIFY | Same (staff reset password OTP flow). |
| `src/app/layout.tsx` (or equivalent root layout) | MODIFY | Add `<Script>` tag to load `otp-provider.js` once for the whole app. |
| `.env` | MODIFY | Rename `MSG91_OTP_TEMPLATE_ID` → `MSG91_WIDGET_ID`. |
| `.env.example` | MODIFY | Same rename. |

**No Prisma schema changes.** The `providerRef` column (nullable) already exists — it will
simply remain `null` for widget-based sends (there is no provider-side send reference to
store since the widget handles the send entirely on the client).

---

## §3 — `src/lib/msg91.ts` — New Implementation

### What stays
- `Msg91Error` class — unchanged.
- `getEnvConfig()` helper — updated to read `MSG91_WIDGET_ID` instead of `MSG91_OTP_TEMPLATE_ID`.

### What is removed
- `sendOtp()` — The widget JS sends the OTP from the frontend. There is no backend "send" call.
- `verifyOtp()` — The widget JS verifies the OTP and returns a JWT. Backend never calls `/api/v5/otp/verify`.
- `resendOtp()` — The widget handles retries via its own built-in retry mechanism.

### What is added

```typescript
/**
 * Verifies the JWT access token returned by the MSG91 OTP Widget's success callback.
 *
 * Call: POST https://control.msg91.com/api/v5/widget/verifyAccessToken
 * Body: { authkey, "access-token": widgetToken }
 *
 * On success, MSG91 returns the verified mobile number in international format
 * (e.g. "917016625488") which we strip to bare 10-digit before returning.
 *
 * Throws Msg91Error if the token is invalid, expired, or the call fails.
 */
export async function verifyWidgetToken(widgetToken: string): Promise<string> {
  // returns bare 10-digit mobile on success
}
```

**Response shape from MSG91:**
```json
{
  "message": "917016625488",
  "type": "success"
}
```
The `message` field is the verified mobile in `91XXXXXXXXXX` format — strip `91` prefix to
get the bare 10-digit mobile our DB stores.

---

## §4 — Backend Route Changes

### §4.1 — `send-otp` routes (customer + forgot-pin)

**What changes:** Remove the `sendOtp()` call and the `providerRef` storage. Everything else stays —
rate limiting, device fingerprint, DB `OtpVerification` row creation.

**New responsibility of `send-otp`:** The route now acts as a **pre-flight validator and rate-limiter only**.
It validates mobile, checks registration state, enforces 3-axis rate limits, and creates the
`OtpVerification` row. The actual SMS is sent by the frontend widget immediately after this
succeeds.

```diff
- const providerRef = await sendOtp(mobile);
- await prisma.otpVerification.create({ data: { mobile, purpose, providerRef, ... } });
+ await prisma.otpVerification.create({ data: { mobile, purpose, providerRef: null, ... } });
```

Response shape — **unchanged**: `{ otpSent: true, expiresInSeconds: 300 }`.

### §4.2 — `verify-otp` routes (customer + forgot-pin)

**What changes:** Accept `widgetToken` (string) instead of `otp` (6-digit string).
Call `verifyWidgetToken(widgetToken)` to get the verified mobile back from MSG91.
Cross-check the returned mobile matches the claimed mobile. Mark `OtpVerification` consumed.

**New request body:**
```json
{ "mobile": "7016625488", "widgetToken": "<jwt_from_widget>", "purpose": "REGISTER" }
```

**Validation changes:**
- Remove `otp` 6-digit regex check.
- Add: `widgetToken` must be a non-empty string.
- The attempt counter (5-attempt cap) is **removed** — MSG91's widget enforces its own attempt
  limits internally. The `OtpVerification` row is still consumed after first successful verify
  to prevent token replay.

**Why keep the OtpVerification row at all?**
The row continues to serve as:
- Replay attack prevention (token is single-use: row is consumed on first success).
- Enumeration protection (FORGOT_PIN path returns success even for unregistered numbers,
  but only creates a row for real accounts).
- Our own 5-minute expiry independent of MSG91.

### §4.3 — `staff/otp/send` route

Same pattern as §4.1 — remove `sendOtp()`, store `providerRef: null`.

### §4.4 — `staff/otp/verify` route

Same pattern as §4.2 — accept `widgetToken`, call `verifyWidgetToken()`, remove 6-digit
OTP validation, remove the attempt counter loop (widget handles internally).

---

## §5 — Frontend Changes

The OTP Widget SDK must be loaded **once** for the whole app and must be initialized with the
mobile number **before** the user triggers "Send OTP". We use `exposeMethods: true` so the
widget never renders any popup UI — it only exposes `window.sendOTP()` and `window.verifyOTP()`.

### §5.1 — Root Layout: Load widget JS

Add the MSG91 OTP Widget JS to the root `<body>`. This uses Next.js's `<Script>` component
with `strategy="lazyOnload"` so it never blocks first paint.

```tsx
// In root layout (src/app/layout.tsx or equivalent)
import Script from "next/script";

// Inside <body>:
<Script
  id="msg91-otp-widget-init"
  strategy="lazyOnload"
  dangerouslySetInnerHTML={{
    __html: `
      (function loadOtpScript(urls) {
        let i = 0;
        function attempt() {
          var s = document.createElement('script');
          s.src = urls[i]; s.async = true;
          s.onerror = function() { i++; if (i < urls.length) attempt(); };
          document.head.appendChild(s);
        }
        attempt();
      })([
        'https://verify.msg91.com/otp-provider.js',
        'https://verify.phone91.com/otp-provider.js'
      ]);
    `
  }}
/>
```

> ⚠️ The widget is **not initialized** here. `window.initSendOTP(config)` is called from
> the component at the moment the user is about to request an OTP, because the config
> includes the mobile number (identifier) and the callback functions.

### §5.2 — `src/components/customer/VerifyForm.tsx`

**`handleSendOtp()` — replaces the fetch to `/api/customer/send-otp`:**

```
1. Validate mobile locally (same regex, unchanged).
2. POST /api/customer/send-otp { mobile, draftId, deviceVisitorId, purpose }
   → This runs rate-limit checks and creates OtpVerification row.
   → If 4xx/5xx → show error and return (same behaviour as before).
3. On 200 OK → call window.initSendOTP({ widgetId, identifier: "91"+mobile, exposeMethods: true, ... })
   → MSG91 widget sends the SMS.
4. Advance to VERIFY_AND_PIN step (same as before).
```

**`handleCombinedSubmit()` — replaces the fetch to `/api/customer/verify-otp` with raw OTP:**

```
1. Call window.verifyOTP(otp) → returns a Promise.
2. On success → get widgetToken from the callback data.
3. POST /api/customer/verify-otp { mobile, widgetToken, purpose }
   → Backend calls MSG91 to validate token, marks OtpVerification consumed.
4. Remainder of flow (set-pin, onSuccess) — UNCHANGED.
```

**State changes:**
- Add `widgetToken` state (`string`, default `""`).
- The `otp` state remains — user still types their 6-digit code into our existing OTP input.
- No design changes to the JSX.

**Important detail — widget callback wiring:**
`window.verifyOTP()` is asynchronous and uses callbacks, not Promises. We wrap it in a Promise:

```typescript
function callWidgetVerify(otp: string): Promise<string> {
  return new Promise((resolve, reject) => {
    window.initSendOTP({
      widgetId: process.env.NEXT_PUBLIC_MSG91_WIDGET_ID,
      tokenAuth: "", // not used for server verification
      exposeMethods: true,
      success: (data: { message: string }) => resolve(data.message), // JWT token
      failure: (error: unknown) => reject(error),
    });
    window.verifyOTP(otp);
  });
}
```

> Note: `NEXT_PUBLIC_MSG91_WIDGET_ID` must be added to `.env` (public env var, safe to expose
> — it is also embedded in the widget JS itself).

### §5.3 — `src/components/customer/LoginForm.tsx` (Forgot PIN flow)

Same pattern as §5.2 — `handleForgotPinSendOtp` and `handleForgotPinVerifyOtp` updated
to use widget send/verify. No design changes.

### §5.4 — `src/app/(auth)/staff-login/page.tsx` (Staff/Admin Reset Password OTP)

Same pattern — `handleSendResetOtp` and `handleVerifyResetOtp` updated. No design changes.

---

## §6 — New Environment Variables

### `.env` diff

```diff
- MSG91_OTP_TEMPLATE_ID="3668766a3065313831393738"
+ MSG91_WIDGET_ID="3668766a3065313831393738"
+ NEXT_PUBLIC_MSG91_WIDGET_ID="3668766a3065313831393738"
```

`NEXT_PUBLIC_MSG91_WIDGET_ID` is needed so the frontend component can read it without a
server round-trip. It is safe to expose — the widget ID is already embedded in the
`otp-provider.js` response and visible in every client browser session.

### `.env.example` diff

```diff
- MSG91_OTP_TEMPLATE_ID="your_msg91_otp_template_id_here"
+ MSG91_WIDGET_ID="your_msg91_widget_id_here"
+ NEXT_PUBLIC_MSG91_WIDGET_ID="your_msg91_widget_id_here"
  # (same value as MSG91_WIDGET_ID — both are the widget ID from MSG91 dashboard → OTP → Widgets)
```

---

## §7 — TypeScript: Window Type Extension

The MSG91 Widget SDK attaches methods to `window`. TypeScript does not know about them.
Add a global type declaration:

```typescript
// src/types/msg91-widget.d.ts  [NEW FILE]
declare global {
  interface Window {
    initSendOTP: (config: Msg91WidgetConfig) => void;
    sendOTP: () => void;
    verifyOTP: (otp: string) => void;
    retryOTP: () => void;
  }

  interface Msg91WidgetConfig {
    widgetId: string;
    tokenAuth?: string;
    identifier?: string;
    exposeMethods?: boolean;
    success: (data: { message: string }) => void;
    failure: (error: unknown) => void;
  }
}
export {};
```

---

## §8 — Sequence Diagrams

### Customer Registration / Forgot PIN OTP

```
Browser (VerifyForm)         Backend (Next.js)          MSG91
      │                            │                       │
      │  POST /api/customer/       │                       │
      │  send-otp                  │                       │
      │ ─────────────────────────► │                       │
      │                            │ (rate-limit check)    │
      │                            │ (DB: create OtpRow)   │
      │  { otpSent: true }         │                       │
      │ ◄───────────────────────── │                       │
      │                            │                       │
      │  window.sendOTP()          │                       │
      │ ──────────────────────────────────────────────────►│
      │                            │  (MSG91 Widget sends SMS)
      │                            │                       │
      │  [User reads SMS, types OTP in our input]          │
      │                            │                       │
      │  window.verifyOTP(otp)     │                       │
      │ ──────────────────────────────────────────────────►│
      │                            │ (MSG91 verifies OTP)  │
      │  success({ message: JWT }) │                       │
      │ ◄──────────────────────────────────────────────────│
      │                            │                       │
      │  POST /api/customer/       │                       │
      │  verify-otp                │                       │
      │  { mobile, widgetToken,    │                       │
      │    purpose }               │                       │
      │ ─────────────────────────► │                       │
      │                            │  POST /api/v5/widget/ │
      │                            │  verifyAccessToken    │
      │                            │ ─────────────────────►│
      │                            │  { mobile, type:      │
      │                            │    "success" }        │
      │                            │ ◄─────────────────────│
      │                            │ (DB: consume OtpRow)  │
      │  { preAuthToken }          │                       │
      │ ◄───────────────────────── │                       │
```

### Staff / Admin OTP (Reset Password flow)

Identical to the above diagram, replacing frontend component
(`staff-login/page.tsx`) and backend routes (`/api/staff/otp/send`, `/api/staff/otp/verify`).

---

## §9 — What Does NOT Change

The following are explicitly out of scope and will not be touched:

| Component | Reason |
|---|---|
| Prisma schema | No column change needed; `providerRef` already nullable |
| DB migration | No migration needed (providerRef is already nullable from previous migration) |
| PIN login flow | Uses `POST /api/customer/login-pin` — no OTP involved |
| Staff password login | Uses `POST /api/staff/login-password` — no OTP involved |
| `set-pin` / `change-password` routes | Not OTP-gated |
| RBAC / session / JWT | Untouched |
| Rate limiting logic | Unchanged — still runs in `send-otp` backend |
| Device fingerprint logic | Unchanged |
| 5-minute OTP expiry in DB | Unchanged — `OtpVerification.expiresAtUtc` still enforced |
| Resend cooldown (60s) | Unchanged — still enforced by backend rate limiter |
| UI / CSS / design | No visual changes to any component |
| `RegisterForm.tsx` | Does not call OTP endpoints directly |
| `AuthOverlay.tsx` | Not changed |
| `src/proxy.ts` | Not changed |

---

## §10 — Test Matrix

After implementation, verify each of the following before deploying to production:

### 10.1 Customer Registration OTP
- [ ] Enter valid 10-digit mobile → click "Send Verification OTP" → SMS arrives
- [ ] Rate limit: click Send OTP 4+ times in 60s → 429 with waitSeconds returned
- [ ] Enter correct OTP → continue to PIN setup → account created
- [ ] Enter wrong OTP → error shown, no crash
- [ ] Resend OTP (after 60s cooldown) → new SMS arrives, old one invalidated
- [ ] Let OTP expire (5 min) → verify returns 404 / "No active OTP" error

### 10.2 Forgot PIN (Customer)
- [ ] Unregistered mobile → send-otp returns enumeration-safe response (no error revealed)
- [ ] Registered mobile → SMS arrives → correct OTP → PIN reset page
- [ ] Wrong OTP → error shown

### 10.3 Staff / Admin Reset Password
- [ ] Staff mobile → send OTP → SMS arrives
- [ ] Correct OTP → set password page
- [ ] Wrong OTP → error shown

### 10.4 Security checks
- [ ] Replay: use same widgetToken twice → second call returns 404 (OtpRow consumed)
- [ ] Tampered widgetToken → MSG91 returns error → backend returns 401/400
- [ ] Wrong mobile in body vs widget-verified mobile → backend rejects

---

## §11 — Implementation Checklist

- [ ] `.env` — rename `MSG91_OTP_TEMPLATE_ID` → `MSG91_WIDGET_ID` + add `NEXT_PUBLIC_MSG91_WIDGET_ID`
- [ ] `.env.example` — same rename
- [ ] `src/lib/msg91.ts` — replace `sendOtp`/`verifyOtp` with `verifyWidgetToken`
- [ ] `src/types/msg91-widget.d.ts` — new file with Window type declarations
- [ ] `src/app/layout.tsx` — add widget JS `<Script>` tag
- [ ] `src/app/api/customer/send-otp/route.ts` — remove MSG91 send call
- [ ] `src/app/api/customer/verify-otp/route.ts` — accept widgetToken, call verifyWidgetToken
- [ ] `src/app/api/customer/forgot-pin/send-otp/route.ts` — remove MSG91 send call
- [ ] `src/app/api/customer/forgot-pin/verify-otp/route.ts` — accept widgetToken
- [ ] `src/app/api/staff/otp/send/route.ts` — remove MSG91 send call
- [ ] `src/app/api/staff/otp/verify/route.ts` — accept widgetToken, call verifyWidgetToken
- [ ] `src/components/customer/VerifyForm.tsx` — wire widget send/verify
- [ ] `src/components/customer/LoginForm.tsx` — wire widget send/verify (forgot-pin)
- [ ] `src/app/(auth)/staff-login/page.tsx` — wire widget send/verify
- [ ] `npx tsc --noEmit` — 0 errors
- [ ] Full test matrix (§10) passed in staging before production deploy
