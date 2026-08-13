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
      <section className="relative overflow-hidden bg-[#0F1E3D] py-20 md:py-28 px-4">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#C9A84C22_0%,_transparent_60%)] pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#1B2D5A80_0%,_transparent_60%)] pointer-events-none" />
        {/* Animated gold rings */}
        <div className="absolute top-1/2 right-0 translate-x-1/3 -translate-y-1/2 w-[500px] h-[500px] rounded-full border border-[#C9A84C]/10 pointer-events-none" />
        <div className="absolute top-1/2 right-0 translate-x-1/4 -translate-y-1/2 w-[350px] h-[350px] rounded-full border border-[#C9A84C]/15 pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text content */}
            <div className="space-y-8">
              <div>
                <span className="inline-flex items-center gap-2 bg-[#C9A84C]/15 text-[#C9A84C] text-xs font-bold px-4 py-2 rounded-full border border-[#C9A84C]/30 mb-6">
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
                  <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white border border-white/40 hover:bg-white/15 hover:border-white/70 rounded-xl transition-all duration-300">
                    Explore Menu <ArrowRight size={16} />
                  </button>
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
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

            {/* Right: Logo + Business card */}
            <div className="flex flex-col items-center gap-6 lg:pl-8">
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-full bg-[#C9A84C]/20 blur-3xl scale-110" />
                <Image
                  src="/vita-Logo.png"
                  alt="ViTa Cuisine"
                  width={280}
                  height={280}
                  className="object-contain relative z-10 drop-shadow-2xl"
                  priority
                />
              </div>
              {/* Business Card Preview */}
              <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-[#C9A84C]/30 hover:border-[#C9A84C]/60 transition-all duration-300 hover:-translate-y-1">
                <Image
                  src="/ViTa Business Card-images-0.png"
                  alt="ViTa Cuisine Services"
                  width={600}
                  height={350}
                  className="object-cover w-full"
                />
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
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1E3D] tracking-tight">
              Our Premium Services
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-sm md:text-base">
              From daily tiffins to large-scale catering — ViTa Cuisine handles every food need with the same dedication to quality.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {serviceCards.map(({ icon: Icon, name, description, badge }, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm hover:shadow-xl hover:border-[#C9A84C]/40 transition-all duration-300 group relative flex flex-col"
              >
                {badge && (
                  <span className="absolute -top-3 left-4 bg-[#C9A84C] text-[#0F1E3D] text-[9px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider shadow">
                    {badge}
                  </span>
                )}
                <div className="w-12 h-12 rounded-2xl bg-[#0F1E3D]/5 flex items-center justify-center mb-4 group-hover:bg-[#0F1E3D] group-hover:scale-110 transition-all duration-300">
                  <Icon className="text-[#1B2D5A] group-hover:text-[#C9A84C] transition-colors" size={22} />
                </div>
                <h3 className="font-extrabold text-[#0F1E3D] text-base mb-2">{name}</h3>
                <p className="text-sm text-gray-500 leading-relaxed flex-1">{description}</p>
                <a
                  href={WHATSAPP_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 text-xs font-bold text-[#C9A84C] hover:text-[#0F1E3D] flex items-center gap-1 transition-colors group-hover:gap-2"
                >
                  Enquire Now <ArrowRight size={12} />
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="bg-white py-20 px-4 scroll-mt-20">
        <div className="max-w-6xl mx-auto space-y-14">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Simple Process</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1E3D] tracking-tight">
              How It Works
            </h2>
            <p className="text-gray-500 max-w-md mx-auto text-sm">
              Getting fresh home-style meals is incredibly easy. Three simple steps is all it takes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop only) */}
            <div className="hidden md:block absolute top-10 left-1/6 right-1/6 h-px bg-gradient-to-r from-[#C9A84C]/20 via-[#C9A84C]/60 to-[#C9A84C]/20" />

            {stepCards.map(({ step, icon: Icon, title, description }, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm hover:shadow-xl hover:border-[#C9A84C]/30 transition-all duration-300 relative group"
              >
                {/* Step number badge */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-[#0F1E3D] text-[#C9A84C] flex items-center justify-center text-xs font-extrabold shadow-md">
                  {step}
                </div>
                <div className="w-14 h-14 rounded-2xl bg-[#0F1E3D]/5 flex items-center justify-center mx-auto mb-4 mt-2 group-hover:bg-[#0F1E3D] group-hover:scale-110 transition-all duration-300">
                  <Icon className="text-[#1B2D5A] group-hover:text-[#C9A84C] transition-colors" size={24} />
                </div>
                <h3 className="font-extrabold text-[#0F1E3D] mb-3 text-base">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── MENU / THALI SECTION ─── */}
      <section className="bg-[#0F1E3D] py-20 px-4">
        <div className="max-w-6xl mx-auto space-y-14">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Daily Menu</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Our Fresh Daily Thalis
            </h2>
            <p className="text-gray-400 max-w-md mx-auto text-sm">
              Prepared fresh every morning with premium ingredients. Our menu rotates daily for variety.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {menuCards.map(({ name, price, description, items, highlight }, idx) => (
              <div
                key={idx}
                className={`rounded-2xl overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 ${
                  highlight
                    ? "bg-[#C9A84C] text-[#0F1E3D] shadow-2xl shadow-[#C9A84C]/30 scale-105"
                    : "bg-white/5 border border-white/10 text-white hover:border-[#C9A84C]/40"
                }`}
              >
                {highlight && (
                  <div className="bg-[#0F1E3D] text-[#C9A84C] text-[10px] font-extrabold text-center py-2 tracking-widest uppercase">
                    ⭐ Chef&apos;s Recommended
                  </div>
                )}
                <div className="p-7 flex flex-col flex-1">
                  <div className="mb-4">
                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${highlight ? "text-[#0F1E3D]/60" : "text-[#C9A84C]"}`}>
                      {price}
                    </div>
                    <h3 className={`font-extrabold text-xl ${highlight ? "text-[#0F1E3D]" : "text-white"}`}>{name}</h3>
                    <p className={`text-xs mt-1.5 leading-relaxed ${highlight ? "text-[#0F1E3D]/70" : "text-gray-400"}`}>{description}</p>
                  </div>
                  <ul className="space-y-2 pt-4 border-t border-current/10 flex-1">
                    {items.map((item, itemIdx) => (
                      <li key={itemIdx} className={`text-sm flex items-center gap-2.5 ${highlight ? "text-[#0F1E3D]" : "text-gray-300"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${highlight ? "bg-[#0F1E3D]" : "bg-[#C9A84C]"}`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={WHATSAPP_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-6 flex items-center justify-center gap-2 text-sm font-bold py-2.5 px-4 rounded-xl transition-all duration-300 ${
                      highlight
                        ? "bg-[#0F1E3D] text-[#C9A84C] hover:bg-[#1B2D5A]"
                        : "bg-white/10 text-white hover:bg-[#C9A84C] hover:text-[#0F1E3D]"
                    }`}
                  >
                    <MessageCircle size={15} /> Order Now
                  </a>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-sm text-[#C9A84C]/80 bg-[#C9A84C]/10 border border-[#C9A84C]/20 rounded-2xl px-6 py-3 inline-block">
              💡 Our sabji options rotate daily for variety — WhatsApp us to check today&apos;s special menu!
            </p>
          </div>
        </div>
      </section>

      {/* ─── WHY CHOOSE US ─── */}
      <section id="why-us" className="bg-white py-20 px-4 scroll-mt-20">
        <div className="max-w-6xl mx-auto space-y-14">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Our Promise</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1E3D] tracking-tight">
              Why Choose ViTa Cuisine
            </h2>
            <p className="text-gray-500 max-w-md mx-auto text-sm">
              We focus on taste, health, hygiene, and absolute reliability — every single day.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {whyUsCards.map(({ icon: Icon, label, desc }, idx) => (
              <div
                key={idx}
                className="text-center space-y-3 p-6 rounded-2xl border border-gray-100 hover:border-[#C9A84C]/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className="w-14 h-14 rounded-2xl bg-[#0F1E3D]/5 flex items-center justify-center mx-auto group-hover:bg-[#0F1E3D] group-hover:scale-110 transition-all duration-300">
                  <Icon className="text-[#1B2D5A] group-hover:text-[#C9A84C] transition-colors" size={22} />
                </div>
                <p className="font-extrabold text-[#0F1E3D] text-sm leading-snug">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="max-w-6xl mx-auto space-y-14">
          <div className="text-center space-y-3">
            <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Customer Love</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1E3D] tracking-tight">
              What Our Customers Say
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map(({ name, role, text, stars }, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-7 border border-gray-200 shadow-sm hover:shadow-xl hover:border-[#C9A84C]/30 transition-all duration-300 flex flex-col"
              >
                <div className="flex mb-4">
                  {Array.from({ length: stars }).map((_, i) => (
                    <Star key={i} size={14} className="text-[#C9A84C] fill-[#C9A84C]" />
                  ))}
                </div>
                <p className="text-sm text-gray-600 leading-relaxed flex-1 italic">&ldquo;{text}&rdquo;</p>
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <p className="font-bold text-[#0F1E3D] text-sm">{name}</p>
                  <p className="text-xs text-gray-400">{role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CONTACT SECTION ─── */}
      <section id="contact" className="bg-white py-20 px-4 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-3 mb-14">
            <span className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Get In Touch</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F1E3D] tracking-tight">
              Visit Us or Order Now
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
            {/* Contact details */}
            <div className="space-y-6">
              <div className="rounded-2xl bg-[#0F1E3D] p-8 space-y-6 text-white">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                    <Phone size={18} className="text-[#C9A84C]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Call Us</p>
                    <a href="tel:+916356350085" className="text-white font-bold hover:text-[#C9A84C] transition-colors block">+91 635 635 0085 (Restaurant)</a>
                    <a href="tel:+916356350086" className="text-white font-bold hover:text-[#C9A84C] transition-colors block">+91 635 635 0086 (Delivery)</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                    <Mail size={18} className="text-[#C9A84C]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Email</p>
                    <a href="mailto:ViTaCuisine0@gmail.com" className="text-white font-bold hover:text-[#C9A84C] transition-colors">ViTaCuisine0@gmail.com</a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
                    <MapPin size={18} className="text-[#C9A84C]" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider mb-1">Location</p>
                    <p className="text-white font-semibold leading-relaxed">
                      19, Ayana Complex,<br />
                      Nr. Zydus Cancer Hospital,<br />
                      Zydus Hospital Road, Thaltej-380059.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Business card image */}
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-[#C9A84C]/30 hover:border-[#C9A84C]/60 transition-all duration-300">
              <Image
                src="/ViTa Business Card-images-1.png"
                alt="ViTa Cuisine Contact Card"
                width={600}
                height={350}
                className="object-cover w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA BANNER ─── */}
      <section className="bg-gradient-to-br from-[#0F1E3D] via-[#1B2D5A] to-[#0F1E3D] py-20 px-4 text-center text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#C9A84C15_0%,_transparent_70%)] pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-gradient-to-b from-[#C9A84C]/30 to-transparent pointer-events-none" />

        <div className="max-w-2xl mx-auto space-y-8 relative z-10">
          <div className="flex justify-center">
            <Image
              src="/vita-Logo.png"
              alt="ViTa Cuisine"
              width={80}
              height={80}
              className="object-contain opacity-90"
            />
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Hungry? Let&apos;s Fix That.
          </h2>
          <p className="text-gray-300 text-sm md:text-base leading-relaxed max-w-lg mx-auto">
            Join our growing family of loyal customers who enjoy warm, wholesome, home-style food every single day. Your first meal is just one message away.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
              <Button
                variant="primary"
                size="lg"
                className="bg-[#C9A84C] hover:bg-[#b8963f] text-[#0F1E3D] font-bold border-0 rounded-xl shadow-xl shadow-[#C9A84C]/30 hover:shadow-[#C9A84C]/50 transition-all duration-300 w-full sm:w-auto"
                leftIcon={<MessageCircle size={18} />}
              >
                Order on WhatsApp
              </Button>
            </a>
            <a href="tel:+916356350085">
              <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white border border-white/40 hover:bg-white/15 hover:border-white/70 rounded-xl transition-all duration-300">
                <Phone size={18} /> Call Us Now
              </button>
            </a>
          </div>
          <p className="text-xs text-gray-500">
            19, Ayana Complex · Thaltej, Ahmedabad · ViTaCuisine0@gmail.com
          </p>
        </div>
      </section>

      <Footer />
    </div>
  );
}
