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

    const cleanedNumber = cleanMobileNumber(String(number));

    const admin = await prisma.admin.findUnique({
      where: { number: cleanedNumber },
    });

    if (!admin) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const isMatch = await comparePassword(String(password), admin.password);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const token = signToken({
      id: admin.id,
      number: admin.number,
      name: admin.name,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      admin: { id: admin.id, name: admin.name, number: admin.number },
    });
  } catch (error) {
    console.error("[LOGIN ERROR]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
