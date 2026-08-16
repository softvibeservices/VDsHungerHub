// src/hooks/useCurrentUser.ts

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { TokenPayload } from "@/lib/auth";

const POLL_INTERVAL_MS = 30_000;

interface StaffUserContextValue {
  user: TokenPayload | null;
  refresh: () => Promise<void>;
  loading: boolean;
}

const StaffUserContext = createContext<StaffUserContextValue>({
  user: null,
  refresh: async () => {},
  loading: true,
});

export function StaffUserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<TokenPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const res = await fetch("/api/staff/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      // keep last-known user on hiccup
    } finally {
      inFlight.current = false;
      setLoading(false);
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

  return React.createElement(
    StaffUserContext.Provider,
    { value: { user, refresh, loading } },
    children
  );
}

/**
 * Hook to consume current staff user from single React Context
 */
export function useCurrentUser(): TokenPayload | null {
  const ctx = useContext(StaffUserContext);
  return ctx.user;
}

/**
 * Hook to consume current staff user + manual refresh function from React Context
 */
export function useCurrentUserWithRefresh(): [TokenPayload | null, () => Promise<void>] {
  const ctx = useContext(StaffUserContext);
  return [ctx.user, ctx.refresh];
}
