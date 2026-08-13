import { cookies } from "next/headers";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getEffectiveCutoffDate } from "@/lib/time";
import {
  resolveAuthState,
} from "@/lib/customer-auth";
import AuthTabs from "@/components/customer/AuthTabs";
import OrderingExperience from "@/components/customer/OrderingExperience";
import { WHATSAPP_LINK } from "@/lib/constants";

// ── Page component ────────────────────────────────────────────────────────────
// Only VERIFIED_SESSION state renders the ordering UI (Req #8).
// ANONYMOUS → defaults to Register tab.
// DRAFT_PENDING_VERIFICATION → defaults to Verify tab so the user can resume.

export default async function MenuPage() {
  const authState = await resolveAuthState();
  const todayMenu = await getTodayMenu();

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

async function getTodayMenu() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const istHour = ist.getUTCHours();
  const istMinute = ist.getUTCMinutes();
  const dateStr = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;

  // Determine meal type by IST hour (before 3pm IST → LUNCH)
  const mealType = istHour < 15 ? "LUNCH" : "DINNER";

  // Retrieve global settings first — needed for visibility window check
  const settings = await prisma.mealSettings.findUnique({
    where: { mealType },
  });

  if (!settings) {
    console.warn(`[menu] No MealSettings row found for ${mealType}. Run 'npx prisma db seed' to populate initial meal settings.`);
  }

  // §8.2 menuVisibleFrom check: if current time is BEFORE the visibility window,
  // the menu for this cycle is not yet available. Return a sentinel object.
  if (settings?.menuVisibleFrom) {
    const [visibleHour, visibleMin] = settings.menuVisibleFrom.split(":").map(Number);
    const currentMinutesFromMidnight = istHour * 60 + istMinute;
    const visibleFromMinutes = visibleHour * 60 + visibleMin;

    // For LUNCH: menu becomes visible at menuVisibleFrom the PREVIOUS evening (e.g. 18:00)
    // For DINNER: menu becomes visible at menuVisibleFrom the SAME day (e.g. after lunch cutoff)
    // Simple rule: if current time < visibleFrom AND it's the *same* meal type,
    // the menu for today's cycle is not yet browsable
    if (mealType === "DINNER" && currentMinutesFromMidnight < visibleFromMinutes) {
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

