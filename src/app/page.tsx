import {
  MessageCircle,
  UtensilsCrossed,
  Truck,
  ShieldCheck,
  Clock,
  Building2,
  Smile,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Navbar from "@/components/public/Navbar";
import Footer from "@/components/public/Footer";
import { WHATSAPP_LINK } from "@/lib/constants";

export default function RootPage() {
  const stepCards = [
    {
      step: "STEP 1",
      icon: MessageCircle,
      title: "Message Us",
      description: "Send us a WhatsApp message to say hello and get started.",
    },
    {
      step: "STEP 2",
      icon: UtensilsCrossed,
      title: "Pick Your Thali",
      description: "Tell us your meal preference — we'll guide you through today's fresh options.",
    },
    {
      step: "STEP 3",
      icon: Truck,
      title: "Get Delivered",
      description: "Your home-style thali arrives hot and on time, every single day.",
    },
  ];

  const offeringCards = [
    {
      name: "Standard Thali",
      description: "Our everyday favorite: balanced, clean, and completely filling.",
      items: ["4 Roti", "Dal / Kadhi", "Rice", "Today's Special Sabji", "Salad & Pickle"],
    },
    {
      name: "Deluxe Thali",
      description: "Extra portions with a choice of sabjis for the complete experience.",
      items: ["5 Roti", "Dal Fry", "Jeera Rice", "2 Special Sabji Choices", "Sweet of the Day", "Salad & Papad"],
    },
    {
      name: "Light Thali",
      description: "A lighter, simpler meal option perfect for everyday office lunch.",
      items: ["3 Roti", "Kadhi", "Rice", "Today's Dry Sabji", "Salad"],
    },
  ];

  const whyUsCards = [
    { icon: ShieldCheck, label: "Hygienic & Fresh" },
    { icon: Clock, label: "Always On Time" },
    { icon: Building2, label: "Corporate Billing" },
    { icon: Smile, label: "Trusted by Regulars" },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Navigation Header */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-orange-50/70 via-orange-50/20 to-white py-16 md:py-24 px-4">
        {/* Subtle decorative circles */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-orange-100/40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-orange-100/30 blur-3xl pointer-events-none" />

        <div className="max-w-3xl mx-auto text-center relative z-10 space-y-6">
          <span className="inline-flex items-center gap-1.5 bg-orange-100/80 text-orange-700 text-xs font-semibold px-3.5 py-1.5 rounded-full border border-orange-200/50 shadow-sm animate-fade-in select-none">
            🍱 Fresh Home-Style Tiffin Service
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 leading-tight tracking-tight">
            Home-Style Thalis, <br />
            <span className="bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent">
              Delivered On Time.
            </span>
          </h1>
          <p className="text-gray-600 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
            Lunch and dinner thalis made fresh daily in a hygienic kitchen. Order in seconds, directly via WhatsApp, and enjoy warm meals at your office or home.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center items-center">
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button variant="primary" size="lg" className="w-full sm:w-auto shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all" leftIcon={<MessageCircle size={18} />}>
                Order on WhatsApp
              </Button>
            </a>
            <a href="#how-it-works" className="w-full sm:w-auto">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto hover:bg-gray-50 transition-colors">
                See How It Works
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-white py-16 px-4 border-t border-gray-100 scroll-mt-16">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">How It Works</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Getting fresh home-style meals is incredibly easy. Just follow these three simple steps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stepCards.map(({ step, icon: Icon, title, description }, idx) => (
              <div
                key={idx}
                className="bg-white border border-gray-200/80 rounded-2xl p-6 text-center shadow-sm hover:shadow-md hover:border-orange-200 transition-all duration-300 relative group"
              >
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                  <Icon className="text-orange-600 group-hover:text-white transition-colors" size={22} />
                </div>
                <p className="text-[10px] font-bold text-orange-600 tracking-wider mb-1">{step}</p>
                <h3 className="font-bold text-gray-900 mb-2">{title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What We Offer Section */}
      <section id="offerings" className="bg-gray-50 py-16 px-4 border-y border-gray-100 scroll-mt-16">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Our Daily Thalis</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Prepared fresh every day with premium ingredients. Our menus rotate daily.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {offeringCards.map(({ name, description, items }, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md hover:border-orange-200 transition-all duration-300"
              >
                <div>
                  <div className="h-1.5 bg-gradient-to-r from-orange-500 to-orange-600" />
                  <div className="p-6 space-y-4">
                    <div>
                      <h3 className="font-extrabold text-gray-900 text-base">{name}</h3>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{description}</p>
                    </div>
                    <ul className="space-y-2 pt-2 border-t border-gray-50">
                      {items.map((item, itemIdx) => (
                        <li key={itemIdx} className="text-xs text-gray-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center bg-orange-50 border border-orange-100 rounded-2xl p-4 max-w-xl mx-auto shadow-sm">
            <p className="text-xs text-orange-800 font-medium">
              💡 Our sabji options change daily to offer variety. Send us a message on WhatsApp to view today&apos;s special menu setup!
            </p>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section id="why-us" className="bg-white py-16 px-4 scroll-mt-16">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Why Choose Us</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              We focus on taste, health, hygiene, and absolute reliability.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {whyUsCards.map(({ icon: Icon, label }, idx) => (
              <div key={idx} className="text-center space-y-3 p-4 hover:-translate-y-1 transition-transform duration-300">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto border border-orange-100 shadow-inner">
                  <Icon className="text-orange-600" size={20} />
                </div>
                <p className="text-xs font-bold text-gray-800 leading-snug">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Banner */}
      <section className="bg-gradient-to-br from-orange-500 to-orange-600 py-16 px-4 text-center text-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-xl mx-auto space-y-6 relative z-10">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Hungry? Let&apos;s Fix That.</h2>
          <p className="text-orange-100 text-sm md:text-base leading-relaxed">
            Join hundreds of regular tiffin subscribers who enjoy warm, wholesome, home-style food every day.
          </p>
          <div className="pt-2">
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="inline-block w-full sm:w-auto">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto hover:bg-orange-50 transition-colors shadow-lg" leftIcon={<MessageCircle size={18} />}>
                Order on WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer Navigation */}
      <Footer />
    </div>
  );
}
