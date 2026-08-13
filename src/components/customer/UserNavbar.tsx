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
  const pathname = usePathname();

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
          ? "text-[#1B2D5A] bg-[#1B2D5A]/10"
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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#1B2D5A]/10 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
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
          <nav className="hidden md:flex items-center gap-1">
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
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
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
  );
}
