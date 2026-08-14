"use client";

import { usePathname, useRouter } from "next/navigation";
import { UtensilsCrossed, Package, Tags } from "lucide-react";
import Tabs from "@/components/ui/Tabs";

const tabs = [
  { href: "/catalog/products", label: "Products", icon: UtensilsCrossed },
  { href: "/catalog/thalis", label: "Thalis", icon: Package },
  { href: "/catalog/categories", label: "Categories", icon: Tags },
];

export default function CatalogTabs() {
  const router = useRouter();
  const pathname = usePathname();
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
