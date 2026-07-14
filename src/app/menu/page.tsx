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
  const dateStr = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;

  // Determine meal type by IST hour (before 3pm IST → LUNCH)
  const istHour = ist.getUTCHours();
  const mealType = istHour < 15 ? "LUNCH" : "DINNER";

  return prisma.dailyMenu.findFirst({
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
}
