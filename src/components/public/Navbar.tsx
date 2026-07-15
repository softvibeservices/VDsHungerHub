"use client";

import { useState } from "react";
import Link from "next/link";
import { UtensilsCrossed, Menu, X } from "lucide-react";
import Button from "@/components/ui/Button";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-sm md:text-base leading-tight">
            VD&apos;s Hunger Hub
          </span>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <a href="#how-it-works" className="hover:text-orange-600 transition-colors">How It Works</a>
          <a href="#offerings" className="hover:text-orange-600 transition-colors">Our Thalis</a>
          <a href="#why-us" className="hover:text-orange-600 transition-colors">Why Us</a>
        </nav>

        {/* Action Buttons — customer ordering only, no admin link here */}
        <div className="flex items-center gap-2">
          <Link href="/menu">
            <Button variant="primary" size="md">
              Order Now
            </Button>
          </Link>

          {/* Mobile hamburger menu */}
          <button
            className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Panel */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3 shadow-inner">
          <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-orange-600 py-1 transition-colors">
            How It Works
          </a>
          <a href="#offerings" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-orange-600 py-1 transition-colors">
            Our Thalis
          </a>
          <a href="#why-us" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-orange-600 py-1 transition-colors">
            Why Us
          </a>
          <div className="pt-2 border-t border-gray-100">
            <Link href="/menu" className="block" onClick={() => setMobileOpen(false)}>
              <Button variant="primary" size="md" className="w-full">
                Order Now
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
