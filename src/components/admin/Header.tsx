"use client";

import { usePathname } from "next/navigation";
import { Menu, Bell } from "lucide-react";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/companies": "Companies",
  "/users": "Users",
  "/catalog": "Catalog",
  "/orders": "Orders",
  "/daily-menu": "Daily Menu",
  // /menu is the customer ordering page — shown if admin accidentally navigates there
  "/menu": "Customer Menu",
};

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname() ?? "";

  const title =
    Object.entries(pageTitles).find(([key]) => pathname.startsWith(key))?.[1] ??
    "Admin Panel";

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 md:px-6 gap-4 sticky top-0 z-10 shadow-sm">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1">
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-2">
        <button className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors relative">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
        </button>
        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
          VD
        </div>
      </div>
    </header>
  );
}
