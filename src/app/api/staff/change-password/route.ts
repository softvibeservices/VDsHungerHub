// src\app\api\staff\change-password\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, comparePassword } from "@/lib/auth";
import { checkPasswordStrength } from "@/lib/password";
import { verifyStaffSession } from "@/lib/staff-auth";

export async function POST(req: NextRequest) {
  try {
    const session = await verifyStaffSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword, confirmPassword } = await req.json();

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Current password, new password, and confirmation are all required." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: "New passwords do not match." }, { status: 400 });
    }

    const staff = await prisma.staffUser.findUnique({ where: { id: session.staffId } });
    if (!staff) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    if (!staff.passwordHash) {
      return NextResponse.json(
        { error: "No password is set on this account yet. Contact an administrator." },
        { status: 400 }
      );
    }

    const currentValid = await comparePassword(currentPassword, staff.passwordHash);
    if (!currentValid) {
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    const check = checkPasswordStrength(newPassword);
    if (!check.valid) {
      return NextResponse.json({ error: check.errors.join(". ") }, { status: 400 });
    }

    const sameAsOld = await comparePassword(newPassword, staff.passwordHash);
    if (sameAsOld) {
      return NextResponse.json(
        { error: "New password must be different from your current password." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.staffUser.update({
      where: { id: session.staffId },
      data: { passwordHash, passwordSetAt: new Date(), mustChangePassword: false },
    });

    return NextResponse.json({ success: true, message: "Password updated successfully." });
  } catch (error) {
    console.error("[STAFF CHANGE PASSWORD ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
