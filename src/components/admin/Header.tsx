"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const pageTitles: Record<string, { title: string; description?: string }> = {
  "/dashboard": { title: "Dashboard", description: "Overview of daily meal readiness and operational status" },
  "/companies": { title: "Companies", description: "Manage registered companies and verification status" },
  "/users": { title: "Users", description: "Manage customer accounts, verification, and access" },
  "/staff": { title: "Staff", description: "Manage staff accounts and permissions" },
  "/catalog": { title: "Catalog", description: "Manage products, thalis, and categories" },
  "/orders": { title: "Orders", description: "View and manage today's customer orders" },
  "/daily-menu": { title: "Daily Menu", description: "Set lunch and dinner menus for ordering" },
  "/credit": { title: "Credit", description: "Track customer balances, credit, and payments" },
  "/settings/meal-cutoff": { title: "Order Cutoff Times", description: "Configure when ordering opens and closes" },
  "/menu": { title: "Customer Menu" },
};

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname() ?? "";
  const currentUser = useCurrentUser();

  const page = Object.entries(pageTitles).find(([key]) => pathname.startsWith(key))?.[1] ?? {
    title: "Admin Panel",
  };

  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "VD";

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-4 sticky top-0 z-10 shadow-sm">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Page title and description */}
      <div className="flex-1">
        <h1 className="text-lg font-bold text-gray-900 leading-tight">{page.title}</h1>
        {page.description && (
          <p className="text-xs text-gray-500 hidden sm:block font-medium">{page.description}</p>
        )}
      </div>

      {/* Right side user avatar */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
          {initials}
        </div>
      </div>
    </header>
  );
}
