import { NextResponse } from "next/server";

/**
 * Retired legacy /api/user-auth/me endpoint. Returning 410 Gone.
 */
export async function GET() {
  return new NextResponse("API deprecated. Use /api/customer/me.", { status: 410 });
}
