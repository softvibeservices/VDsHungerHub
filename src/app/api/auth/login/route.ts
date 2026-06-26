import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken, setAuthCookie } from "@/lib/auth";
import { cleanMobileNumber } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const { number, password } = await req.json();

    if (!number || !password) {
      return NextResponse.json(
        { error: "Mobile number and password are required" },
        { status: 400 }
      );
    }

    const cleanNumber = cleanMobileNumber(String(number));

    // Look up in unified AppUser table
    const user = await prisma.appUser.findUnique({
      where: { number: cleanNumber },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid mobile number or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Contact the admin." },
        { status: 403 }
      );
    }

    const passwordValid = await comparePassword(password, user.password);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid mobile number or password" },
        { status: 401 }
      );
    }

    const token = signToken({
      id: user.id,
      number: user.number,
      name: user.name,
      role: user.role,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        number: user.number,
        role: user.role,
      },
      // Legacy compat: some client code references data.admin
      admin: {
        id: user.id,
        name: user.name,
        number: user.number,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
