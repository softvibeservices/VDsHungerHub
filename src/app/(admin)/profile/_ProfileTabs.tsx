// src\app\(admin)\profile\_ProfileTabs.tsx

"use client";

import { usePathname, useRouter } from "next/navigation";
import { KeyRound, Settings, Wallet } from "lucide-react";
import Tabs from "@/components/ui/Tabs";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function ProfileTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = useCurrentUser();

  const tabs = [
    { href: "/profile/password", label: "Password", icon: KeyRound },
    { href: "/profile/meal-cutoff", label: "Order Cutoff Times", icon: Settings },
    ...(currentUser?.role === "ADMIN"
      ? [{ href: "/profile/credit-limits", label: "Credit Limits", icon: Wallet }]
      : []),
  ];

  const active = tabs.find((t) => t.href === pathname)?.href ?? tabs[0].href;

  return (
    <Tabs
      variant="pill"
      value={active}
      onChange={(href) => router.push(href)}
      items={tabs.map((t) => ({ value: t.href, label: t.label, icon: t.icon }))}
    />
  );
}
