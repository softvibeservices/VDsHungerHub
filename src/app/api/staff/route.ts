import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const isActiveParam = searchParams.get("isActive");

    const where: Record<string, unknown> = {};
    if (isActiveParam !== null && isActiveParam !== "") {
      where.isActive = isActiveParam === "true";
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { number: { contains: search } },
      ];
    }

    const staff = await prisma.staff.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("[STAFF GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, number, password } = await req.json();
    const cleanNumber = number?.replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!cleanNumber || !/^\d{10}$/.test(cleanNumber))
      return NextResponse.json({ error: "Valid 10-digit mobile number is required" }, { status: 400 });
    if (!password || password.length < 6)
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });

    const hashedPassword = await hashPassword(password);

    // Create Staff record
    const staff = await prisma.staff.create({
      data: { name: name.trim(), number: cleanNumber },
    });

    // Also create AppUser for login
    await prisma.appUser.upsert({
      where: { number: cleanNumber },
      update: { name: name.trim(), isActive: true },
      create: {
        name: name.trim(),
        number: cleanNumber,
        password: hashedPassword,
        role: "STAFF",
      },
    });

    return NextResponse.json({ staff }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A staff member with this number already exists" }, { status: 409 });
    }
    console.error("[STAFF POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
