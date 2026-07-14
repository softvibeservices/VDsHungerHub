import { cookies } from "next/headers";
import {
  verifyCustomerAccessToken,
  hashRefreshToken,
  CUSTOMER_ACCESS_COOKIE,
  CUSTOMER_REFRESH_COOKIE,
} from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import UserNavbar from "@/components/customer/UserNavbar";

import { AuthModalProvider } from "@/context/AuthModalContext";

async function resolveNavAuthState() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(CUSTOMER_ACCESS_COOKIE)?.value;
  if (accessToken) {
    const claims = verifyCustomerAccessToken(accessToken);
    if (claims) return { loggedIn: true as const, name: claims.name };
  }
  const refreshToken = cookieStore.get(CUSTOMER_REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const session = await prisma.customerSession.findUnique({
      where: { refreshTokenHash: hashRefreshToken(refreshToken) },
      select: { revokedAtUtc: true, expiresAtUtc: true, user: { select: { name: true } } },
    });
    if (session && !session.revokedAtUtc && session.expiresAtUtc > new Date()) {
      return { loggedIn: true as const, name: session.user.name };
    }
  }
  return { loggedIn: false as const, name: null };
}

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const nav = await resolveNavAuthState();
  return (
    <AuthModalProvider>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
        <UserNavbar loggedIn={nav.loggedIn} userName={nav.name} />
        <main>{children}</main>
      </div>
    </AuthModalProvider>
  );
}
