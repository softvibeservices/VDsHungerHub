// src\lib\address-settings.ts

import { prisma } from "@/lib/prisma";

export const MAX_SAVED_ADDRESSES_SETTING_KEY = "CUSTOMER_MAX_SAVED_ADDRESSES";
export const DEFAULT_MAX_SAVED_ADDRESSES = 5;

export const MAX_THALI_PER_ORDER_SETTING_KEY = "CUSTOMER_MAX_THALI_PER_ORDER";
export const DEFAULT_MAX_THALI_PER_ORDER = 10;

export const MAX_ADDON_PER_ORDER_SETTING_KEY = "CUSTOMER_MAX_ADDON_PER_ORDER";
export const DEFAULT_MAX_ADDON_PER_ORDER = 30;

// Simple in-memory cache to prevent DB overhead on high-frequency requests
let cachedLimits: {
  addressLimit: number;
  thaliLimit: number;
  addonLimit: number;
} | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 5000; // 5 seconds cache

export function invalidateLimitsCache() {
  cachedLimits = null;
  lastCacheTime = 0;
}

/**
 * Single-query batch fetch for all order and address limit settings with 5-second in-memory caching.
 */
export async function getAllOrderAndAddressLimits() {
  const now = Date.now();
  if (cachedLimits && now - lastCacheTime < CACHE_TTL_MS) {
    return {
      ...cachedLimits,
      defaults: {
        addressLimit: DEFAULT_MAX_SAVED_ADDRESSES,
        thaliLimit: DEFAULT_MAX_THALI_PER_ORDER,
        addonLimit: DEFAULT_MAX_ADDON_PER_ORDER,
      },
    };
  }

  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            MAX_SAVED_ADDRESSES_SETTING_KEY,
            MAX_THALI_PER_ORDER_SETTING_KEY,
            MAX_ADDON_PER_ORDER_SETTING_KEY,
            "MAX_THALI_PER_ORDER",
            "MAX_ADDON_PER_ORDER",
          ],
        },
      },
    });

    const map = new Map<string, string>();
    for (const r of rows) {
      map.set(r.key, r.value);
    }

    const addressStr = map.get(MAX_SAVED_ADDRESSES_SETTING_KEY) ?? "";
    const thaliStr = map.get(MAX_THALI_PER_ORDER_SETTING_KEY) ?? map.get("MAX_THALI_PER_ORDER") ?? "";
    const addonStr = map.get(MAX_ADDON_PER_ORDER_SETTING_KEY) ?? map.get("MAX_ADDON_PER_ORDER") ?? "";

    const addressVal = parseInt(addressStr, 10);
    const thaliVal = parseInt(thaliStr, 10);
    const addonVal = parseInt(addonStr, 10);

    cachedLimits = {
      addressLimit: Number.isInteger(addressVal) && addressVal >= 5 ? addressVal : DEFAULT_MAX_SAVED_ADDRESSES,
      thaliLimit: Number.isInteger(thaliVal) && thaliVal >= 1 ? thaliVal : DEFAULT_MAX_THALI_PER_ORDER,
      addonLimit: Number.isInteger(addonVal) && addonVal >= 1 ? addonVal : DEFAULT_MAX_ADDON_PER_ORDER,
    };
    lastCacheTime = now;

    return {
      ...cachedLimits,
      defaults: {
        addressLimit: DEFAULT_MAX_SAVED_ADDRESSES,
        thaliLimit: DEFAULT_MAX_THALI_PER_ORDER,
        addonLimit: DEFAULT_MAX_ADDON_PER_ORDER,
      },
    };
  } catch (error) {
    console.error("[LIMITS SETTINGS] Error reading limits:", error);
    return {
      addressLimit: DEFAULT_MAX_SAVED_ADDRESSES,
      thaliLimit: DEFAULT_MAX_THALI_PER_ORDER,
      addonLimit: DEFAULT_MAX_ADDON_PER_ORDER,
      defaults: {
        addressLimit: DEFAULT_MAX_SAVED_ADDRESSES,
        thaliLimit: DEFAULT_MAX_THALI_PER_ORDER,
        addonLimit: DEFAULT_MAX_ADDON_PER_ORDER,
      },
    };
  }
}

export async function getMaxSavedAddressesLimit(): Promise<number> {
  const limits = await getAllOrderAndAddressLimits();
  return limits.addressLimit;
}

export async function getMaxThaliPerOrderLimit(): Promise<number> {
  const limits = await getAllOrderAndAddressLimits();
  return limits.thaliLimit;
}

export async function getMaxAddonPerOrderLimit(): Promise<number> {
  const limits = await getAllOrderAndAddressLimits();
  return limits.addonLimit;
}
