import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, number, isActive } = await req.json();
    const cleanNumber = number?.replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");

    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!cleanNumber || !/^\d{10}$/.test(cleanNumber))
      return NextResponse.json({ error: "Valid 10-digit mobile number is required" }, { status: 400 });

    const staff = await prisma.staff.update({
      where: { id },
      data: {
        name: name.trim(),
        number: cleanNumber,
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ staff });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Mobile number already in use" }, { status: 409 });
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
    console.error("[STAFF PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.staff.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
    console.error("[STAFF DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
