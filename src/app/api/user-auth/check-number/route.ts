import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/user-auth/check-number
 *
 * Checks if a mobile number is registered and active.
 * Does NOT send an OTP — that happens client-side via Firebase SDK.
 * Returns { found: true, name } or { found: false }.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const normalized = String(body.number ?? "")
    .replace(/\D/g, "")
    .slice(-10);

  if (normalized.length !== 10) {
    return NextResponse.json(
      { error: "Invalid mobile number — must be 10 digits" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { number: normalized },
    select: { id: true, isActive: true, name: true },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ found: false }, { status: 200 });
  }

  return NextResponse.json({ found: true, name: user.name }, { status: 200 });
}
