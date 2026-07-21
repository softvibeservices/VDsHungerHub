import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { checkPasswordStrength } from "@/lib/password";
import { verifyStaffSession } from "@/lib/staff-auth";

function normalizeMobile(raw: string): string {
  const clean = String(raw).replace(/\s+/g, "").replace(/^\+91/, "").replace(/^0/, "");
  if (!/^[6-9]\d{9}$/.test(clean)) {
    throw new Error("Invalid mobile format");
  }
  return clean;
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";
    const statusParam = searchParams.get("status"); // "ACTIVE" | "INACTIVE"

    const where: any = {};
    if (statusParam === "ACTIVE" || statusParam === "INACTIVE") {
      where.status = statusParam;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
      ];
    }

    const staff = await prisma.staffUser.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ staff });
  } catch (error) {
    console.error("[ADMIN STAFF GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
    }

    const { name, mobile: rawMobile, permissions = [], tempPassword } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    let mobile: string;
    try {
      mobile = normalizeMobile(rawMobile);
    } catch {
      return NextResponse.json(
        { error: "Valid 10-digit Indian mobile number is required" },
        { status: 400 }
      );
    }

    // Validate permissions array format
    if (!Array.isArray(permissions) || !permissions.every((p) => typeof p === "string")) {
      return NextResponse.json({ error: "Permissions must be an array of strings" }, { status: 400 });
    }

    const createData: any = {
      name: name.trim(),
      mobile,
      role: "STAFF",
      status: "ACTIVE",
      permissions,
      createdByAdminId: session.staffId,
    };

    if (tempPassword) {
      const check = checkPasswordStrength(tempPassword);
      if (!check.valid) {
        return NextResponse.json({ error: check.errors.join(". ") }, { status: 400 });
      }
      createData.passwordHash = await hashPassword(tempPassword);
      createData.passwordSetAt = new Date();
      createData.mustChangePassword = true;
    }

    // Create the StaffUser
    const staff = await prisma.staffUser.create({
      data: createData,
    });

    return NextResponse.json({ staff }, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "A staff member with this mobile number already exists" }, { status: 409 });
    }
    console.error("[ADMIN STAFF POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
