import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { name, location, isActive } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Company name is required" }, { status: 400 });
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        name: name.trim(),
        location: location?.trim() || null,
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json({ company });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A company with this name already exists" }, { status: 409 });
    }
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    console.error("[COMPANIES PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if company has users
    const userCount = await prisma.user.count({ where: { companyId: id } });
    if (userCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete: this company has ${userCount} user(s). Remove them first.` },
        { status: 409 }
      );
    }

    await prisma.company.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    console.error("[COMPANIES DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
