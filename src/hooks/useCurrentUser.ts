"use client";
import { useEffect, useState } from "react";
import type { TokenPayload } from "@/lib/auth";

export function useCurrentUser(): TokenPayload | null {
  const [user, setUser] = useState<TokenPayload | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data.user ?? null))
      .catch(() => setUser(null));
  }, []);

  return user;
}
