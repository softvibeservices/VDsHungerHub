import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { cutoffTime, thaliIds, sabjiOptions, isPublished } = await req.json();

    // Delete existing relations
    await prisma.dailyMenuThali.deleteMany({ where: { menuId: id } });
    await prisma.dailyMenuSabjiOption.deleteMany({ where: { menuId: id } });

    const menu = await prisma.dailyMenu.update({
      where: { id },
      data: {
        cutoffTime: cutoffTime || null,
        ...(isPublished !== undefined && { isPublished }),
        thalis: {
          create: (thaliIds as string[]).map((thaliId) => ({ thaliId })),
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
