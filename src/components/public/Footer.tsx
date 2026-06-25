import Link from "next/link";
import { UtensilsCrossed, MessageCircle } from "lucide-react";
import { WHATSAPP_LINK } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand Column */}
        <div>
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-orange-500 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-sm">VD&apos;s Hunger Hub</span>
          </div>
          <p className="text-sm leading-relaxed">
            Fresh, home-style thalis delivered directly to your doorstep or office — every lunch, every dinner.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <p className="text-white font-semibold text-sm mb-3">Quick Links</p>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="#how-it-works" className="hover:text-orange-400 transition-colors">How It Works</a>
            </li>
            <li>
              <a href="#offerings" className="hover:text-orange-400 transition-colors">Our Thalis</a>
            </li>
            <li>
              <a href="#why-us" className="hover:text-orange-400 transition-colors">Why Us</a>
            </li>
            <li>
              <Link href="/login" className="hover:text-orange-400 transition-colors">Admin Login</Link>
            </li>
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <p className="text-white font-semibold text-sm mb-3">Get In Touch</p>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm hover:text-orange-400 transition-colors mb-2"
          >
            <MessageCircle size={16} /> Chat on WhatsApp
          </a>
          <p className="text-sm">Mobile: +91 63563 50086</p>
        </div>
      </div>

      <div className="border-t border-gray-800 py-4 text-center text-xs">
        &copy; {new Date().getFullYear()} VD&apos;s Hunger Hub. All rights reserved.
      </div>
    </footer>
  );
}
