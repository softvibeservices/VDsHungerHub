// src\components\public\Navbar.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import Button from "@/components/ui/Button";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#1B2D5A]/10 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-18 flex items-center justify-between py-2">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/vita-Logo.png"
            alt="ViTa Cuisine Logo"
            width={52}
            height={52}
            className="object-contain rounded-full"
            priority
          />
          <div className="hidden sm:block">
            <span className="font-extrabold text-[#1B2D5A] text-lg leading-tight block">
              ViTa Cuisine
            </span>
            <span className="text-[10px] text-[#C9A84C] font-semibold tracking-widest uppercase">
              Think Food, Think Us
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="/#how-it-works" className="hover:text-[#1B2D5A] transition-colors relative group">
            How It Works
            <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-[#C9A84C] group-hover:w-full transition-all duration-300" />
          </a>
          <a href="/#thalis" className="hover:text-[#1B2D5A] transition-colors relative group">
            Thali Packages
            <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-[#C9A84C] group-hover:w-full transition-all duration-300" />
          </a>
          <a href="/#offerings" className="hover:text-[#1B2D5A] transition-colors relative group">
            Our Services
            <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-[#C9A84C] group-hover:w-full transition-all duration-300" />
          </a>
          <a href="/#why-us" className="hover:text-[#1B2D5A] transition-colors relative group">
            Why Us
            <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-[#C9A84C] group-hover:w-full transition-all duration-300" />
          </a>
          <a href="/#contact" className="hover:text-[#1B2D5A] transition-colors relative group">
            Contact
            <span className="absolute -bottom-0.5 left-0 w-0 h-0.5 bg-[#C9A84C] group-hover:w-full transition-all duration-300" />
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link href="/menu" className="hidden sm:block">
            <Button
              variant="primary"
              size="md"
              className="bg-[#1B2D5A] hover:bg-[#243a73] text-white border-0 rounded-xl shadow-md hover:shadow-lg transition-all duration-300"
            >
              Order Now
            </Button>
          </Link>

          {/* Mobile hamburger menu */}
          <button
            className="md:hidden p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-[#1B2D5A] transition-colors"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Panel */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white/98 backdrop-blur-md px-4 py-4 space-y-3 shadow-lg">
          <a href="/#how-it-works" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-[#1B2D5A] py-2 border-b border-gray-50 transition-colors">
            How It Works
          </a>
          <a href="/#thalis" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-[#1B2D5A] py-2 border-b border-gray-50 transition-colors">
            Thali Packages
          </a>
          <a href="/#offerings" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-[#1B2D5A] py-2 border-b border-gray-50 transition-colors">
            Our Services
          </a>
          <a href="/#why-us" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-[#1B2D5A] py-2 border-b border-gray-50 transition-colors">
            Why Us
          </a>
          <a href="/#contact" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-gray-700 hover:text-[#1B2D5A] py-2 border-b border-gray-50 transition-colors">
            Contact
          </a>
          <div className="pt-2">
            <Link href="/menu" className="block" onClick={() => setMobileOpen(false)}>
              <Button variant="primary" size="md" className="w-full bg-[#1B2D5A] hover:bg-[#243a73] text-white border-0 rounded-xl">
                Order Now
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
