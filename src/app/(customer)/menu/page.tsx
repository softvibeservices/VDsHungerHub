// src\app\(customer)\menu\page.tsx

import { cookies } from "next/headers";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getEffectiveCutoffDate } from "@/lib/time";
import { resolveAuthState } from "@/lib/customer-auth";
import OrderingExperience from "@/components/customer/OrderingExperience";
import { WHATSAPP_LINK } from "@/lib/constants";

// ── Page component ────────────────────────────────────────────────────────────
// Renders ordering experience or status banner based on dynamic mealType settings.

export default async function MenuPage({
  searchParams,
}: {
  searchParams?: Promise<{ mealType?: string }>;
}) {
  const params = await searchParams;
  const requestedMealType = params?.mealType as "LUNCH" | "DINNER" | undefined;
  const authState = await resolveAuthState();
  const todayMenu = await getTodayMenu(requestedMealType);

  const userId = authState.state === "VERIFIED_SESSION" ? authState.userId : null;

  // 1. If menu is not set (i.e. null), render a "No Menu Today" message
  if (!todayMenu) {
    return (
      <div className="min-h-[70vh] bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-sm mx-auto space-y-6">
          <Image src="/vita-Logo.png" alt="ViTa Cuisine" width={100} height={100} className="object-contain mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-[#0F1E3D]">No Menu Published Yet</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              Today&apos;s menu hasn&apos;t been published yet. Check back soon, or message us directly on WhatsApp to place your order.
            </p>
          </div>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#C9A84C] hover:bg-[#b8963f] text-[#0F1E3D] font-bold text-sm px-6 py-3 rounded-xl shadow-lg shadow-[#C9A84C]/30 transition-all duration-300"
          >
            💬 Order on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  // 2. If the menu is not yet visible, render the visibility window holding page
  if ((todayMenu as any).menuNotYetVisible === true) {
    const visibleFrom = (todayMenu as any).menuVisibleFrom as string;
    return (
      <div className="min-h-[70vh] bg-white flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-sm mx-auto space-y-6">
          <Image src="/vita-Logo.png" alt="ViTa Cuisine" width={100} height={100} className="object-contain mx-auto" />
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-[#0F1E3D]">
              {(todayMenu as any).mealType === "DINNER" ? "🌙 Dinner Menu" : "☀️ Lunch Menu"} Coming Soon
            </h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              The {(todayMenu as any).mealType === "DINNER" ? "dinner" : "lunch"} menu will be available
              from <strong className="text-[#1B2D5A]">{visibleFrom} IST</strong> today. Check back soon!
            </p>
          </div>
          <div className="bg-[#0F1E3D] rounded-2xl px-6 py-4 text-white text-sm">
            <p className="text-[#C9A84C] font-bold mb-1">Can&apos;t wait?</p>
            <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="underline hover:text-[#C9A84C] transition-colors">
              Message us on WhatsApp
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 3. Render the menu directly for everyone (with userId optionally null for guests)
  return <OrderingExperience userId={userId} menu={todayMenu as any} />;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseTimeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr) return null;
  const str = timeStr.trim().toUpperCase();
  const isPM = str.includes("PM");
  const isAM = str.includes("AM");
  const clean = str.replace(/AM|PM/g, "").trim();
  const parts = clean.split(":");
  if (parts.length < 2) return null;
  let hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return null;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

async function getTodayMenu(requestedMealType?: "LUNCH" | "DINNER") {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const istHour = ist.getUTCHours();
  const istMinute = ist.getUTCMinutes();
  const currentMinutesFromMidnight = istHour * 60 + istMinute;

  // Retrieve global settings for both meal types to determine active cycle
  const [lunchSettings, dinnerSettings] = await Promise.all([
    prisma.mealSettings.findUnique({ where: { mealType: "LUNCH" } }),
    prisma.mealSettings.findUnique({ where: { mealType: "DINNER" } }),
  ]);

  let mealType: "LUNCH" | "DINNER" = "LUNCH";

  if (requestedMealType === "LUNCH" || requestedMealType === "DINNER") {
    mealType = requestedMealType;
  } else {
    const dinnerVisibleMin = parseTimeToMinutes(dinnerSettings?.menuVisibleFrom);
    const lunchCutoffMin = parseTimeToMinutes(lunchSettings?.cutoffTime);

    // If current time is past Dinner's visibleFrom time OR past Lunch's cutoff time, switch to DINNER
    if (dinnerVisibleMin !== null && currentMinutesFromMidnight >= dinnerVisibleMin) {
      mealType = "DINNER";
    } else if (lunchCutoffMin !== null && currentMinutesFromMidnight >= lunchCutoffMin) {
      mealType = "DINNER";
    } else if (istHour >= 15) {
      mealType = "DINNER";
    }
  }

  const settings = mealType === "DINNER" ? dinnerSettings : lunchSettings;

  if (!settings) {
    console.warn(`[menu] No MealSettings row found for ${mealType}.`);
  }

  // Check menuVisibleFrom for the target mealType
  if (settings?.menuVisibleFrom) {
    const visibleFromMinutes = parseTimeToMinutes(settings.menuVisibleFrom);

    if (visibleFromMinutes !== null && currentMinutesFromMidnight < visibleFromMinutes) {
      return {
        menuNotYetVisible: true as const,
        mealType,
        menuVisibleFrom: settings.menuVisibleFrom,
        isOrderingOpen: false,
        cutoffTime: null,
      };
    }
  }

  const today = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));

  const menu = await prisma.dailyMenu.findFirst({
    where: {
      date: today,
      mealType,
    },
    include: {
      thalis: {
        include: {
          thali: {
            include: {
              items: true,
              category: { select: { id: true, name: true, nameGu: true } },
            },
          },
        },
      },
      sabjiOptions: {
        include: {
          product: { select: { id: true, name: true, nameGu: true, price: true } },
        },
      },
    },
  });

  if (!menu) return null;

  const cutoffTime = getEffectiveCutoffDate(
    menu.cutoffTime,
    settings?.cutoffTime,
    menu.date
  );

  return {
    ...menu,
    cutoffTime,
    isOrderingOpen: settings ? settings.isOrderingOpen : true,
    menuVisibleFrom: settings?.menuVisibleFrom ?? null,
    menuNotYetVisible: false as const,
  };
}
