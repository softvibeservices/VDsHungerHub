import { NextResponse } from "next/server";

/**
 * Retired legacy /api/orders endpoint. Returning 410 Gone.
 */
export async function GET() {
  return new NextResponse("API deprecated. Use /api/customer/orders.", { status: 410 });
}

export async function POST() {
  return new NextResponse("API deprecated. Use /api/customer/orders.", { status: 410 });
}
