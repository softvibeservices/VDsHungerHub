import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { cutoffTime, thaliIds, sabjiOptions, isPublished } = await req.json();

    const existingMenu = await prisma.dailyMenu.findUnique({ where: { id } });
    if (!existingMenu) return NextResponse.json({ error: "Menu not found" }, { status: 404 });

    const menuDateStr = existingMenu.date.toISOString().split("T")[0];
    const now = new Date();
    const ist = new Date(now.getTime() + 330 * 60 * 1000);
    const todayStr = `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
    if (menuDateStr < todayStr) {
      return NextResponse.json({ error: "Cannot edit a menu for a past date" }, { status: 400 });
    }

    // Fetch the thalis to get their maxSabjiCount
    const thalisFromDb = await prisma.thali.findMany({
      where: { id: { in: thaliIds } },
    });
    const thaliMap = new Map(thalisFromDb.map((t: any) => [t.id, t.maxSabjiCount]));

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
        ...(isPublished !== undefined && { isPublished }),
        thalis: {
          create: (thaliIds as string[]).map((thaliId) => ({
            thaliId,
            minSabjiRequired: thaliMap.get(thaliId) ?? 1,
          })),
        },
        sabjiOptions: {
          create: (sabjiOptions as { thaliId: string; productIds: string[] }[]).flatMap(
            ({ thaliId, productIds }) =>
              productIds.map((productId) => ({ thaliId, productId }))
          ),
        },
      },
      include: {
        thalis: { include: { thali: true } },
        sabjiOptions: { include: { product: true, thali: true } },
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
        sabjiOptions: { include: { product: true, thali: true } },
      },
    });
    if (!menu) return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    return NextResponse.json({ menu });
  } catch (error) {
    console.error("[MENU ID GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
