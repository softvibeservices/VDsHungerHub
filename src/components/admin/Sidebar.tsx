"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  ShoppingBasket,
  CalendarDays,
  ShoppingBag,
  LogOut,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const allNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["ADMIN", "STAFF"] },
  { href: "/orders", icon: ShoppingBag, label: "Orders", roles: ["ADMIN", "STAFF"] },
  { href: "/companies", icon: Building2, label: "Companies", roles: ["ADMIN"] },
  { href: "/users", icon: Users, label: "Users", roles: ["ADMIN"] },
  { href: "/catalog", icon: ShoppingBasket, label: "Catalog", roles: ["ADMIN", "STAFF"] },
  { href: "/daily-menu", icon: CalendarDays, label: "Daily Menu", roles: ["ADMIN", "STAFF"] },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useCurrentUser();

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to sign out?")) {
      return;
    }
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out successfully");
      router.push("/login");
    } catch {
      toast.error("Logout failed");
    }
  };

  // Filter nav items based on role (show all while loading so there's no flash)
  const navItems = currentUser
    ? allNavItems.filter((item) => item.roles.includes(currentUser.role))
    : allNavItems;

  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "VD";

  const panelLabel =
    currentUser?.role === "ADMIN"
      ? "Admin Panel"
      : currentUser?.role === "STAFF"
      ? "Staff Panel"
      : "Panel";

  return (
    <aside
      className={`
        fixed top-0 left-0 z-30 h-full w-[260px] bg-gray-900 flex flex-col
        transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0
      `}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-lg">
            🍱
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">
              VD&apos;s Hunger Hub
            </p>
            <p className="text-gray-400 text-xs">{panelLabel}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                  ${
                    isActive
                      ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                      : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                  }
                `}
              >
                <Icon
                  size={18}
                  className={isActive ? "text-orange-400" : "text-gray-400"}
                />
                {label}
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer — User info + logout */}
      <div className="px-4 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-200 text-xs font-semibold truncate">
              {currentUser?.name ?? "Loading..."}
            </p>
            <p className="text-gray-500 text-xs truncate">
              {currentUser?.role === "ADMIN" ? "🔑 Admin" : currentUser?.role === "STAFF" ? "👤 Staff" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all duration-150"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
