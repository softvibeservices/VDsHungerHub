import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  verifyCustomerAccessToken,
  hashRefreshToken,
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
  REG_DRAFT_COOKIE,
} from "@/lib/customer-auth";
import AuthTabs from "@/components/customer/AuthTabs";
import OrderingExperience from "@/components/customer/OrderingExperience";

export const metadata = {
  title: "Order Now | VD's Hunger Hub",
  description:
    "Order your daily thali online. Fresh home-style meals delivered to your workplace.",
};

// ── Server-side auth state resolution ────────────────────────────────────────

type AuthState =
  | { state: "VERIFIED_SESSION"; userId: string }
  | { state: "DRAFT_PENDING_VERIFICATION"; draftId: string }
  | { state: "ANONYMOUS" };

async function resolveAuthState(): Promise<AuthState> {
  const cookieStore = await cookies();

  // 1. Try access token (fast path)
  const accessToken = cookieStore.get(CUSTOMER_ACCESS_COOKIE)?.value;
  if (accessToken) {
    const claims = verifyCustomerAccessToken(accessToken);
    if (claims) {
      return { state: "VERIFIED_SESSION", userId: claims.sub };
    }
  }

  // 2. Try refresh token (if access token expired)
  const refreshToken = cookieStore.get(CUSTOMER_REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    const session = await prisma.customerSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      select: { userId: true, revokedAtUtc: true, expiresAtUtc: true },
    });
    if (
      session &&
      !session.revokedAtUtc &&
      session.expiresAtUtc > new Date()
    ) {
      return { state: "VERIFIED_SESSION", userId: session.userId };
    }
  }

  // 3. Check for a pending registration draft
  const draftId = cookieStore.get(REG_DRAFT_COOKIE)?.value;
  if (draftId) {
    const draft = await prisma.user.findUnique({
      where: { id: draftId, isVerified: false },
      select: { id: true },
    });
    if (draft) {
      return { state: "DRAFT_PENDING_VERIFICATION", draftId: draft.id };
    }
  }

  return { state: "ANONYMOUS" };
}

// ── Page component ────────────────────────────────────────────────────────────
// Only VERIFIED_SESSION state renders the ordering UI (Req #8).
// ANONYMOUS → defaults to Register tab.
// DRAFT_PENDING_VERIFICATION → defaults to Verify tab so the user can resume.

export default async function MenuPage() {
  const authState = await resolveAuthState();

  if (authState.state === "VERIFIED_SESSION") {
    const todayMenu = await getTodayMenu();

    // §8.2: menu not yet in its visibility window — show holding page
    if (todayMenu && (todayMenu as any).menuNotYetVisible === true) {
      const visibleFrom = (todayMenu as any).menuVisibleFrom as string;
      return (
        <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-center gap-4">
          <div className="text-4xl">🕐</div>
          <h1 className="text-xl font-bold text-gray-800">Menu not available yet</h1>
          <p className="text-gray-500 max-w-sm text-sm leading-relaxed">
            The {(todayMenu as any).mealType === "DINNER" ? "dinner" : "lunch"} menu will be available
            from <strong>{visibleFrom} IST</strong> today. Check back soon!
          </p>
        </div>
      );
    }

    return <OrderingExperience userId={authState.userId} menu={todayMenu} />;
  }

  return (
    <AuthTabs
      defaultTab={
        authState.state === "DRAFT_PENDING_VERIFICATION" ? "verify" : "register"
      }
      draftId={
        authState.state === "DRAFT_PENDING_VERIFICATION"
          ? authState.draftId
          : undefined
      }
    />
  );
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

  const menu = await prisma.dailyMenu.findFirst({
    where: {
      date: {
        gte: new Date(dateStr + "T00:00:00.000Z"),
        lt: new Date(dateStr + "T23:59:59.000Z"),
      },
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

  let cutoffTime = menu.cutoffTime;
  if (!cutoffTime && settings?.cutoffTime) {
    const [hours, minutes] = settings.cutoffTime.split(":").map(Number);
    const combined = new Date(menu.date);
    combined.setHours(hours, minutes, 0, 0);
    cutoffTime = combined;
  }

  return {
    ...menu,
    cutoffTime,
    isOrderingOpen: settings ? settings.isOrderingOpen : true,
    menuVisibleFrom: settings?.menuVisibleFrom ?? null,
    menuNotYetVisible: false as const,
  };
}

