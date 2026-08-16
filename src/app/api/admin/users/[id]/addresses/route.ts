// src\app\api\admin\users\[id]\addresses\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession, hasPermission } from "@/lib/staff-auth";

/**
 * GET /api/admin/users/[id]/addresses
 * Returns all saved addresses for a specific user.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || !hasPermission(session, "users:moderate")) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    const { id: userId } = await params;

    const addresses = await prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error("[ADMIN USER ADDRESSES GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/users/[id]/addresses
 * Admin creates a new address for a specific user.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || !hasPermission(session, "users:moderate")) {
      return NextResponse.json({ error: "Forbidden: Access denied" }, { status: 403 });
    }

    const { id: userId } = await params;
    const body = await req.json();
    const { type, line1, line2, landmark, setAsDefault = false } = body;

    if (!type || !["WORK", "HOME"].includes(type)) {
      return NextResponse.json({ error: "type must be WORK or HOME" }, { status: 400 });
    }
    if (!line1 || typeof line1 !== "string" || line1.trim().length < 5) {
      return NextResponse.json({ error: "Address line 1 must be at least 5 characters" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.address.findFirst({
      where: { userId, type: type as "WORK" | "HOME" },
      select: { id: true },
    });

    const shouldBeDefault = setAsDefault || !existing;

    if (shouldBeDefault) {
      await prisma.address.updateMany({
        where: { userId, type: type as "WORK" | "HOME", isDefault: true },
        data: { isDefault: false },
      });
    }

    const formattedAddress = [line1.trim(), line2?.trim(), landmark?.trim()].filter(Boolean).join(", ");

    const address = await prisma.address.create({
      data: {
        userId,
        type: type as "WORK" | "HOME",
        line1: line1.trim(),
        line2: line2?.trim() || null,
        landmark: landmark?.trim() || null,
        isDefault: shouldBeDefault,
      },
    });

    // Sync primary user address string
    if (type === "WORK" && (shouldBeDefault || !existing)) {
      await prisma.user.update({ where: { id: userId }, data: { workAddress: formattedAddress } });
    } else if (type === "HOME" && (shouldBeDefault || !existing)) {
      await prisma.user.update({ where: { id: userId }, data: { homeAddress: formattedAddress } });
    }

    return NextResponse.json({ success: true, address }, { status: 201 });
  } catch (error) {
    console.error("[ADMIN USER ADDRESSES POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
