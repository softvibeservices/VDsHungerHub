// src/lib/cart-storage.ts
//
// Session-scoped cart persistence for the customer ordering experience.
// FIX #5: prevents an in-progress cart (selected thalis, sabji choices,
// add-ons, note, delivery address) from being wiped when the customer
// navigates away (e.g. accidentally taps "My Orders") and comes back.
//
// Uses sessionStorage (NOT localStorage) intentionally:
//   - A cart is inherently tied to *today's* specific meal cycle — it should
//     not survive a full browser restart days later against a menu that no
//     longer exists.
//   - sessionStorage is automatically cleared when the tab/window is closed,
//     which is the correct lifetime for this data.
//   - Scoping the key by userId prevents one logged-in customer's leftover
//     cart from leaking into a different customer's session on a shared
//     device within the same browser tab.

const STORAGE_VERSION = "v1";

export interface StoredThaliLine {
  lineId: string;
  thaliId: string;
  sabjiProductIds: string[];
  quantity: number;
}

export interface StoredAddonLine {
  productId: string;
  quantity: number;
}

export interface CartSnapshot {
  menuId: string;
  view: "browse" | "order";
  thaliLines: StoredThaliLine[];
  addonLines: StoredAddonLine[];
  note: string;
  selectedAddressId: string | null;
  savedAtIso: string;
}

function storageKey(userId: string, menuId: string): string {
  return `vhh_cart_${STORAGE_VERSION}_${userId}_${menuId}`;
}

export function saveCartToStorage(
  userId: string,
  menuId: string,
  snapshot: Omit<CartSnapshot, "menuId" | "savedAtIso">
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CartSnapshot = {
      ...snapshot,
      menuId,
      savedAtIso: new Date().toISOString(),
    };
    window.sessionStorage.setItem(storageKey(userId, menuId), JSON.stringify(payload));
  } catch {
    // sessionStorage can throw in private-browsing / quota-exceeded edge cases —
    // cart persistence is a convenience feature and must never break ordering.
  }
}

export function loadCartFromStorage(userId: string, menuId: string): CartSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId, menuId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CartSnapshot;
    if (parsed.menuId !== menuId) return null; // stale snapshot from a different menu
    return parsed;
  } catch {
    return null;
  }
}

export function clearCartStorage(userId: string, menuId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(userId, menuId));
  } catch {
    // ignore
  }
}
