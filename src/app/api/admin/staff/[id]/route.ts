import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { checkPasswordStrength } from "@/lib/password";
import { verifyStaffSession } from "@/lib/staff-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
    }

    const body = await req.json();
    const { name, permissions, status, tempPassword } = body;

    // Build update object
    const updateData: any = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ error: "Name must be a non-empty string" }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || !permissions.every((p) => typeof p === "string")) {
        return NextResponse.json({ error: "Permissions must be an array of strings" }, { status: 400 });
      }
      updateData.permissions = permissions;
    }

    if (status !== undefined) {
      if (status !== "ACTIVE" && status !== "INACTIVE") {
        return NextResponse.json({ error: "Status must be ACTIVE or INACTIVE" }, { status: 400 });
      }
      updateData.status = status;
    }

    if (tempPassword !== undefined) {
      const check = checkPasswordStrength(tempPassword);
      if (!check.valid) {
        return NextResponse.json({ error: check.errors.join(". ") }, { status: 400 });
      }
      updateData.passwordHash = await hashPassword(tempPassword);
      updateData.passwordSetAt = new Date();
      updateData.mustChangePassword = true;
    }

    // Enforce that role cannot be updated via HTTP request
    if (body.role !== undefined) {
      return NextResponse.json({ error: "Updating role is prohibited via API" }, { status: 400 });
    }

    // Update DB
    const updatedStaff = await prisma.staffUser.update({
      where: { id },
      data: updateData,
    });

    // Write to AdminAuditLog
    await prisma.adminAuditLog.create({
      data: {
        actedByStaffId: session.staffId,
        action: "STAFF_USER_UPDATED",
        targetType: "StaffUser",
        targetId: id,
        metadata: {
          updatedFields: Object.keys(updateData),
          status: updateData.status,
        },
      },
    });

    return NextResponse.json({ staff: updatedStaff });
  } catch (error: any) {
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Staff member not found" }, { status: 404 });
    }
    console.error("[ADMIN STAFF PATCH ID]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
