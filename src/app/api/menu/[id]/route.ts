import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateSabjiCoverage } from "@/lib/menu-validation";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { cutoffTime, thaliIds, thaliConfig, sabjiOptions } = await req.json();

    const existingMenu = await prisma.dailyMenu.findUnique({ where: { id } });
    if (!existingMenu) return NextResponse.json({ error: "Menu not found" }, { status: 404 });

    const menuDateStr = existingMenu.date.toISOString().split("T")[0];
    const now = new Date();
    const ist = new Date(now.getTime() + 330 * 60 * 1000);
    const todayStr = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(
      ist.getUTCDate()
    ).padStart(2, "0")}`;
    if (menuDateStr < todayStr) {
      return NextResponse.json({ error: "Cannot edit a menu for a past date" }, { status: 400 });
    }

    interface MenuThaliInput {
      thaliId: string;
      minSabjiRequired?: number;
    }
    const resolvedConfig: MenuThaliInput[] = thaliConfig
      ? thaliConfig
      : (thaliIds || []).map((thaliId: string) => ({ thaliId }));

    // Fetch full thali records (incl. category) — needed for both the
    // sabjiCount cap AND the new dish-coverage validation below.
    const thalisFromDb = await prisma.thali.findMany({
      where: { id: { in: resolvedConfig.map((t) => t.thaliId) } },
      include: { category: true },
    });
    const sabjiCountMap = new Map<string, number>(thalisFromDb.map((t: { id: string; sabjiCount: number }) => [t.id, t.sabjiCount]));

    const clampedThaliConfig = resolvedConfig.map(({ thaliId, minSabjiRequired }) => {
      const cap = sabjiCountMap.get(thaliId) ?? 1;
      return { thaliId, minSabjiRequired: Math.min(minSabjiRequired ?? cap, cap) };
    });

    const sabjiOptionsInput = (sabjiOptions ?? []) as { categoryId: string; productIds: string[] }[];

    // ── NEW: server-side dish-coverage validation (safety net, mirrors the client) ──
    const validation = validateSabjiCoverage(thalisFromDb, clampedThaliConfig, sabjiOptionsInput);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: "This menu can't be published yet — some dishes are missing.",
          issues: validation.issues,
        },
        { status: 400 }
      );
    }
    // ── end validation block ──

    // Convert cutoffTime from IST "HH:MM" to UTC DateTime
    let cutoffTimeUTC: Date | null = null;
    if (cutoffTime && typeof cutoffTime === "string" && cutoffTime.includes(":")) {
      const menuDateIST = existingMenu.date.toISOString().split("T")[0];
      const { istTimeToUTC } = await import("@/lib/time");
      cutoffTimeUTC = istTimeToUTC(cutoffTime, menuDateIST);
    }

    // Delete existing relations
    await prisma.dailyMenuThali.deleteMany({ where: { menuId: id } });
    await prisma.dailyMenuSabjiOption.deleteMany({ where: { menuId: id } });

    const menu = await prisma.dailyMenu.update({
      where: { id },
      data: {
        cutoffTime: cutoffTimeUTC,
        thalis: { create: clampedThaliConfig },
        sabjiOptions: {
          create: sabjiOptionsInput.flatMap(({ categoryId, productIds }) =>
            productIds.map((productId) => ({ categoryId, productId }))
          ),
        },
      },
      include: {
        thalis: { include: { thali: true } },
        sabjiOptions: { include: { product: true, category: true } },
      },
    });

    return NextResponse.json({ menu });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    }
    console.error("[MENU PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.dailyMenu.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    }
    console.error("[MENU DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const menu = await prisma.dailyMenu.findUnique({
      where: { id },
      include: {
        thalis: { include: { thali: { include: { items: true } } } },
        sabjiOptions: { include: { product: true, category: true } },
      },
    });
    if (!menu) return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    return NextResponse.json({ menu });
  } catch (error) {
    console.error("[MENU ID GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
