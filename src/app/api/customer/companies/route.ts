// src\app\api\customer\companies\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, getClientIp, formatRateLimitWaitTime } from "@/lib/customer-auth";

/**
 * GET /api/customer/companies
 * Returns only CONFIRMED companies, alphabetical, for the registration dropdown.
 * Never leaks PENDING companies. Protected by IP rate limiting.
 */
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    // Rate limit: 60 requests per minute per IP
    await checkRateLimit("IP", ip, "PUBLIC_API_REQUEST", 60 * 1000, 60);

    const companies = await prisma.company.findMany({
      where: { isVerifiedByAdmin: true, isFlaggedFake: false, isActive: true },
      select: { id: true, name: true, address: true, location: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ companies });
  } catch (error: any) {
    if (error?.name === "RateLimitExceededError") {
      const waitTime = error.waitTimeMs ? formatRateLimitWaitTime(error.waitTimeMs) : "some time";
      return NextResponse.json(
        { error: `Too many requests. Please try again after ${waitTime}.` },
        { status: 429 }
      );
    }
    console.error("[CUSTOMER COMPANIES GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
