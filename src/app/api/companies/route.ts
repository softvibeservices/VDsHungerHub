import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const tab = searchParams.get("tab") ?? ""; // "verified" | "pending" | "flagged" | ""
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "50");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (tab === "verified") {
      where.isVerifiedByAdmin = true;
      where.isFlaggedFake = false;
    } else if (tab === "pending") {
      where.isVerifiedByAdmin = false;
      where.isFlaggedFake = false;
    } else if (tab === "flagged") {
      where.isFlaggedFake = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" as const } },
        { location: { contains: search, mode: "insensitive" as const } },
      ];
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          _count: { select: { users: true } },
          addedByUser: { select: { id: true, name: true, number: true, workAddress: true } },
        },
      }),
      prisma.company.count({ where }),
    ]);

    return NextResponse.json({ companies, total });
  } catch (error) {
    console.error("[COMPANIES GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const { name, location } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const company = await prisma.company.create({
      data: { name: name.trim(), location: location?.trim() || null },
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A company with this name already exists" }, { status: 409 });
    }
    console.error("[COMPANIES POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
