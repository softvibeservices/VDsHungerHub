import Link from "next/link";
import Image from "next/image";
import { MessageCircle, Phone, Mail, MapPin } from "lucide-react";
import { WHATSAPP_LINK } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="bg-[#0F1E3D] text-gray-400">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-14 grid grid-cols-1 md:grid-cols-4 gap-10">

        {/* Brand Column */}
        <div className="md:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <Image
              src="/vita-Logo.png"
              alt="ViTa Cuisine"
              width={54}
              height={54}
              className="object-contain rounded-full"
            />
            <div>
              <span className="font-extrabold text-white text-base block">ViTa Cuisine</span>
              <span className="text-[#C9A84C] text-[10px] font-semibold tracking-widest uppercase">Think Food, Think Us</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-gray-400">
            Restaurant & Cloud Kitchen crafting fresh, home-style meals for individuals, families, and corporates since day one.
          </p>
        </div>

        {/* Services */}
        <div>
          <p className="text-white font-semibold text-sm mb-4 uppercase tracking-widest">Our Services</p>
          <ul className="space-y-2.5 text-sm">
            <li><a href="#offerings" className="hover:text-[#C9A84C] transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#C9A84C] inline-block" />Corporate Meal Plans</a></li>
            <li><a href="#offerings" className="hover:text-[#C9A84C] transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#C9A84C] inline-block" />Birthday & Party Orders</a></li>
            <li><a href="#offerings" className="hover:text-[#C9A84C] transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#C9A84C] inline-block" />Family Pack Meals</a></li>
            <li><a href="#offerings" className="hover:text-[#C9A84C] transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#C9A84C] inline-block" />Bulk Catering Services</a></li>
            <li><Link href="/menu" className="hover:text-[#C9A84C] transition-colors flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-[#C9A84C] inline-block" />Daily Tiffin Subscription</Link></li>
          </ul>
        </div>

        {/* Quick Links */}
        <div>
          <p className="text-white font-semibold text-sm mb-4 uppercase tracking-widest">Quick Links</p>
          <ul className="space-y-2.5 text-sm">
            <li><a href="#how-it-works" className="hover:text-[#C9A84C] transition-colors">How It Works</a></li>
            <li><a href="#offerings" className="hover:text-[#C9A84C] transition-colors">Our Services</a></li>
            <li><a href="#why-us" className="hover:text-[#C9A84C] transition-colors">Why Choose Us</a></li>
            <li><Link href="/menu" className="hover:text-[#C9A84C] transition-colors">View Menu & Order</Link></li>
          </ul>
        </div>

        {/* Contact Info */}
        <div>
          <p className="text-white font-semibold text-sm mb-4 uppercase tracking-widest">Contact Us</p>
          <ul className="space-y-3 text-sm">
            <li>
              <a href="tel:+916356350085" className="flex items-start gap-3 hover:text-[#C9A84C] transition-colors">
                <Phone size={15} className="mt-0.5 flex-shrink-0 text-[#C9A84C]" />
                <span>+91 635 635 0085 (Restaurant)<br />+91 635 635 0086 (Delivery)</span>
              </a>
            </li>
            <li>
              <a href="mailto:ViTaCuisine0@gmail.com" className="flex items-center gap-3 hover:text-[#C9A84C] transition-colors">
                <Mail size={15} className="flex-shrink-0 text-[#C9A84C]" />
                ViTaCuisine0@gmail.com
              </a>
            </li>
            <li>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:text-[#C9A84C] transition-colors"
              >
                <MessageCircle size={15} className="flex-shrink-0 text-[#C9A84C]" />
                Chat on WhatsApp
              </a>
            </li>
            <li className="flex items-start gap-3">
              <MapPin size={15} className="mt-0.5 flex-shrink-0 text-[#C9A84C]" />
              <span className="text-xs leading-relaxed">19, Ayana Complex, Nr. Zydus Cancer Hospital,<br />Zydus Hospital Road, Thaltej-380059.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10 py-5 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <p className="text-gray-500">© {new Date().getFullYear()} ViTa Cuisine. All rights reserved. | Restaurant & Cloud Kitchen</p>
          <Link
            href="/staff-login"
            className="text-gray-700 hover:text-gray-500 transition-colors"
          >
            Staff & Admin Login
          </Link>
        </div>
      </div>
    </footer>
  );
}
