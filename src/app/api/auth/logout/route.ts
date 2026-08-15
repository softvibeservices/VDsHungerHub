// src\app\api\auth\logout\route.ts

import { NextResponse } from "next/server";
import { clearStaffSessionCookie } from "@/lib/staff-auth";

export async function POST() {
  await clearStaffSessionCookie();
  return NextResponse.json({ success: true });
}
