import { NextRequest, NextResponse } from "next/server";
import { verifyUserToken } from "@/lib/user-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/user-auth/me?deviceHash=<hash>
 *
 * Validates the stored JWT and optionally checks if this device is known.
 * If the JWT is valid but the device is new, returns { newDevice: true }
 * so the client knows to run OTP again on this specific device.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace("Bearer ", "").trim();

  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const payload = verifyUserToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Re-verify user is still active in DB
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { company: { select: { id: true, name: true } } },
  });

  if (!user || !user.isActive) {
    return NextResponse.json({ error: "Account deactivated" }, { status: 403 });
  }

  // Check device fingerprint (new device scenario)
  const deviceHash = req.nextUrl.searchParams.get("deviceHash");
  if (deviceHash && deviceHash.length === 64) {
    const deviceExists = await prisma.userDevice.findUnique({
      where: { userId_deviceHash: { userId: user.id, deviceHash } },
    });

    if (!deviceExists) {
      // Valid JWT but new/unknown device — require OTP on this device too
      return NextResponse.json({ newDevice: true }, { status: 200 });
    }

    // Update lastSeen timestamp
    await prisma.userDevice.update({
      where: { userId_deviceHash: { userId: user.id, deviceHash } },
      data: { lastSeenAt: new Date() },
    });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    number: user.number,
    companyName: user.company.name,
    newDevice: false,
  });
}
