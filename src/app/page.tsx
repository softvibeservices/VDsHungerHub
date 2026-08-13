import Image from "next/image";
import {
  MessageCircle,
  Phone,
  Truck,
  ShieldCheck,
  Clock,
  Building2,
  Smile,
  Star,
  ChefHat,
  PartyPopper,
  Users,
  UtensilsCrossed,
  ArrowRight,
  Mail,
  MapPin,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { WHATSAPP_LINK } from "@/lib/constants";
import { verifyStaffSession } from "@/lib/staff-auth";
import { redirect } from "next/navigation";

export default async function RootPage() {
  const staff = await verifyStaffSession();
  if (staff && (staff.role === "ADMIN" || staff.role === "STAFF")) {
    redirect("/dashboard");
  }

  const stepCards = [
    {
      step: "01",
      icon: MessageCircle,
      title: "Message or Order",
      description: "Reach us via WhatsApp or place your order directly on our platform. We respond instantly.",
    },
    {
      step: "02",
      icon: ChefHat,
      title: "Freshly Prepared",
      description: "Our chefs prepare your meal fresh each day using quality ingredients and authentic recipes.",
    },
    {
      step: "03",
      icon: Truck,
      title: "Delivered Hot",
      description: "Your meal arrives hot, on time, to your doorstep or office — every lunch, every dinner.",
    },
  ];

  const serviceCards = [
    {
      icon: Building2,
      name: "Corporate Meal Plans",
      description: "Customized bulk meal subscriptions for offices and corporate teams. Simplified billing and guaranteed daily delivery.",
      badge: "Most Popular",
    },
    {
      icon: PartyPopper,
      name: "Birthday & Party Orders",
      description: "Make your celebrations special with our curated party platters and festive meal packages.",
      badge: null,
    },
    {
      icon: Users,
      name: "Family Pack Meals",
      description: "Wholesome home-style meals for the whole family, packed fresh and portioned perfectly.",
      badge: null,
    },
    {
      icon: UtensilsCrossed,
      name: "Bulk Catering Services",
      description: "Large-scale catering for events, functions, and gatherings. Quality at scale, without compromise.",
      badge: "Enterprise",
    },
  ];

  const menuCards = [
    {
      name: "Standard Thali",
      price: "Best Value",
      description: "Our everyday favorite: balanced, clean, and completely filling.",
      items: ["4 Roti", "Dal / Kadhi", "Rice", "Today's Special Sabji", "Salad & Pickle"],
      highlight: false,
    },
    {
      name: "Deluxe Thali",
      price: "Premium",
      description: "Extra portions with a choice of sabjis for the complete experience.",
      items: ["5 Roti", "Dal Fry", "Jeera Rice", "2 Special Sabji Choices", "Sweet of the Day", "Salad & Papad"],
      highlight: true,
    },
    {
      name: "Light Thali",
      price: "Light Option",
      description: "A lighter, simpler meal option perfect for everyday office lunch.",
      items: ["3 Roti", "Kadhi", "Rice", "Today's Dry Sabji", "Salad"],
      highlight: false,
    },
  ];

  const whyUsCards = [
    { icon: ShieldCheck, label: "Hygienic & Fresh", desc: "FSSAI-compliant kitchen standards" },
    { icon: Clock, label: "Always On Time", desc: "Punctual delivery, every single day" },
    { icon: Building2, label: "Corporate Billing", desc: "GST invoices & bulk discounts" },
    { icon: Smile, label: "Trusted by Regulars", desc: "100+ loyal customers & counting" },
  ];

  const testimonials = [
    {
      name: "Rahul M.",
      role: "Software Engineer",
      text: "ViTa Cuisine has been my go-to lunch for 6 months. The food tastes exactly like home — fresh, wholesome, and perfectly timed.",
      stars: 5,
    },
    {
      name: "Priya S.",
      role: "HR Manager",
      text: "We subscribed our entire office team. The corporate billing is super easy and the food quality is consistently excellent.",
      stars: 5,
    },
    {
      name: "Ajay D.",
      role: "Business Owner",
      text: "Used them for our office party catering. 50 people, flawless execution. The food was amazing and everyone loved it!",
      stars: 5,
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <Navbar />

      {/* ─── HERO SECTION ─── */}
      <section className="relative overflow-hidden bg-[#0F1E3D] py-16 md:py-24 px-4">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#C9A84C22_0%,_transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#1B2D5A80_0%,_transparent_60%)] pointer-events-none" />
        <div className="absolute top-1/2 right-0 translate-x-1/3 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-[#C9A84C]/10 pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left: Text content */}
            <div className="lg:col-span-6 space-y-7">
              <div>
                <span className="inline-flex items-center gap-2 bg-[#C9A84C]/15 text-[#C9A84C] text-xs font-extrabold px-4 py-2 rounded-full border border-[#C9A84C]/30 mb-5">
                  🍽️ Restaurant & Cloud Kitchen · Thaltej, Ahmedabad
                </span>
                <h1 className="text-4xl md:text-5xl xl:text-6xl font-extrabold text-white leading-tight tracking-tight">
                  Fresh, Home-Style
                  <br />
                  <span className="bg-gradient-to-r from-[#C9A84C] to-[#e8c97a] bg-clip-text text-transparent">
                    Meals Delivered
                  </span>
                  <br />
                  To Your Door.
                </h1>
              </div>
              <p className="text-gray-300 text-base md:text-lg max-w-lg leading-relaxed">
                ViTa Cuisine is Ahmedabad&apos;s premium tiffin & catering service. Corporate meal plans, party orders, family packs — crafted fresh, delivered on time.
              </p>

              {/* Stats row */}
              <div className="flex flex-wrap gap-8">
                {[
                  { value: "100+", label: "Happy Customers" },
                  { value: "4.9★", label: "Average Rating" },
                  { value: "Daily", label: "Lunch & Dinner" },
                ].map((stat) => (
                  <div key={stat.label}>
                    <p className="text-2xl font-extrabold text-[#C9A84C]">{stat.value}</p>
                    <p className="text-xs text-gray-400">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full sm:w-auto bg-[#C9A84C] hover:bg-[#b8963f] text-[#0F1E3D] font-bold border-0 rounded-xl shadow-xl shadow-[#C9A84C]/25 hover:shadow-[#C9A84C]/40 transition-all duration-300"
                    leftIcon={<MessageCircle size={18} />}
                  >
                    Order on WhatsApp
                  </Button>
                </a>
                <a href="/menu">
                  <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white border border-white/40 hover:bg-white/15 hover:border-white/70 rounded-xl transition-all duration-300">
                    Explore Menu <ArrowRight size={16} />
                  </button>
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-4 pt-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <ShieldCheck size={14} className="text-green-400" />
                  Hygienic Kitchen
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Clock size={14} className="text-blue-400" />
                  On-Time Delivery
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <ChefHat size={14} className="text-[#C9A84C]" />
                  Daily Fresh Prep
                </div>
              </div>
            </div>

            {/* Right: Featured Video Showcase (Fully Responsive across All Devices) */}
            <div className="lg:col-span-6 flex flex-col items-center gap-4 w-full">
              <div className="relative w-full max-w-full sm:max-w-lg lg:max-w-xl rounded-2xl sm:rounded-3xl overflow-hidden border-2 border-[#C9A84C]/40 shadow-2xl bg-[#0B152B] group transition-all duration-300">
                <video
                  src="/vita-1_QsF26q56 (online-video-cutter.com) (1).mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-[240px] sm:h-[340px] md:h-[420px] lg:h-[480px] object-cover rounded-2xl sm:rounded-3xl"
                />
                
                {/* Overlay Badge */}
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-[#0F1E3D]/85 backdrop-blur-md px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-[#C9A84C]/40 text-white text-[11px] sm:text-xs font-bold flex items-center gap-2 shadow-lg">
                  <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <span className="text-[#C9A84C]">ViTa Kitchen Showcase</span>
                </div>
              </div>

              {/* Logo Badge below video */}
              <div className="flex items-center gap-3 bg-[#1B2D5A]/80 backdrop-blur-md border border-[#C9A84C]/30 px-5 py-2.5 rounded-2xl shadow-lg">
                <Image
                  src="/vita-Logo.png"
                  alt="ViTa Cuisine Logo"
                  width={38}
                  height={38}
                  className="object-contain"
                />
                <div>
                  <p className="text-xs font-bold text-white leading-tight">ViTa Cuisine</p>
                  <p className="text-[10px] text-[#C9A84C] font-semibold">THINK FOOD, THINK US</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SERVICES SECTION ─── */}
      <section id="offerings" className="bg-gray-50 py-20 px-4 scroll-mt-20">
        <div className="max-w-7xl mx-auto space-y-14">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">What We Offer</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
              Our Special Offerings
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              From corporate daily meal subscriptions to festive party catering — we handle everything with care and perfection.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {serviceCards.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.name}
                  className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-xl hover:border-[#C9A84C]/40 transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-xl bg-[#0F1E3D] text-[#C9A84C] flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Icon size={24} />
                      </div>
                      {s.badge && (
                        <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#C9A84C]/15 text-[#0F1E3D] border border-[#C9A84C]/30">
                          {s.badge}
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-extrabold text-gray-900 text-lg group-hover:text-[#0F1E3D] transition-colors">
                        {s.name}
                      </h3>
                      <p className="text-gray-500 text-xs mt-2 leading-relaxed">
                        {s.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6">
                    <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                      <button className="w-full py-2 px-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-[#0F1E3D] hover:text-white hover:border-[#0F1E3D] transition-all duration-200 flex items-center justify-center gap-2">
                        Inquire Now <ArrowRight size={14} />
                      </button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto space-y-14">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">How It Works</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
              3 Simple Steps to Your Meal
            </h2>
            <p className="text-gray-500 text-sm max-w-xl mx-auto">
              Getting fresh tiffin or corporate catering delivered to you is fast, easy, and completely hassle-free.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {stepCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.step}
                  className="bg-gray-50 rounded-3xl p-8 border border-gray-200/80 relative space-y-4 hover:shadow-lg transition-shadow"
                >
                  <span className="text-4xl font-black text-[#C9A84C]/25 select-none absolute top-6 right-6">
                    {card.step}
                  </span>
                  <div className="w-14 h-14 rounded-2xl bg-[#0F1E3D] text-[#C9A84C] flex items-center justify-center shadow-md">
                    <Icon size={28} />
                  </div>
                  <h3 className="text-xl font-extrabold text-gray-900">{card.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── MENU HIGHLIGHT ─── */}
      <section id="thalis" className="bg-[#0F1E3D] text-white py-20 px-4 scroll-mt-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto space-y-14 relative z-10">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Our Tiffin Options</span>
            <h2 className="text-3xl md:text-4xl font-extrabold">
              Daily Thali Packages
            </h2>
            <p className="text-gray-300 text-sm max-w-xl mx-auto">
              Curated daily for Lunch & Dinner with fresh sabjis, hot rotis, and traditional Gujarati recipes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {menuCards.map((menu) => (
              <div
                key={menu.name}
                className={`rounded-3xl p-8 transition-all duration-300 flex flex-col justify-between relative ${
                  menu.highlight
                    ? "bg-gradient-to-b from-[#1B2D5A] to-[#0F1E3D] border-2 border-[#C9A84C] shadow-2xl shadow-[#C9A84C]/20 md:-translate-y-4"
                    : "bg-[#14264A] border border-white/10"
                }`}
              >
                {menu.highlight && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#C9A84C] text-[#0F1E3D] text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full shadow-md">
                    Most Ordered
                  </span>
                )}

                <div className="space-y-6">
                  <div>
                    <span className="text-xs font-bold text-[#C9A84C]">{menu.price}</span>
                    <h3 className="text-2xl font-extrabold mt-1">{menu.name}</h3>
                    <p className="text-gray-300 text-xs mt-2 leading-relaxed">{menu.description}</p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Includes:</p>
                    <ul className="space-y-2">
                      {menu.items.map((item) => (
                        <li key={item} className="flex items-center gap-2.5 text-xs text-gray-200 font-medium">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-8">
                  <a href="/menu">
                    <button
                      className={`w-full py-3 px-6 rounded-xl text-xs font-bold transition-all duration-200 ${
                        menu.highlight
                          ? "bg-[#C9A84C] hover:bg-[#b8963f] text-[#0F1E3D] shadow-lg"
                          : "bg-white/10 hover:bg-white/20 text-white border border-white/20"
                      }`}
                    >
                      View Today&apos;s Choices
                    </button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WHY CHOOSE US ─── */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Why ViTa Cuisine</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
              The ViTa Cuisine Promise
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {whyUsCards.map((w) => {
              const Icon = w.icon;
              return (
                <div
                  key={w.label}
                  className="bg-white p-6 rounded-2xl border border-gray-200 text-center space-y-3 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-50 text-[#C9A84C] flex items-center justify-center mx-auto">
                    <Icon size={24} />
                  </div>
                  <h3 className="font-extrabold text-gray-900">{w.label}</h3>
                  <p className="text-gray-500 text-xs">{w.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Reviews</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900">
              What Our Customers Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-gray-50 rounded-2xl p-6 border border-gray-200 space-y-4 hover:shadow-md transition-shadow"
              >
                <div className="flex text-amber-400 gap-1">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-600 text-xs italic leading-relaxed">&ldquo;{t.text}&rdquo;</p>
                <div>
                  <p className="font-extrabold text-gray-900 text-sm">{t.name}</p>
                  <p className="text-[10px] text-gray-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="bg-gradient-to-r from-[#0F1E3D] to-[#1B2D5A] text-white py-16 px-4">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <h2 className="text-3xl md:text-4xl font-extrabold">Ready to Taste Home-Style Goodness?</h2>
          <p className="text-gray-300 text-sm max-w-xl mx-auto">
            Get in touch for daily tiffin subscriptions, office lunch plans, or bulk event catering.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
              <Button
                variant="primary"
                size="lg"
                className="bg-[#C9A84C] hover:bg-[#b8963f] text-[#0F1E3D] font-bold border-0 rounded-xl shadow-xl"
                leftIcon={<MessageCircle size={18} />}
              >
                WhatsApp Us Now
              </Button>
            </a>
            <a href="tel:+916356350085">
              <button className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white border border-white/40 hover:bg-white/10 rounded-xl transition-all">
                <Phone size={16} /> Call +91 635 635 0085
              </button>
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
