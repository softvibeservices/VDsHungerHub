import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { checkPasswordStrength } from "@/lib/password";
import { verifyStaffSession } from "@/lib/staff-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyStaffSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { password, confirmPassword } = await req.json();

    if (!password || !confirmPassword) {
      return NextResponse.json({ error: "Password and confirm password are required" }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match" }, { status: 400 });
    }

    const check = checkPasswordStrength(password);
    if (!check.valid) {
      return NextResponse.json({ error: check.errors.join(". ") }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    await prisma.staffUser.update({
      where: { id: session.staffId },
      data: { passwordHash, passwordSetAt: new Date(), mustChangePassword: false },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("[STAFF SET PASSWORD ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
