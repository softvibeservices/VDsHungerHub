// src/lib/msg91-widget-client.ts

/**
 * Client-side helper for MSG91 OTP Widget (No-DLT path).
 *
 * Wraps window.initSendOTP, window.sendOTP, and window.verifyOTP in Promises.
 */

const WIDGET_ID = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || "3668766a3065313831393738";

/**
 * Waits up to 4 seconds for MSG91's otp-provider.js to load on the window.
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
    identifier: intlMobile,
    exposeMethods: true,
    success: () => {},
    failure: () => {},
  });

  if (typeof window.sendOTP === "function") {
    window.sendOTP();
  } else {
    throw new Error("MSG91 sendOTP method unavailable.");
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
      identifier: intlMobile,
      exposeMethods: true,
      success: (data: { message: string }) => {
        if (settled) return;
        settled = true;
        if (data?.message) {
          resolve(data.message);
        } else {
          reject(new Error("Widget verification succeeded but no access token was returned."));
        }
      },
      failure: (error: unknown) => {
        if (settled) return;
        settled = true;
        const msg = typeof error === "string" ? error : (error as any)?.message || "Incorrect OTP. Please check and try again.";
        reject(new Error(msg));
      },
    });

    if (typeof window.verifyOTP === "function") {
      window.verifyOTP(otp);
    } else {
      reject(new Error("MSG91 verifyOTP method unavailable."));
    }
  });
}
