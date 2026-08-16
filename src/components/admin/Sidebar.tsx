// src\components\admin\Sidebar.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Settings,
  UserCheck,
  Wallet,
  Menu,
  UserCog,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/hooks/useToast";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
  roles: ("ADMIN" | "STAFF")[];
  /** If set, a STAFF user additionally needs this permission to see the item (ADMIN always passes). */
  permission?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: "Today",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", roles: ["ADMIN", "STAFF"] },
      { href: "/daily-menu", icon: CalendarDays, label: "Daily Menu", roles: ["ADMIN", "STAFF"] },
      { href: "/orders", icon: ShoppingBag, label: "Orders", roles: ["ADMIN", "STAFF"] },
    ],
  },
  {
    label: "Catalog & Planning",
    items: [
      { href: "/catalog/products", icon: ShoppingBasket, label: "Catalog", roles: ["ADMIN", "STAFF"] },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/companies", icon: Building2, label: "Companies", roles: ["ADMIN", "STAFF"], permission: "companies:moderate" },
      { href: "/users", icon: Users, label: "Users", roles: ["ADMIN", "STAFF"], permission: "users:moderate" },
      { href: "/staff", icon: UserCheck, label: "Staff", roles: ["ADMIN"] },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/credit", icon: Wallet, label: "Credit", roles: ["ADMIN"] },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/profile", icon: UserCog, label: "My Profile", roles: ["ADMIN", "STAFF"] },
    ],
  },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const currentUser = useCurrentUser();

  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleNavClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      onClose();
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      const res = await fetch("/api/staff/logout", { method: "POST" });
      if (!res.ok) throw new Error("Logout failed");

      toast.success("Signed out successfully");
      router.replace("/staff-login");
    } catch {
      toast.error("Failed to sign out. Please try again.");
    } finally {
      setLoggingOut(false);
      setLogoutConfirmOpen(false);
    }
  };

  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "VD";

  const panelLabel = currentUser?.role === "ADMIN" ? "Admin Panel" : "Staff Panel";

  return (
    <>
      <aside
        className={cn(
          "fixed top-0 left-0 bottom-0 z-30 w-[260px] bg-gray-900 border-r border-gray-800 flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header — Brand logo + title */}
        <div className="h-16 px-4 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/vita-Logo.png"
              alt="ViTa Cuisine Logo"
              width={36}
              height={36}
              className="rounded-xl shrink-0 object-contain"
              priority
            />
            <div>
              <p className="font-extrabold text-white text-sm tracking-tight flex items-center gap-1 leading-tight">
                ViTa <span className="text-orange-500 font-black">Cuisine</span>
              </p>
              <p className="text-gray-400 text-[10px] font-semibold tracking-widest uppercase">{panelLabel}</p>
            </div>
          </div>
          {/* Mobile-only Close Button */}
          <button
            onClick={onClose}
            className="lg:hidden text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
            title="Close Sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {navSections.map((section) => {
            const visibleItems = currentUser
              ? section.items.filter((item) => {
                  if (!(item.roles as string[]).includes(currentUser.role)) return false;
                  if (item.permission && currentUser.role !== "ADMIN") {
                    return Array.isArray(currentUser.permissions) && currentUser.permissions.includes(item.permission);
                  }
                  return true;
                })
              : section.items;
            if (visibleItems.length === 0) return null;
            return (
              <div key={section.label}>
                <p className="px-3 pb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  {section.label}
                </p>
                <div className="space-y-1">
                  {visibleItems.map(({ href, icon: Icon, label }) => {
                    const isActive = pathname === href || (href !== "/catalog/products" && pathname.startsWith(href + "/")) || (href === "/catalog/products" && pathname.startsWith("/catalog"));
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={handleNavClick}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150",
                          isActive
                            ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                            : "text-gray-400 hover:text-gray-100 hover:bg-gray-800"
                        )}
                      >
                        <Icon size={18} className={isActive ? "text-orange-400" : "text-gray-400"} />
                        <span>{label}</span>
                        {isActive && (
                          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer — User info + logout */}
        <div className="px-4 py-4 border-t border-gray-800">
          <Link
            href="/profile"
            onClick={handleNavClick}
            className="flex items-center gap-3 mb-3 p-1.5 rounded-xl hover:bg-gray-800 transition-colors cursor-pointer group"
            title="View Profile"
          >
            <div className="w-8 h-8 rounded-full bg-orange-500 group-hover:bg-orange-600 flex items-center justify-center text-white text-xs font-bold shrink-0 transition-colors">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-200 group-hover:text-white text-xs font-semibold truncate transition-colors">
                {currentUser?.name ?? "Loading..."}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                <span className="text-gray-400 text-xs truncate font-medium">
                  {currentUser?.role === "ADMIN" ? "Admin" : currentUser?.role === "STAFF" ? "Staff" : ""}
                </span>
              </div>
            </div>
          </Link>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all duration-150 cursor-pointer"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        onConfirm={handleLogout}
        title="Sign out"
        message="Are you sure you want to sign out?"
        confirmLabel="Sign Out"
        isLoading={loggingOut}
      />
    </>
  );
}
