import { NextRequest, NextResponse } from "next/server";
import { verifyStaffSession } from "@/lib/staff-auth";

export async function GET(req: NextRequest) {
  const session = await verifyStaffSession(req);
  if (!session) {
    // Return 200 with user: null — the staff-login page uses this to
    // check whether someone is already logged in, and a 401 would cause
    // noisy console errors on every visit to the login page.
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: {
      id: session.staffId,
      name: session.name,
      mobile: session.mobile,
      role: session.role,
      permissions: session.permissions,
    },
  });
}
