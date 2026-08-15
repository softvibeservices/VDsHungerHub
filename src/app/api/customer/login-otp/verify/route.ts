// src\app\api\customer\login-otp\verify\route.ts

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "OTP login is disabled. Please log in with your PIN or use Forgot PIN to reset your PIN." },
    { status: 400 }
  );
}
