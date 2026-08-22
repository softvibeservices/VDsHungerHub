// src/lib/msg91-widget-client.ts

/**
 * Client-side helper for MSG91 OTP Widget (No-DLT path).
 *
 * Wraps window.initSendOTP, window.sendOTP / window.sendOtp, and window.verifyOTP / window.verifyOtp in Promises.
 */

const WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || "3668766a3065313831393738";
const AUTH_KEY = process.env.NEXT_PUBLIC_MSG91_AUTH_KEY || "563057A6wYuosJ5R6a89764eP1";

/**
 * Waits up to 4 seconds for MSG91's otp-provider.js to load on the window object.
 */
async function waitForWidgetScript(): Promise<void> {
  if (typeof window === "undefined") return;
  if (typeof window.initSendOTP === "function") return;

  const start = Date.now();
  while (Date.now() - start < 4000) {
    await new Promise((r) => setTimeout(r, 100));
    if (typeof window.initSendOTP === "function") return;
  }

  throw new Error("MSG91 OTP Widget script loading timed out. Please refresh the page and try again.");
}

/**
 * Triggers MSG91 Widget to send an OTP SMS to the given 10-digit Indian mobile number.
 */
export async function triggerWidgetSendOtp(mobile: string): Promise<void> {
  await waitForWidgetScript();

  const intlMobile = mobile.startsWith("91") ? mobile : `91${mobile}`;

  window.initSendOTP({
    widgetId: WIDGET_ID,
    tokenAuth: AUTH_KEY,
    identifier: intlMobile,
    exposeMethods: true,
    success: (data: any) => {
      console.log("[MSG91 WIDGET SUCCESS]", data);
    },
    failure: (error: any) => {
      console.error("[MSG91 WIDGET FAILURE]", error);
    },
  });

  const sendFn = window.sendOTP || window.sendOtp;
  if (typeof sendFn === "function") {
    sendFn(intlMobile);
  } else {
    throw new Error("MSG91 sendOTP method unavailable on window object.");
  }
}

/**
 * Submits the OTP code typed by the user to MSG91 Widget verifyOTP.
 * On success, resolves with the JWT access token string (data.message).
 * On failure, rejects with an Error.
 */
export async function triggerWidgetVerifyOtp(mobile: string, otp: string): Promise<string> {
  await waitForWidgetScript();

  const intlMobile = mobile.startsWith("91") ? mobile : `91${mobile}`;

  return new Promise<string>((resolve, reject) => {
    let settled = false;

    window.initSendOTP({
      widgetId: WIDGET_ID,
      tokenAuth: AUTH_KEY,
      identifier: intlMobile,
      exposeMethods: true,
      success: (data: { message: string }) => {
        if (settled) return;
        settled = true;
        console.log("[MSG91 VERIFY SUCCESS]", data);
        if (data?.message) {
          resolve(data.message);
        } else {
          reject(new Error("Widget verification succeeded but no access token was returned."));
        }
      },
      failure: (error: unknown) => {
        if (settled) return;
        settled = true;
        console.error("[MSG91 VERIFY FAILURE]", error);
        const msg = typeof error === "string" ? error : (error as any)?.message || "Incorrect OTP. Please check and try again.";
        reject(new Error(msg));
      },
    });

    const verifyFn = window.verifyOTP || window.verifyOtp;
    if (typeof verifyFn === "function") {
      verifyFn(otp);
    } else {
      reject(new Error("MSG91 verifyOTP method unavailable on window object."));
    }
  });
}
