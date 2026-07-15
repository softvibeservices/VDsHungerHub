"use client";

import FingerprintJS from "@fingerprintjs/fingerprintjs";

let agentPromise: ReturnType<typeof FingerprintJS.load> | null = null;

function getAgent() {
  if (!agentPromise) {
    agentPromise = FingerprintJS.load();
  }
  return agentPromise;
}

/**
 * Returns the FingerprintJS visitorId for this browser.
 * Falls back to a weaker locally-computed hash ONLY if the library fails
 * to load (e.g. blocked by an aggressive ad blocker) so auth flows never
 * hard-fail just because fingerprinting didn't run.
 */
export async function getDeviceVisitorId(): Promise<string> {
  try {
    const fp = await getAgent();
    const result = await fp.get();
    return result.visitorId;
  } catch (err) {
    console.warn("FingerprintJS failed to load, falling back to basic hash", err);
    const raw = [
      navigator.userAgent,
      screen.width.toString(),
      screen.height.toString(),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join("|");
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

/**
 * Call this once, early (e.g. in a top-level layout effect), so the
 * FingerprintJS agent is warm by the time a form actually needs it —
 * avoids a visible delay on the first OTP-send click.
 */
export function warmUpFingerprint() {
  void getAgent();
}
