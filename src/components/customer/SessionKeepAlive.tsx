"use client";

import { useEffect } from "react";

/**
 * SessionKeepAlive
 *
 * Silently refreshes the customer access token every 10 minutes so users
 * never notice the 15-minute access token expiry. The refresh endpoint is
 * now correctly accessible (proxy.ts fix) — this component is the client
 * side that actually calls it.
 *
 * - Fires immediately on mount (catches any already-expired token)
 * - Repeats every 10 minutes
 * - Skips when the tab is hidden (pauses on backgrounded tabs)
 * - Never throws — all errors are silently swallowed so this never
 *   interferes with anything else on the page
 */
export default function SessionKeepAlive() {
  useEffect(() => {
    const doRefresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        await fetch("/api/customer/refresh", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // Silently ignore — network errors, no session, etc. are all fine
      }
    };

    // Refresh immediately on mount (catches expired access tokens on page load)
    doRefresh();

    // Repeat every 10 minutes (well inside the 15-minute access TTL)
    const interval = setInterval(doRefresh, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
