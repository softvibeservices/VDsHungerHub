import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const companyId = searchParams.get("companyId") ?? "";
    const isVerifiedParam = searchParams.get("isVerified"); // "true" | "false" | null
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (companyId) where.companyId = companyId;
    if (isVerifiedParam !== null) where.isVerified = isVerifiedParam === "true";
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { number: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          company: { select: { id: true, name: true } },
          _count: { select: { deviceFingerprints: true } },
        },
        // Select verifiedAt, workAddress (not lat/long)
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({ users, total });
  } catch (error) {
    console.error("[USERS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, number, companyId } = await req.json();
    const cleanNumber = number?.replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!cleanNumber || !/^\d{10}$/.test(cleanNumber))
      return NextResponse.json({ error: "Valid 10-digit mobile number is required" }, { status: 400 });
    if (!companyId) return NextResponse.json({ error: "Company is required" }, { status: 400 });

    const user = await prisma.user.create({
      data: { name: name.trim(), number: cleanNumber, companyId },
      include: { company: { select: { id: true, name: true } } },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A user with this mobile number already exists" }, { status: 409 });
    }
    console.error("[USERS POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
