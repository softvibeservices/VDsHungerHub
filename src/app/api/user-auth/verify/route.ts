import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFirebaseAdmin } from "@/lib/firebase-admin";
import { signUserToken } from "@/lib/user-auth";

/**
 * POST /api/user-auth/verify
 *
 * Receives a Firebase ID token (from client OTP verification) and:
 * 1. Verifies it with Firebase Admin SDK
 * 2. Looks up the user in our DB by phone number
 * 3. Stores the device fingerprint in UserDevice
 * 4. Mints and returns a 180-day JWT for localStorage storage
 */
export async function POST(req: NextRequest) {
  const { idToken, deviceHash } = await req.json();

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "idToken required" }, { status: 400 });
  }

  // 1. Verify Firebase ID token
  let phoneNumber: string;
  try {
    const adminAuth = getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(idToken);
    phoneNumber = decoded.phone_number ?? "";
  } catch {
    return NextResponse.json(
      { error: "Invalid or expired OTP token" },
      { status: 401 }
    );
  }

  // 2. Normalize phone number (Firebase sends +91XXXXXXXXXX)
  const normalized = phoneNumber.replace(/\D/g, "").slice(-10);

  if (normalized.length !== 10) {
    return NextResponse.json(
      { error: "Could not extract phone number from token" },
      { status: 400 }
    );
  }

  // 3. Look up user in DB
  const user = await prisma.user.findUnique({
    where: { number: normalized },
    include: { company: { select: { id: true, name: true } } },
  });

  if (!user || !user.isActive) {
    return NextResponse.json(
      { error: "Your number is not registered. Please contact admin." },
      { status: 403 }
    );
  }

  // 4. Store or update device fingerprint
  if (deviceHash && typeof deviceHash === "string" && deviceHash.length === 64) {
    await prisma.userDevice.upsert({
      where: { userId_deviceHash: { userId: user.id, deviceHash } },
      update: { lastSeenAt: new Date() },
      create: { userId: user.id, deviceHash },
    });
  }

  // 5. Mint 180-day user JWT
  const token = signUserToken({
    sub: user.id,
    number: user.number,
    name: user.name,
    companyId: user.company.id,
    companyName: user.company.name,
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      number: user.number,
      companyName: user.company.name,
    },
  });
}
