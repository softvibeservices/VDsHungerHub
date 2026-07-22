"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Users,
  ShoppingBasket,
  UtensilsCrossed,
  UserCheck,
  ArrowRight,
  Sun,
  Moon,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";

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

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  href: string;
}

function StatCard({ label, value, icon: Icon, color, href }: StatCardProps) {
  return (
    <Link
      href={href}
      className="bg-white rounded-2xl border border-gray-200 p-4 hover:shadow-md hover:border-orange-200 transition-all group"
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
        <ArrowRight
          size={16}
          className="text-gray-300 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all"
        />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </Link>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [todayMenus, setTodayMenus] = useState<DailyMenu[]>([]);
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
    const istTime = new Date(now.getTime() + 330 * 60 * 1000);
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

  const lunch = todayMenus.find((m) => m.mealType === "LUNCH");
  const dinner = todayMenus.find((m) => m.mealType === "DINNER");
  const bothSet = !!lunch && !!dinner;

  const statusText = bothSet
    ? "Everything's set for today."
    : alerts?.showLunchAlert && alerts?.showDinnerAlert
    ? "Lunch and dinner menus still need to be set today."
    : alerts?.showLunchAlert
    ? "Lunch menu still needs to be set today."
    : alerts?.showDinnerAlert
    ? "Dinner menu still needs to be set today."
    : "Everything's set for today.";

  const statCards = [
    { label: "Active Companies", value: stats?.companies ?? 0, icon: Building2, color: "bg-blue-500", href: "/companies" },
    { label: "Active Users", value: stats?.users ?? 0, icon: Users, color: "bg-violet-500", href: "/users" },
    { label: "Active Products", value: stats?.products ?? 0, icon: ShoppingBasket, color: "bg-emerald-500", href: "/catalog/products" },
    { label: "Active Thalis", value: stats?.thalis ?? 0, icon: UtensilsCrossed, color: "bg-orange-500", href: "/catalog/thalis" },
    { label: "Active Staff", value: stats?.staff ?? 0, icon: UserCheck, color: "bg-rose-500", href: "/staff" },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Section — Plain Language Readiness Header */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">Today</h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">{statusText}</p>
        </div>
        {(!bothSet || alerts?.showLunchAlert || alerts?.showDinnerAlert) && (
          <Link href="/daily-menu">
            <Button variant="primary" size="md">
              Set Today&apos;s Menu
            </Button>
          </Link>
        )}
      </div>

      {/* Today's Menu Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Today&apos;s Menu</h2>
          <Link href="/daily-menu" className="text-xs text-orange-500 hover:text-orange-600 font-bold flex items-center gap-1">
            Manage <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { menu: lunch, type: "LUNCH", Icon: Sun, color: "amber" },
            { menu: dinner, type: "DINNER", Icon: Moon, color: "indigo" },
          ].map(({ menu, type, Icon, color }) => (
            <div
              key={type}
              className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${
                menu ? `border-${color}-200` : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={18} className={type === "LUNCH" ? "text-amber-500" : "text-indigo-500"} />
                  <h3 className="font-bold text-gray-900 text-sm">
                    {type === "LUNCH" ? "Lunch" : "Dinner"}
                  </h3>
                </div>
                {menu ? (
                  <Badge variant="success" label="Set ✓" />
                ) : (
                  <Link
                    href="/daily-menu"
                    className="text-xs px-3 py-1 rounded-lg bg-orange-500 text-white font-bold flex items-center gap-1 hover:bg-orange-600 transition-colors shadow-sm"
                  >
                    <Plus size={13} /> Set Menu
                  </Link>
                )}
              </div>
              {menu ? (
                <div className="space-y-2">
                  {menu.thalis.map((mt, i) => {
                    const thaliSabji = menu.sabjiOptions.filter((s) => s.thali.name === mt.thali.name);
                    return (
                      <div key={i} className="pl-3 border-l-2 border-orange-200 space-y-0.5">
                        <p className="text-xs font-bold text-gray-800">
                          {mt.thali.name} — <span className="text-orange-600">{formatCurrency(mt.thali.price)}</span>
                        </p>
                        {thaliSabji.length > 0 && (
                          <p className="text-[11px] text-gray-500 font-medium">
                            Sabji: {thaliSabji.map((s) => s.product.name).join(", ")}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-medium italic">No menu set for today.</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Business Overview Stats */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Business Overview</h2>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse h-28" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statCards.map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>
        )}
      </div>

      {/* Menu History Link */}
      <div className="pt-2 flex justify-end">
        <Link
          href="/daily-menu/history"
          className="text-xs text-gray-500 hover:text-orange-500 font-bold flex items-center gap-1 transition-colors"
        >
          View Full Menu History <ArrowRight size={13} />
        </Link>
      </div>
    </div>
  );
}
