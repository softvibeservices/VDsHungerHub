"use client";

import { useEffect, useState } from "react";
import { Building2, Users, ShoppingBasket, UtensilsCrossed, UserCheck, CalendarDays, Plus, ArrowRight, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

interface Stats {
  companies: number;
  users: number;
  products: number;
  thalis: number;
  staff: number;
}

interface DailyMenu {
  id: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime?: string;
  thalis: { thali: { name: string; price: number } }[];
  sabjiOptions: { product: { name: string }; thali: { name: string } }[];
}

interface RecentMenu {
  id: string;
  date: string;
  mealType: "LUNCH" | "DINNER";
  thalis: { thali: { name: string } }[];
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  href: string;
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
  const [recentMenus, setRecentMenus] = useState<RecentMenu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [alerts, setAlerts] = useState<{ showLunchAlert: boolean; showDinnerAlert: boolean } | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/dashboard");
      if (res.status === 401) {
        window.location.href = "/staff-login";
        return;
      }
      const json = await res.json();
      setStats(json.stats);
      setTodayMenus(json.todayMenus ?? []);
      setRecentMenus(json.recentMenus ?? []);
    } catch {
      // silent fail
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const now = new Date();
    const istTime = new Date(now.getTime() + (330 * 60 * 1000));
    const hours = istTime.getUTCHours();
    const mins = istTime.getUTCMinutes();
    const currentMinutes = hours * 60 + mins;

    const lunchCutoffMins = 10 * 60; // 10:00 AM
    const dinnerCutoffMins = 16 * 60; // 4:00 PM

    const lunchNotSet = !todayMenus.some((m) => m.mealType === "LUNCH");
    const dinnerNotSet = !todayMenus.some((m) => m.mealType === "DINNER");

    setAlerts({
      showLunchAlert: lunchNotSet && currentMinutes < lunchCutoffMins,
      showDinnerAlert: dinnerNotSet && currentMinutes < dinnerCutoffMins,
    });
  }, [isLoading, todayMenus]);

  const statCards = [
    { label: "Active Companies", value: stats?.companies ?? 0, icon: Building2, color: "bg-blue-500", href: "/companies" },
    { label: "Active Users", value: stats?.users ?? 0, icon: Users, color: "bg-violet-500", href: "/users" },
    { label: "Active Products", value: stats?.products ?? 0, icon: ShoppingBasket, color: "bg-emerald-500", href: "/catalog" },
    { label: "Active Thalis", value: stats?.thalis ?? 0, icon: UtensilsCrossed, color: "bg-orange-500", href: "/catalog" },
    { label: "Active Staff", value: stats?.staff ?? 0, icon: UserCheck, color: "bg-rose-500", href: "/catalog" },
    { label: "Today's Menus", value: todayMenus.length, icon: CalendarDays, color: "bg-amber-500", href: "/daily-menu" },
  ];

  const lunch = todayMenus.find((m) => m.mealType === "LUNCH");
  const dinner = todayMenus.find((m) => m.mealType === "DINNER");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Alert banner if today's menu needs action */}
      {alerts && (alerts.showLunchAlert || alerts.showDinnerAlert) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-sm">{"Action Required: Today's menu is not set!"}</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {alerts.showLunchAlert && "Lunch menu needs to be configured before 10:00 AM. "}
                {alerts.showDinnerAlert && "Dinner menu needs to be configured before 4:00 PM."}
              </p>
            </div>
          </div>
          <Link
            href="/daily-menu"
            className="px-3.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer flex-shrink-0"
          >
            Configure Menu
          </Link>
        </div>
      )}

      {/* Today's Menu First */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Today&apos;s Menu</h2>
          <Link href="/daily-menu" className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-250 font-medium">
                    Set ✓
                  </span>
                ) : (
                  <Link href="/daily-menu" className="text-xs px-2.5 py-1 rounded-lg bg-orange-500 text-white font-medium flex items-center gap-1 hover:bg-orange-600 transition-colors">
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

      {/* Recent Menus */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Recent Menus</h2>
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse h-48" />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-150 overflow-hidden">
            {recentMenus.length === 0 ? (
              <p className="text-sm text-gray-400 p-5">No menus configured yet.</p>
            ) : (
              recentMenus.map((rm) => (
                <div key={rm.id} className="p-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="text-sm font-bold text-gray-800">
                      {rm.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"} — {new Date(rm.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Thalis: {rm.thalis.map((t) => t.thali.name).join(", ")}
                    </p>
                  </div>
                  <Link
                    href="/daily-menu"
                    className="text-xs text-orange-500 hover:text-orange-600 font-semibold"
                  >
                    View Menu →
                  </Link>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { href: "/companies", label: "+ Add Company", icon: Building2 },
            { href: "/users", label: "+ Add User", icon: Users },
            { href: "/catalog", label: "📦 Go to Catalog", icon: ShoppingBasket },
            { href: "/daily-menu", label: "📅 Set Menu", icon: CalendarDays },
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
