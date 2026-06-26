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

    // Sync AppUser name/active status
    await prisma.appUser.updateMany({
      where: { number: staff.number },
      data: {
        name: name.trim(),
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
    const staff = await prisma.staff.findUnique({ where: { id } });

    await prisma.staff.delete({ where: { id } });

    // Deactivate matching AppUser rather than deleting
    if (staff) {
      await prisma.appUser.updateMany({
        where: { number: staff.number, role: "STAFF" },
        data: { isActive: false },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
    console.error("[STAFF DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { isActive } = await req.json();

    if (typeof isActive !== "boolean") {
      return NextResponse.json({ error: "isActive must be a boolean" }, { status: 400 });
    }

    const staff = await prisma.staff.update({
      where: { id },
      data: { isActive },
    });

    // Sync AppUser active status
    await prisma.appUser.updateMany({
      where: { number: staff.number, role: "STAFF" },
      data: { isActive },
    });

    return NextResponse.json({ staff });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
    console.error("[STAFF PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
