// src\components\customer\UserNavbar.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, ClipboardList, ShoppingBag } from "lucide-react";

interface Props {
  loggedIn: boolean;
  userName: string | null;
}

export default function UserNavbar({ loggedIn, userName }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/customer/logout", { method: "POST" });
      window.location.href = "/menu";
    } catch {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const navLink = (href: string, label: string, icon: React.ReactNode) => (
    <Link
      href={href}
      onClick={() => setMobileOpen(false)}
      aria-current={pathname === href ? "page" : undefined}
      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors ${
        pathname === href
          ? "text-[#1B2D5A] bg-[#1B2D5A]/10 font-bold"
          : "text-gray-600 hover:text-[#1B2D5A] hover:bg-[#1B2D5A]/5"
      }`}
    >
      {icon}
      {label}
    </Link>
  );

  const guestLinkClass = (href: string) =>
    `text-sm font-semibold transition-colors cursor-pointer ${
      pathname === href
        ? "text-[#1B2D5A]"
        : "text-gray-600 hover:text-[#1B2D5A]"
    }`;

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#1B2D5A]/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href={loggedIn ? "/menu" : "/"} className="flex items-center gap-3 min-w-0">
            <Image
              src="/vita-Logo.png"
              alt="ViTa Cuisine"
              width={44}
              height={44}
              className="object-contain rounded-full flex-shrink-0"
              priority
            />
            <div className="hidden sm:block">
              <span className="font-extrabold text-[#1B2D5A] text-sm leading-tight block">
                ViTa Cuisine
              </span>
              <span className="text-[9px] text-[#C9A84C] font-bold tracking-widest uppercase">
                Think Food, Think Us
              </span>
            </div>
          </Link>

          {loggedIn ? (
            <nav className="hidden md:flex items-center gap-2">
              {navLink("/menu", "Order", <ShoppingBag size={16} />)}
              {navLink("/menu/orders", "My Orders", <ClipboardList size={16} />)}
            </nav>
          ) : (
            <nav className="hidden md:flex items-center gap-4">
              <Link href="/register" className={guestLinkClass("/register")}>
                Register
              </Link>
              <Link href="/login" className={guestLinkClass("/login")}>
                Login
              </Link>
              <Link href="/verify" className={guestLinkClass("/verify")}>
                Verify Mobile
              </Link>
            </nav>
          )}

          <div className="flex items-center gap-3">
            {loggedIn && (
              <>
                {userName && (
                  <span className="hidden md:block text-sm text-gray-600 font-semibold truncate max-w-[12rem]">
                    {userName}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(true)}
                  aria-label="Log out"
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100 cursor-pointer"
                >
                  <LogOut size={15} />
                  <span>Logout</span>
                </button>
              </>
            )}

            <button
              className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-[#1B2D5A] transition-colors"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white/98 backdrop-blur-md px-4 py-4 space-y-1 shadow-lg">
            {loggedIn ? (
              <>
                {userName && (
                  <p className="px-3 pb-2 text-sm text-gray-500 border-b border-gray-100 mb-2">
                    Signed in as <strong className="text-[#1B2D5A]">{userName}</strong>
                  </p>
                )}
                {navLink("/menu", "Order", <ShoppingBag size={16} />)}
                {navLink("/menu/orders", "My Orders", <ClipboardList size={16} />)}
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    setShowLogoutConfirm(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={16} />
                  Log out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 p-2">
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className={`w-full py-2.5 text-center text-sm font-bold rounded-xl ${
                    pathname === "/register"
                      ? "bg-[#1B2D5A] text-white shadow-md"
                      : "bg-[#1B2D5A] hover:bg-[#243a73] text-white"
                  }`}
                >
                  Register
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className={`w-full py-2.5 text-center text-sm font-bold rounded-xl border ${
                    pathname === "/login"
                      ? "bg-[#1B2D5A]/10 border-[#1B2D5A] text-[#1B2D5A]"
                      : "border-[#1B2D5A]/30 text-[#1B2D5A] hover:bg-[#1B2D5A]/5"
                  }`}
                >
                  Login
                </Link>
                <Link
                  href="/verify"
                  onClick={() => setMobileOpen(false)}
                  className={`w-full py-2 text-center text-xs font-semibold mt-1 ${
                    pathname === "/verify"
                      ? "text-[#C9A84C] underline font-bold"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  Verify Mobile / Resume
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => !loggingOut && setShowLogoutConfirm(false)}
          />
          <div className="relative z-10 w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-gray-100 text-center animate-scaleIn">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mx-auto">
              <LogOut size={26} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-extrabold text-gray-900">Confirm Logout</h3>
              <p className="text-xs text-gray-500">
                Are you sure you want to log out of your ViTa Cuisine account?
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={loggingOut}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loggingOut ? "Logging out..." : "Log Out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
