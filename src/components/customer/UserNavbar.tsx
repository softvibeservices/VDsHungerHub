"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UtensilsCrossed, Menu, X, LogOut, ClipboardList, ShoppingBag } from "lucide-react";
import { useAuthModal } from "@/context/AuthModalContext";

interface Props {
  loggedIn: boolean;
  userName: string | null;
}

export default function UserNavbar({ loggedIn, userName }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { openAuth } = useAuthModal();

  const handleLogout = async () => {
    await fetch("/api/customer/logout", { method: "POST" });
    window.location.href = "/menu";
  };

  const navLink = (href: string, label: string, icon: React.ReactNode) => (
    <Link
      href={href}
      onClick={() => setMobileOpen(false)}
      aria-current={pathname === href ? "page" : undefined}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
        pathname === href
          ? "text-orange-600 bg-orange-50"
          : "text-gray-600 hover:text-orange-600 hover:bg-orange-50/60"
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        <Link href={loggedIn ? "/menu" : "/"} className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm md:text-base leading-tight truncate">
            VD&apos;s Hunger Hub
          </span>
        </Link>

        {loggedIn ? (
          <nav className="hidden md:flex items-center gap-1">
            {navLink("/menu", "Order", <ShoppingBag size={16} />)}
            {navLink("/menu/orders", "My Orders", <ClipboardList size={16} />)}
          </nav>
        ) : (
          <nav className="hidden md:flex items-center gap-4">
            <button
              onClick={() => openAuth("register")}
              className="text-sm font-semibold text-gray-600 hover:text-orange-600 transition-colors cursor-pointer"
            >
              Register
            </button>
            <button
              onClick={() => openAuth("login")}
              className="text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors cursor-pointer"
            >
              Login
            </button>
            <button
              onClick={() => openAuth("verify")}
              className="text-sm font-semibold text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              Verify Mobile
            </button>
          </nav>
        )}

        <div className="flex items-center gap-2">
          {loggedIn && (
            <>
              {userName && (
                <span className="hidden md:block text-sm text-gray-500 truncate max-w-[10rem]">
                  {userName}
                </span>
              )}
              <button
                onClick={handleLogout}
                aria-label="Log out"
                className="hidden md:flex p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
              >
                <LogOut size={16} />
              </button>
            </>
          )}

          <button
            className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-1 shadow-inner">
          {loggedIn ? (
            <>
              {userName && (
                <p className="px-3 pb-2 text-sm text-gray-500 border-b border-gray-100 mb-2">
                  Signed in as <strong className="text-gray-800">{userName}</strong>
                </p>
              )}
              {navLink("/menu", "Order", <ShoppingBag size={16} />)}
              {navLink("/menu/orders", "My Orders", <ClipboardList size={16} />)}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={16} />
                Log out
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 p-2">
              <button
                onClick={() => {
                  setMobileOpen(false);
                  openAuth("register");
                }}
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-center text-sm cursor-pointer"
              >
                Register
              </button>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  openAuth("login");
                }}
                className="w-full py-2.5 border border-orange-200 text-orange-600 hover:bg-orange-50 font-bold rounded-xl text-center text-sm cursor-pointer"
              >
                Login
              </button>
              <button
                onClick={() => {
                  setMobileOpen(false);
                  openAuth("verify");
                }}
                className="w-full py-2 text-gray-400 hover:text-gray-600 text-center text-xs font-semibold mt-1 cursor-pointer"
              >
                Verify Mobile / Resume
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
