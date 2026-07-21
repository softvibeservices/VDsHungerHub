import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      error: "This login endpoint has been deprecated. Please use /api/staff/login-password or /api/staff/otp/send.",
    },
    { status: 410 }
  );
}
