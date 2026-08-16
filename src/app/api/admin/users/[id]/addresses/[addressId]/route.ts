// src\app\api\admin\users\[id]\addresses\[addressId]\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession, hasPermission } from "@/lib/staff-auth";

/**
 * PUT /api/admin/users/[id]/addresses/[addressId]
 * Admin updates a specific address for a user.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || !hasPermission(session, "users:moderate")) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    const { id: userId, addressId } = await params;
    const body = await req.json();
    const { type, line1, line2, landmark, isDefault } = body;

    if (!line1 || typeof line1 !== "string" || line1.trim().length < 5) {
      return NextResponse.json({ error: "Address line 1 must be at least 5 characters" }, { status: 400 });
    }

    const targetAddress = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!targetAddress) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const addressType = (type as "WORK" | "HOME") || targetAddress.type;

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, type: addressType, isDefault: true },
        data: { isDefault: false },
      });
    }

    const formattedAddress = [line1.trim(), line2?.trim(), landmark?.trim()].filter(Boolean).join(", ");

    const updated = await prisma.address.update({
      where: { id: addressId },
      data: {
        type: addressType,
        line1: line1.trim(),
        line2: line2?.trim() || null,
        landmark: landmark?.trim() || null,
        ...(isDefault !== undefined && { isDefault }),
      },
    });

    // Sync primary user address string if default or updated
    if (addressType === "WORK" && (updated.isDefault || targetAddress.isDefault)) {
      await prisma.user.update({ where: { id: userId }, data: { workAddress: formattedAddress } });
    } else if (addressType === "HOME" && (updated.isDefault || targetAddress.isDefault)) {
      await prisma.user.update({ where: { id: userId }, data: { homeAddress: formattedAddress } });
    }

    return NextResponse.json({ success: true, address: updated });
  } catch (error) {
    console.error("[ADMIN USER ADDRESS PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]/addresses/[addressId]
 * Admin deletes a specific address for a user.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; addressId: string }> }
) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || !hasPermission(session, "users:moderate")) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    const { id: userId, addressId } = await params;

    const targetAddress = await prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!targetAddress) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    await prisma.address.delete({ where: { id: addressId } });

    // Sync primary user address string if deleted address was default
    if (targetAddress.isDefault) {
      const remaining = await prisma.address.findFirst({
        where: { userId, type: targetAddress.type },
        orderBy: { createdAt: "asc" },
      });

      if (remaining) {
        await prisma.address.update({ where: { id: remaining.id }, data: { isDefault: true } });
        const formatted = [remaining.line1, remaining.line2, remaining.landmark].filter(Boolean).join(", ");
        if (targetAddress.type === "WORK") {
          await prisma.user.update({ where: { id: userId }, data: { workAddress: formatted } });
        } else {
          await prisma.user.update({ where: { id: userId }, data: { homeAddress: formatted } });
        }
      } else {
        if (targetAddress.type === "WORK") {
          await prisma.user.update({ where: { id: userId }, data: { workAddress: null } });
        } else {
          await prisma.user.update({ where: { id: userId }, data: { homeAddress: null } });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ADMIN USER ADDRESS DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
