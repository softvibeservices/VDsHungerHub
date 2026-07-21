import { NextRequest, NextResponse } from "next/server";
import { verifyStaffSession } from "@/lib/staff-auth";

export async function GET(req: NextRequest) {
  const session = await verifyStaffSession(req);
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: {
      id: session.staffId,
      name: session.name,
      mobile: session.mobile,
      number: session.mobile,
      role: session.role,
      permissions: session.permissions,
    },
  });
}
