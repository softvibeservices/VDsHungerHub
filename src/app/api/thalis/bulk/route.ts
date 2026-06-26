import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { thalis } = await req.json();
    if (!Array.isArray(thalis)) {
      return NextResponse.json({ error: "Thalis array is required" }, { status: 400 });
    }

    let created = 0;
    let updated = 0;

    for (const item of thalis) {
      const { name, nameGu, price, maxSabjiCount, description, items: fixedItems } = item;
      if (!name?.trim()) continue;

      const existing = await prisma.thali.findUnique({
        where: { name: name.trim() },
      });

      const parsedItems = Array.isArray(fixedItems)
        ? fixedItems
        : typeof fixedItems === "string"
        ? fixedItems.split(";").map((i) => i.trim()).filter(Boolean)
        : [];

      if (existing) {
        await prisma.$transaction(async (tx: any) => {
          if (parsedItems.length > 0) {
            await tx.thaliItem.deleteMany({ where: { thaliId: existing.id } });
          }

          await tx.thali.update({
            where: { id: existing.id },
            data: {
              nameGu: nameGu?.trim() || existing.nameGu,
              price: price !== undefined ? Number(price) : existing.price,
              maxSabjiCount: maxSabjiCount !== undefined ? Number(maxSabjiCount) : existing.maxSabjiCount,
              description: description?.trim() || existing.description,
              ...(parsedItems.length > 0 && {
                items: {
                  create: parsedItems.map((itemName, idx) => ({
                    itemName,
                    sortOrder: idx,
                  })),
                },
              }),
            },
          });
        });
        updated++;
      } else {
        await prisma.thali.create({
          data: {
            name: name.trim(),
            nameGu: nameGu?.trim() || null,
            price: price !== undefined ? Number(price) : 0,
            maxSabjiCount: maxSabjiCount !== undefined ? Number(maxSabjiCount) : 1,
            description: description?.trim() || null,
            items: {
              create: parsedItems.map((itemName, idx) => ({
                itemName,
                sortOrder: idx,
              })),
            },
          },
        });
        created++;
      }
    }

    return NextResponse.json({ created, updated, skipped: thalis.length - (created + updated) });
  } catch (error) {
    console.error("[THALIS BULK POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
