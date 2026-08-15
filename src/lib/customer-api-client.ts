// src\lib\customer-api-client.ts

/**
 * src/lib/customer-api-client.ts
 *
 * Thin authedFetch wrapper for all client-side /api/customer/* calls.
 *
 * If the first request returns a 401 (expired access token), it automatically:
 *   1. Calls POST /api/customer/refresh to silently rotate the token pair.
 *   2. Retries the original request once.
 *   3. If the refresh also fails, redirects to /login with a session-expired message.
 *
 * Usage:
 *   import { authedFetch } from "@/lib/customer-api-client";
 *   const res = await authedFetch("/api/customer/orders");
 */

export async function authedFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  // First attempt
  let res = await fetch(input, { ...init, credentials: "include" });

  if (res.status !== 401) {
    return res;
  }

  // Token expired — try silent refresh
  const refreshRes = await fetch("/api/customer/refresh", {
    method: "POST",
    credentials: "include",
  });

  if (!refreshRes.ok) {
    // Refresh token also expired/revoked — redirect to login
    if (typeof window !== "undefined") {
      window.location.href =
        "/login?reason=session_expired&message=" +
        encodeURIComponent("Your session expired. Please sign in again.");
    }
    return res; // return the 401 so callers can handle gracefully
  }

  // Retry once with the new access token (cookie was set by the refresh route)
  res = await fetch(input, { ...init, credentials: "include" });
  return res;
}
