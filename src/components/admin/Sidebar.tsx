"use client";

import { useState } from "react";
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
  Settings,
  UserCheck,
  Wallet,
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
      { href: "/companies", icon: Building2, label: "Companies", roles: ["ADMIN"] },
      { href: "/users", icon: Users, label: "Users", roles: ["ADMIN"] },
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
    label: "Settings",
    items: [
      { href: "/settings/meal-cutoff", icon: Settings, label: "Order Cutoff Times", roles: ["ADMIN", "STAFF"] },
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

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/staff/logout", { method: "POST" });
      toast.success("Logged out successfully");
      router.push("/staff-login");
    } catch {
      toast.error("Logout failed");
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

  const panelLabel =
    currentUser?.role === "ADMIN"
      ? "Admin Panel"
      : currentUser?.role === "STAFF"
      ? "Staff Panel"
      : "Panel";

  return (
    <>
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
            className="lg:hidden text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Grouped Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
          {navSections.map((section) => {
            const visibleItems = currentUser
              ? section.items.filter((item) => (item.roles as string[]).includes(currentUser.role))
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
                        onClick={onClose}
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
          <div className="flex items-center gap-3 mb-3 px-1">
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-200 text-xs font-semibold truncate">
                {currentUser?.name ?? "Loading..."}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                <span className="text-gray-400 text-xs truncate font-medium">
                  {currentUser?.role === "ADMIN" ? "Admin" : currentUser?.role === "STAFF" ? "Staff" : ""}
                </span>
              </div>
            </div>
          </div>
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
