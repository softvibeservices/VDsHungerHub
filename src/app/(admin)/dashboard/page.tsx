"use client";

import { useEffect, useState } from "react";
import { Building2, Users, ShoppingBasket, UtensilsCrossed, UserCheck, CalendarDays, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface Stats {
  companies: number; users: number; products: number; thalis: number; staff: number;
}

interface DailyMenu {
  id: string; mealType: "LUNCH" | "DINNER"; cutoffTime?: string;
  thalis: { thali: { name: string; price: number } }[];
  sabjiOptions: { product: { name: string }; thali: { name: string } }[];
}

interface StatCardProps {
  label: string; value: number; icon: React.ElementType; color: string; href: string;
}

function StatCard({ label, value, icon: Icon, color, href }: StatCardProps) {
  return (
    <Link href={href} className="bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-md hover:border-orange-200 transition-all group">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <ArrowRight size={16} className="text-gray-300 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
      </div>
      <p className="text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayMenus, setTodayMenus] = useState<DailyMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/dashboard");
      const json = await res.json();
      setStats(json.stats);
      setTodayMenus(json.todayMenus ?? []);
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const statCards = [
    { label: "Active Companies", value: stats?.companies ?? 0, icon: Building2, color: "bg-blue-500", href: "/companies" },
    { label: "Active Users", value: stats?.users ?? 0, icon: Users, color: "bg-violet-500", href: "/users" },
    { label: "Active Products", value: stats?.products ?? 0, icon: ShoppingBasket, color: "bg-emerald-500", href: "/products" },
    { label: "Active Thalis", value: stats?.thalis ?? 0, icon: UtensilsCrossed, color: "bg-orange-500", href: "/thalis" },
    { label: "Active Staff", value: stats?.staff ?? 0, icon: UserCheck, color: "bg-rose-500", href: "/staff" },
    { label: "Today's Menus", value: todayMenus.length, icon: CalendarDays, color: "bg-amber-500", href: "/menu" },
  ];

  const lunch = todayMenus.find((m) => m.mealType === "LUNCH");
  const dinner = todayMenus.find((m) => m.mealType === "DINNER");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Stats grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Overview</h2>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {statCards.map((card) => <StatCard key={card.label} {...card} />)}
          </div>
        )}
      </div>

      {/* Today's Menu */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Today&apos;s Menu</h2>
          <Link href="/menu" className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
            Manage <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { menu: lunch, type: "LUNCH", emoji: "🌅", color: "amber" },
            { menu: dinner, type: "DINNER", emoji: "🌙", color: "indigo" },
          ].map(({ menu, type, emoji, color }) => (
            <div key={type} className={`bg-white rounded-2xl border p-5 ${menu ? `border-${color}-200` : "border-gray-200"}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">
                  {emoji} {type === "LUNCH" ? "Lunch" : "Dinner"}
                </h3>
                {menu ? (
                  <span className={`text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium`}>
                    Set ✓
                  </span>
                ) : (
                  <Link href="/menu" className="text-xs px-2.5 py-1 rounded-lg bg-orange-500 text-white font-medium flex items-center gap-1 hover:bg-orange-600 transition-colors">
                    <Plus size={12} /> Set Menu
                  </Link>
                )}
              </div>
              {menu ? (
                <div className="space-y-1.5">
                  {menu.cutoffTime && (
                    <p className="text-xs text-gray-500">Cutoff: {menu.cutoffTime}</p>
                  )}
                  {menu.thalis.map((mt, i) => {
                    const thaliSabji = menu.sabjiOptions.filter((s) => s.thali.name === mt.thali.name);
                    return (
                      <div key={i} className="pl-2 border-l-2 border-orange-200">
                        <p className="text-sm font-medium text-gray-800">{mt.thali.name} — {formatCurrency(mt.thali.price)}</p>
                        {thaliSabji.length > 0 && (
                          <p className="text-xs text-gray-500">Sabji: {thaliSabji.map((s) => s.product.name).join(", ")}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No menu set for today.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/companies", label: "+ Add Company", icon: Building2 },
            { href: "/users", label: "+ Add User", icon: Users },
            { href: "/products", label: "+ Add Product", icon: ShoppingBasket },
            { href: "/thalis", label: "+ Add Thali", icon: UtensilsCrossed },
            { href: "/staff", label: "+ Add Staff", icon: UserCheck },
            { href: "/menu", label: "📅 Set Menu", icon: CalendarDays },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 hover:border-orange-300 hover:text-orange-600 hover:bg-orange-50 transition-all"
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
