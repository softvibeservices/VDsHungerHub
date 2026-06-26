import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
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
              },
            },
          },
        },
        sabjiOptions: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!menu) {
      return NextResponse.json({ error: "Menu not found" }, { status: 404 });
    }

    return NextResponse.json({ menu });
  } catch (error) {
    console.error("[PUBLIC MENU GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
