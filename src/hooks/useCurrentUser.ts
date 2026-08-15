// src\hooks\useCurrentUser.ts

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { TokenPayload } from "@/lib/auth";

const POLL_INTERVAL_MS = 20_000;

export function useCurrentUser(): TokenPayload | null {
  const [user, setUser] = useState<TokenPayload | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/staff/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      // Network hiccup — keep showing the last-known user rather than
      // flashing to null; the next successful poll will correct it.
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return user;
}

/**
 * Same as useCurrentUser() but also exposes a manual refresh trigger and a
 * "wasJustRevoked" style callback hook point. Currently just re-exports
 * refresh for callers (e.g. (admin)/layout.tsx) that want to react
 * immediately to a change rather than just re-render.
 */
export function useCurrentUserWithRefresh(): [TokenPayload | null, () => Promise<void>] {
  const [user, setUser] = useState<TokenPayload | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/staff/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      // keep last-known state
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return [user, refresh];
}
