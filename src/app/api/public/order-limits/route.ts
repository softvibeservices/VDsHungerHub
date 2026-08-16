// src\app\api\public\order-limits\route.ts

import { NextResponse } from "next/server";
import { getAllOrderAndAddressLimits } from "@/lib/address-settings";

/**
 * GET /api/public/order-limits
 * Returns current global order and address limits configured by admin.
 */
export async function GET() {
  try {
    const limits = await getAllOrderAndAddressLimits();
    return NextResponse.json(limits);
  } catch (error) {
    console.error("[PUBLIC ORDER LIMITS GET]", error);
    return NextResponse.json(
      {
        addressLimit: 5,
        thaliLimit: 10,
        addonLimit: 30,
      },
      { status: 500 }
    );
  }
}
