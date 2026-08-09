import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyCustomerAccessToken,
  CUSTOMER_ACCESS_COOKIE,
  checkUserAndDeviceStatus,
} from "@/lib/customer-auth";

async function getAuth(req: NextRequest) {
  const token = req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
  if (!token) return null;
  const claims = verifyCustomerAccessToken(token);
  if (!claims) return null;
  return claims;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const claims = await getAuth(req);
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const statusCheck = await checkUserAndDeviceStatus(claims.sub, claims.fph);
    if (!statusCheck.allowed) {
      return NextResponse.json(
        { error: statusCheck.message, code: statusCheck.code },
        { status: 403 }
      );
    }

    const { id } = await params;
    const userId = claims.sub;

    const existing = await prisma.address.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    const body = await req.json();
    const { type, line1, line2, landmark, city, pincode, isDefault } = body;

    if (line1 !== undefined && (typeof line1 !== "string" || line1.trim().length < 5)) {
      return NextResponse.json(
        { error: "line1 must be at least 5 characters" },
        { status: 400 }
      );
    }

    const targetType = type && ["WORK", "HOME"].includes(type) ? type : existing.type;

    if (isDefault) {
      await prisma.address.updateMany({
        where: { userId, type: targetType, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.address.update({
      where: { id },
      data: {
        ...(type && ["WORK", "HOME"].includes(type) ? { type } : {}),
        ...(line1 !== undefined ? { line1: line1.trim() } : {}),
        ...(line2 !== undefined ? { line2: line2?.trim() || null } : {}),
        ...(landmark !== undefined ? { landmark: landmark?.trim() || null } : {}),
        ...(city !== undefined ? { city: city?.trim() || null } : {}),
        ...(pincode !== undefined ? { pincode: pincode?.trim() || null } : {}),
        ...(isDefault !== undefined ? { isDefault: Boolean(isDefault) } : {}),
      },
      select: {
        id: true,
        type: true,
        line1: true,
        line2: true,
        landmark: true,
        city: true,
        pincode: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ address: updated });
  } catch (error) {
    console.error("[CUSTOMER ADDRESS PATCH]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const claims = await getAuth(req);
    if (!claims) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const statusCheck = await checkUserAndDeviceStatus(claims.sub, claims.fph);
    if (!statusCheck.allowed) {
      return NextResponse.json(
        { error: statusCheck.message, code: statusCheck.code },
        { status: 403 }
      );
    }

    const { id } = await params;
    const userId = claims.sub;

    const existing = await prisma.address.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Address not found" }, { status: 404 });
    }

    await prisma.address.delete({
      where: { id },
    });

    // If deleted address was default, make the most recent remaining address default
    if (existing.isDefault) {
      const nextAddress = await prisma.address.findFirst({
        where: { userId, type: existing.type },
        orderBy: { createdAt: "desc" },
      });
      if (nextAddress) {
        await prisma.address.update({
          where: { id: nextAddress.id },
          data: { isDefault: true },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CUSTOMER ADDRESS DELETE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
