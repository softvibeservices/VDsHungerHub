import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, formatRateLimitWaitTime } from "@/lib/customer-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = getClientIp(req);
    // Rate limit: 60 requests per minute per IP
    await checkRateLimit("IP", ip, "PUBLIC_API_REQUEST", 60 * 1000, 60);

    const { slug } = await params;

    const menu = await prisma.dailyMenu.findUnique({
      where: { publicSlug: slug },
      include: {
        thalis: {
          include: {
            thali: {
              include: {
                items: { orderBy: { sortOrder: "asc" } },
                sabjiPool: {
                  include: {
                    product: true,
                  },
                },
                category: true,
              },
            },
          },
        },
        sabjiOptions: {
          include: {
            product: true,
            category: true,
          },
        },
      },
    });

    if (!menu) {
      return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    }

    // Fetch MealSettings for this menu's mealType — used by the public page
    // to evaluate the isOrderingOpen kill-switch and menuVisibleFrom window
    const mealSettings = await prisma.mealSettings.findUnique({
      where: { mealType: menu.mealType },
      select: {
        cutoffTime: true,
        menuVisibleFrom: true,
        isOrderingOpen: true,
      },
    });

    // Fetch all active add-on products (available for all menus)
    const addOns = await prisma.product.findMany({
      where: { isActive: true, isAddOnAvailable: true },
      select: {
        id: true,
        name: true,
        nameGu: true,
        price: true,
        quantity: true,
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ menu, addOns, mealSettings });
  } catch (error: any) {
    if (error?.name === "RateLimitExceededError") {
      const waitTime = error.waitTimeMs ? formatRateLimitWaitTime(error.waitTimeMs) : "some time";
      return NextResponse.json(
        { error: `Too many requests. Please try again after ${waitTime}.` },
        { status: 429 }
      );
    }
    console.error("[PUBLIC MENU GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
