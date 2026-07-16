import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyCustomerAccessToken,
  CUSTOMER_ACCESS_COOKIE,
  checkUserAndDeviceStatus,
  checkRateLimit,
  getClientIp,
  formatRateLimitWaitTime,
} from "@/lib/customer-auth";

/**
 * GET /api/customer/addresses
 * Returns the authenticated user's saved addresses.
 *
 * POST /api/customer/addresses
 * Creates a new address (WORK or HOME) for the authenticated user.
 * Body: { type: "WORK"|"HOME", line1, line2?, landmark?, city?, pincode?, setAsDefault? }
 */

async function getAuth(req: NextRequest) {
  const token = req.cookies.get(CUSTOMER_ACCESS_COOKIE)?.value;
  if (!token) return null;
  const claims = verifyCustomerAccessToken(token);
  if (!claims) return null;
  return claims;
}

export async function GET(req: NextRequest) {
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

    const addresses = await prisma.address.findMany({
      where: { userId: claims.sub },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
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

    return NextResponse.json({ addresses });
  } catch (error) {
    console.error("[CUSTOMER ADDRESSES GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
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

    // Rate limit per IP to prevent spamming address creation
    const ip = getClientIp(req);
    try {
      await checkRateLimit("IP", ip, "ADD_ADDRESS", 10 * 60 * 1000, 10);
    } catch (error: any) {
      if (error?.name === "RateLimitExceededError") {
        const waitTime = error.waitTimeMs ? formatRateLimitWaitTime(error.waitTimeMs) : "some time";
        return NextResponse.json(
          { error: `Too many attempts. Please try again after ${waitTime}.` },
          { status: 429 }
        );
      }
      throw error;
    }

    const body = await req.json();
    const { type, line1, line2, landmark, city, pincode, setAsDefault = false } = body;

    if (!type || !["WORK", "HOME"].includes(type)) {
      return NextResponse.json(
        { error: "type must be WORK or HOME" },
        { status: 400 }
      );
    }

    if (!line1 || typeof line1 !== "string" || line1.trim().length < 5) {
      return NextResponse.json(
        { error: "line1 is required and must be at least 5 characters" },
        { status: 400 }
      );
    }

    const userId = claims.sub;

    // If setAsDefault or it's the first address of that type, auto-set as default
    const existing = await prisma.address.findFirst({
      where: { userId, type: type as "WORK" | "HOME" },
      select: { id: true },
    });

    const shouldBeDefault = setAsDefault || !existing;

    // If setting as default, clear existing defaults of same type
    if (shouldBeDefault) {
      await prisma.address.updateMany({
        where: { userId, type: type as "WORK" | "HOME", isDefault: true },
        data: { isDefault: false },
      });
    }

    const address = await prisma.address.create({
      data: {
        userId,
        type: type as "WORK" | "HOME",
        line1: line1.trim(),
        line2: line2?.trim() || null,
        landmark: landmark?.trim() || null,
        city: city?.trim() || null,
        pincode: pincode?.trim() || null,
        isDefault: shouldBeDefault,
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

    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    console.error("[CUSTOMER ADDRESSES POST]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
