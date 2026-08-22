// src/lib/msg91-widget-client.ts
// Trigger Vercel build deployment

/**
 * Client-side helper for MSG91 OTP Widget (No-DLT path).
 *
 * Wraps window.initSendOTP, window.sendOTP / window.sendOtp, and
 * window.verifyOTP / window.verifyOtp in Promises that settle on MSG91's
 * actual success/failure callbacks.
 *
 * FIX (this revision): previously, sendOtp()/verifyOtp() were looked up on
 * `window` in the same synchronous tick as calling initSendOTP(config). MSG91's
 * widget does asynchronous setup as part of initSendOTP (it fetches the
 * widget's channel/template configuration from MSG91's servers — the same
 * reason its own getWidgetData() method describes its result as "obtained
 * from the API"), so the exposed methods are not guaranteed to exist yet at
 * that point. We now POLL for the method to actually appear on `window`
 * before calling it, instead of assuming it's there instantly.
 */

const WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || "";
// Widget-specific token (Dashboard -> OTP Widget -> widget -> Token tab). Optional —
// leave NEXT_PUBLIC_MSG91_TOKEN_AUTH unset until you've generated one for this widget.
// This must NEVER be the account's server MSG91_AUTH_KEY.
const TOKEN_AUTH =
  process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH ||
  "563057TjOaNGa2LwM6a89d75aP1";

const SCRIPT_LOAD_TIMEOUT_MS = 4000;
const METHOD_EXPOSE_TIMEOUT_MS = 6000;
const SEND_CALLBACK_TIMEOUT_MS = 8000;

function log(...args: unknown[]) {
  // Single tag makes these greppable/filterable in devtools during live testing.
  console.log("[MSG91 WIDGET]", ...args);
}

function buildBaseConfig(
  intlMobile: string,
  success: (data: unknown) => void,
  failure: (error: unknown) => void
): Msg91WidgetConfig {
  const config: Msg91WidgetConfig = {
    widgetId: WIDGET_ID,
    tokenAuth: TOKEN_AUTH,
    identifier: intlMobile,
    exposeMethods: true,
    success,
    failure,
  };
  return config;
}

function buildVerifyConfig(
  success: (data: unknown) => void,
  failure: (error: unknown) => void
): Msg91WidgetConfig {
  const config: Msg91WidgetConfig = {
    widgetId: WIDGET_ID,
    tokenAuth: TOKEN_AUTH,
    exposeMethods: true,
    success,
    failure,
  };
  return config;
}

/**
 * Waits up to SCRIPT_LOAD_TIMEOUT_MS for MSG91's otp-provider.js to load and
 * define window.initSendOTP.
 */
async function waitForWidgetScript(): Promise<void> {
  if (typeof window === "undefined") return;
  if (typeof window.initSendOTP === "function") {
    log("initSendOTP already present on window.");
    return;
  }

  const start = Date.now();
  while (Date.now() - start < SCRIPT_LOAD_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 100));
    if (typeof window.initSendOTP === "function") {
      log(`initSendOTP appeared after ${Date.now() - start}ms.`);
      return;
    }
  }

  throw new Error(
    "MSG91 OTP Widget script failed to load. Please check your connection (or disable ad-blockers) and refresh the page."
  );
}

/**
 * Waits up to METHOD_EXPOSE_TIMEOUT_MS for a specific widget method
 * (sendOtp/sendOTP or verifyOtp/verifyOTP) to be attached to `window` after
 * initSendOTP(config) was called. This is the piece that was missing before —
 * initSendOTP does async setup and does not expose its methods instantly.
 */
async function waitForExposedMethod(
  getter: () => unknown,
  label: string
): Promise<(...args: any[]) => void> {
  const immediate = getter();
  if (typeof immediate === "function") {
    log(`${label} already present immediately after initSendOTP.`);
    return immediate as (...args: any[]) => void;
  }

  const start = Date.now();
  while (Date.now() - start < METHOD_EXPOSE_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, 100));
    const fn = getter();
    if (typeof fn === "function") {
      log(`${label} appeared ${Date.now() - start}ms after initSendOTP.`);
      return fn as (...args: any[]) => void;
    }
  }

  throw new Error(
    `MSG91 widget never exposed ${label} after ${METHOD_EXPOSE_TIMEOUT_MS}ms. ` +
      "This usually means the widget failed to initialize — check that NEXT_PUBLIC_MSG91_WIDGET_ID " +
      "is correct, the widget is Active (not a draft) in the MSG91 dashboard, and no ad-blocker is " +
      "blocking requests to verify.msg91.com / verify.phone91.com."
  );
}

/**
 * Triggers MSG91 Widget to send an OTP SMS to the given 10-digit Indian mobile number.
 *
 * Resolves when MSG91 confirms the send via its success callback, or when
 * SEND_CALLBACK_TIMEOUT_MS elapses with no callback at all (some widget
 * configurations only report success/failure on verify()). Rejects immediately
 * if MSG91's failure callback fires, or if the widget never exposes sendOtp at
 * all within METHOD_EXPOSE_TIMEOUT_MS.
 */
export async function triggerWidgetSendOtp(mobile: string): Promise<void> {
  await waitForWidgetScript();

  if (!WIDGET_ID) {
    throw new Error("MSG91 widget is not configured (missing NEXT_PUBLIC_MSG91_WIDGET_ID).");
  }

  const intlMobile = mobile.startsWith("91") ? mobile : `91${mobile}`;

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const config = buildBaseConfig(
      intlMobile,
      (data) => {
        if (settled) return;
        settled = true;
        log("SEND SUCCESS", data);
        resolve();
      },
      (error) => {
        if (settled) return;
        settled = true;
        log("SEND FAILURE", error);
        const msg =
          typeof error === "string"
            ? error
            : (error as { message?: string })?.message || "Could not send OTP. Please try again.";
        reject(new Error(msg));
      }
    );

    // If sendOTP / sendOtp is already exposed on window (e.g. Resend button click),
    // call existingSendFn directly without re-running initSendOTP.
    const existingSendFn = window.sendOTP || window.sendOtp;
    if (typeof existingSendFn === "function") {
      log("sendOtp already present on window — calling existingSendFn directly.");
      try {
        existingSendFn(intlMobile);
      } catch (err) {
        if (!settled) {
          settled = true;
          reject(err instanceof Error ? err : new Error("MSG91 sendOTP call failed."));
        }
        return;
      }
      setTimeout(() => {
        if (!settled) {
          settled = true;
          log("No success/failure callback within timeout — proceeding optimistically.");
          resolve();
        }
      }, SEND_CALLBACK_TIMEOUT_MS);
      return;
    }

    // Initial send: initSendOTP sends the OTP automatically when identifier is supplied in config.
    // Do NOT call sendFn() again after initSendOTP, as that causes duplicate send calls.
    log("Calling initSendOTP for initial send, widgetId:", WIDGET_ID, "identifier:", intlMobile);
    window.initSendOTP(config);

    waitForExposedMethod(() => window.sendOTP || window.sendOtp, "sendOtp")
      .then(() => {
        // initSendOTP already initiated sending. Set timeout fallback for callbacks.
        setTimeout(() => {
          if (!settled) {
            settled = true;
            log("No success/failure callback within timeout — proceeding optimistically.");
            resolve();
          }
        }, SEND_CALLBACK_TIMEOUT_MS);
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
  });
}

/**
 * Submits the OTP code typed by the user to MSG91 Widget verifyOTP.
 * On success, resolves with the JWT access token string (data.message).
 * On failure, rejects with an Error.
 */
export async function triggerWidgetVerifyOtp(mobile: string, otp: string): Promise<string> {
  await waitForWidgetScript();

  if (!WIDGET_ID) {
    throw new Error("MSG91 widget is not configured (missing NEXT_PUBLIC_MSG91_WIDGET_ID).");
  }

  const intlMobile = mobile.startsWith("91") ? mobile : `91${mobile}`;

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    const config = buildVerifyConfig(
      (data) => {
        if (settled) return;
        settled = true;
        const message = (data as { message?: string })?.message;
        log("VERIFY SUCCESS", data);
        if (message) {
          resolve(message);
        } else {
          reject(new Error("Widget verification succeeded but no access token was returned."));
        }
      },
      (error) => {
        if (settled) return;
        settled = true;
        log("VERIFY FAILURE", error);
        const msg =
          typeof error === "string"
            ? error
            : (error as { message?: string })?.message || "Incorrect OTP. Please check and try again.";
        reject(new Error(msg));
      }
    );

    log("Calling initSendOTP to bind verification callbacks, widgetId:", WIDGET_ID);
    window.initSendOTP(config);

    const existingVerifyFn = window.verifyOTP || window.verifyOtp;
    if (typeof existingVerifyFn === "function") {
      log("verifyOtp present on window — executing verifyFn directly.");
      try {
        existingVerifyFn(otp);
      } catch (err) {
        if (!settled) {
          settled = true;
          reject(err instanceof Error ? err : new Error("OTP verification call failed."));
        }
      }
      return;
    }

    waitForExposedMethod(() => window.verifyOTP || window.verifyOtp, "verifyOtp")
      .then((verifyFn) => {
        if (settled) return;
        verifyFn(otp);
      })
      .catch((err) => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      });
  });
}
