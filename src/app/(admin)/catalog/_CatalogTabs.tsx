"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UtensilsCrossed, Package, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/catalog/products", label: "Products", icon: UtensilsCrossed },
  { href: "/catalog/thalis", label: "Thalis", icon: Package },
  { href: "/catalog/categories", label: "Categories", icon: Tags },
];

export default function CatalogTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
      {tabs.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
              isActive ? "bg-white text-gray-900 shadow-sm font-bold" : "text-gray-500 hover:text-gray-700"
            )}
          >
            <Icon size={15} />
            <span>{label}</span>
          </Link>
        );
      })}
    </div>
  );
}
