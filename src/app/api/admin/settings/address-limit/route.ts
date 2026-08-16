// src\app\api\admin\settings\address-limit\route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyStaffSession } from "@/lib/staff-auth";
import {
  getAllOrderAndAddressLimits,
  invalidateLimitsCache,
  MAX_SAVED_ADDRESSES_SETTING_KEY,
  MAX_THALI_PER_ORDER_SETTING_KEY,
  MAX_ADDON_PER_ORDER_SETTING_KEY,
} from "@/lib/address-settings";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
    }
    const data = await getAllOrderAndAddressLimits();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[ADMIN LIMITS GET]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await verifyStaffSession(req);
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden: Admin access only" }, { status: 403 });
    }

    const body = await req.json();
    const { addressLimit, thaliLimit, addonLimit } = body;

    const updates: Promise<any>[] = [];
    const auditLogs: any[] = [];
    const responsePayload: Record<string, number> = {};

    // Validate and update Address Limit if provided
    if (addressLimit !== undefined) {
      const numAddress = parseInt(addressLimit, 10);
      if (!Number.isInteger(numAddress) || numAddress < 5 || numAddress > 20) {
        return NextResponse.json(
          { error: "Address limit must be an integer between 5 and 20." },
          { status: 400 }
        );
      }
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: MAX_SAVED_ADDRESSES_SETTING_KEY },
          update: { value: String(numAddress) },
          create: { key: MAX_SAVED_ADDRESSES_SETTING_KEY, value: String(numAddress) },
        })
      );
      auditLogs.push(
        prisma.adminAuditLog.create({
          data: {
            actedByStaffId: session.staffId,
            action: "ADDRESS_LIMIT_GLOBAL_UPDATED",
            targetType: "SystemSetting",
            targetId: MAX_SAVED_ADDRESSES_SETTING_KEY,
            metadata: { newLimit: numAddress },
          },
        })
      );
      responsePayload.addressLimit = numAddress;
    }

    // Validate and update Thali Limit if provided
    if (thaliLimit !== undefined) {
      const numThali = parseInt(thaliLimit, 10);
      if (!Number.isInteger(numThali) || numThali < 1 || numThali > 50) {
        return NextResponse.json(
          { error: "Thali limit per order must be an integer between 1 and 50." },
          { status: 400 }
        );
      }
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: MAX_THALI_PER_ORDER_SETTING_KEY },
          update: { value: String(numThali) },
          create: { key: MAX_THALI_PER_ORDER_SETTING_KEY, value: String(numThali) },
        })
      );
      auditLogs.push(
        prisma.adminAuditLog.create({
          data: {
            actedByStaffId: session.staffId,
            action: "THALI_LIMIT_GLOBAL_UPDATED",
            targetType: "SystemSetting",
            targetId: MAX_THALI_PER_ORDER_SETTING_KEY,
            metadata: { newLimit: numThali },
          },
        })
      );
      responsePayload.thaliLimit = numThali;
    }

    // Validate and update Addon Limit if provided
    if (addonLimit !== undefined) {
      const numAddon = parseInt(addonLimit, 10);
      if (!Number.isInteger(numAddon) || numAddon < 1 || numAddon > 100) {
        return NextResponse.json(
          { error: "Addon limit per item must be an integer between 1 and 100." },
          { status: 400 }
        );
      }
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: MAX_ADDON_PER_ORDER_SETTING_KEY },
          update: { value: String(numAddon) },
          create: { key: MAX_ADDON_PER_ORDER_SETTING_KEY, value: String(numAddon) },
        })
      );
      auditLogs.push(
        prisma.adminAuditLog.create({
          data: {
            actedByStaffId: session.staffId,
            action: "ADDON_LIMIT_GLOBAL_UPDATED",
            targetType: "SystemSetting",
            targetId: MAX_ADDON_PER_ORDER_SETTING_KEY,
            metadata: { newLimit: numAddon },
          },
        })
      );
      responsePayload.addonLimit = numAddon;
    }

    if (updates.length > 0) {
      await prisma.$transaction([...updates, ...auditLogs]);
      invalidateLimitsCache();
    }

    const currentData = await getAllOrderAndAddressLimits();
    return NextResponse.json({ success: true, ...currentData, ...responsePayload });
  } catch (error) {
    console.error("[ADMIN LIMITS PUT]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
