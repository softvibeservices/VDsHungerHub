"use client";

import { useState, useEffect, useCallback } from "react";
import {
  UtensilsCrossed, Plus, Minus, PackagePlus, CheckCircle2,
  ShoppingCart, Clock, AlertCircle, ChevronDown, ChevronUp, Trash2,
  ArrowLeft, MapPin, Eye, ChevronRight, Loader2, MessageSquare
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "react-hot-toast";
import AddressSheet, { Address } from "@/components/customer/AddressSheet";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
}

interface ThaliCategory {
  id: string;
  name: string;
  nameGu?: string | null;
}

interface Thali {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
  sabjiCount: number;
  categoryId: string | null;
  category?: ThaliCategory | null;
  items: { id: string; itemName: string }[];
}

interface DailyMenuThali {
  id: string;
  thaliId: string;
  thali: Thali;
  minSabjiRequired: number;
}

interface SabjiOption {
  id: string;
  categoryId: string;
  productId: string;
  product: Product;
}

interface DailyMenu {
  id: string;
  date: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime?: string | null;
  thalis: DailyMenuThali[];
  sabjiOptions: SabjiOption[];
}

interface ThaliLine {
  lineId: string;
  thaliId: string;
  thali: Thali;
  sabjiProductIds: string[];
  quantity: number;
}

interface AddonLine {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

interface Props {
  userId: string | null;
  menu: DailyMenu | null;
}

// ── Helper ────────────────────────────────────────────────────────────────────

const MAX_THALI = 10;
// FIX #4: This is now the per-ITEM limit, not a combined total
const MAX_QTY_PER_ADDON_ITEM = 30;

let lineCounter = 0;
function newLineId() {
  return `line_${++lineCounter}`;
}

function formatAddress(a: Address): string {
  const parts = [a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean);
  return parts.join(", ");
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  thaliLines: ThaliLine[];
  addonLines: AddonLine[];
  grandTotal: number;
  note: string;
  selectedAddress: Address | null;
  menu: DailyMenu;
  submitting: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

function OrderConfirmModal({
  thaliLines, addonLines, grandTotal, note, selectedAddress, menu, submitting, onBack, onConfirm
}: ConfirmModalProps) {
  const menuDate = new Date(menu.date).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric"
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onBack} />
      <div className="relative z-10 w-full bg-white rounded-t-3xl md:rounded-3xl md:max-w-lg md:m-4 shadow-2xl max-h-[90dvh] overflow-y-auto">
        {/* Handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Eye size={20} className="text-orange-500" /> Review Your Order
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{menuDate} · {menu.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"}</p>
        </div>

        <div className="p-5 space-y-4 pb-6">
          {/* Delivery Address */}
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-3.5">
            <div className="flex items-start gap-2.5">
              <MapPin size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-orange-700 uppercase tracking-wide mb-0.5">Delivery Address</p>
                {selectedAddress ? (
                  <p className="text-sm text-gray-800">{formatAddress(selectedAddress)}</p>
                ) : (
                  <p className="text-sm text-red-600 font-medium">No address selected</p>
                )}
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Your Order</p>
            {thaliLines.map((l) => {
              const sabjiNames = (l.sabjiProductIds || [])
                .map((sid) => menu.sabjiOptions.find((s) => s.productId === sid)?.product.name)
                .filter(Boolean);
              return (
                <div key={l.lineId} className="flex justify-between items-start text-sm border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                  <div>
                    <p className="font-semibold text-gray-800">{l.quantity}× {l.thali.name}</p>
                    {sabjiNames.length > 0 && (
                      <p className="text-xs text-orange-600 font-medium mt-0.5">Sabji: {sabjiNames.join(", ")}</p>
                    )}
                    {sabjiNames.length === 0 && l.thali.sabjiCount === 0 && (
                      <p className="text-xs text-gray-400 mt-0.5">No sabji (standalone dish)</p>
                    )}
                  </div>
                  <span className="font-bold text-gray-900 flex-shrink-0 ml-4">{formatCurrency(l.thali.price * l.quantity)}</span>
                </div>
              );
            })}
            {addonLines.map((l) => (
              <div key={l.productId} className="flex justify-between text-sm">
                <span className="text-gray-600">{l.quantity}× {l.name}</span>
                <span className="font-medium text-gray-800">{formatCurrency(l.price * l.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Note */}
          {note.trim() && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              <MessageSquare size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">{note}</p>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-between items-center pt-1">
            <span className="text-base font-bold text-gray-700">Total Amount</span>
            <span className="text-2xl font-extrabold text-orange-600">{formatCurrency(grandTotal)}</span>
          </div>

          {/* Warning */}
          <div className="bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
            <p className="text-xs text-red-600 font-medium">⚠️ Orders cannot be cancelled or modified once placed. Please review carefully before confirming.</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onBack}
              disabled={submitting}
              className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              ← Back
            </button>
            <button
              id="confirm-place-order"
              type="button"
              onClick={onConfirm}
              disabled={submitting || !selectedAddress}
              className="flex-[2] py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/25 text-sm flex items-center justify-center gap-2"
            >
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Placing...</> : <><CheckCircle2 size={16} /> Confirm Order</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function OrderingExperience({ userId, menu }: Props) {
  // FIX #1: view state — browse by default, switch to order on "Select →"
  const [view, setView] = useState<"browse" | "order">("browse");

  const [thaliLines, setThaliLines] = useState<ThaliLine[]>([]);
  const [addonLines, setAddonLines] = useState<AddonLine[]>([]);
  const [addonsExpanded, setAddonsExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [addonProducts, setAddonProducts] = useState<Product[]>([]);

  // FIX #8: address state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressSheet, setShowAddressSheet] = useState(false);
  const [addressesLoaded, setAddressesLoaded] = useState(false);

  // FIX #8: confirm modal state
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch add-on products
  useEffect(() => {
    if (!menu) return;
    fetch("/api/customer/products?addonsOnly=true")
      .then((r) => r.json())
      .then((d) => setAddonProducts(d.products ?? []))
      .catch(() => {});
  }, [menu]);

  // FIX #8: fetch addresses when user enters order view
  useEffect(() => {
    if (view !== "order" || !userId || addressesLoaded) return;
    fetch("/api/customer/addresses")
      .then((r) => r.json())
      .then((d) => {
        const addrs: Address[] = d.addresses ?? [];
        setAddresses(addrs);
        const def = addrs.find((a) => a.isDefault) ?? addrs[0];
        if (def) setSelectedAddressId(def.id);
        setAddressesLoaded(true);
      })
      .catch(() => { setAddressesLoaded(true); });
  }, [view, userId, addressesLoaded]);

  if (!menu) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto">
            <UtensilsCrossed size={28} className="text-orange-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">No Menu Today</h2>
          <p className="text-sm text-gray-500">
            Today&apos;s menu hasn&apos;t been published yet. Check back soon or contact admin.
          </p>
        </div>
      </div>
    );
  }

  // ── Computed ────────────────────────────────────────────────────────────────
  const totalThaliQty = thaliLines.reduce((s, l) => s + l.quantity, 0);
  const totalAddonQty = addonLines.reduce((s, l) => s + l.quantity, 0);
  const thaliTotal = thaliLines.reduce((s, l) => s + l.thali.price * l.quantity, 0);
  const addonTotal = addonLines.reduce((s, l) => s + l.price * l.quantity, 0);
  const grandTotal = thaliTotal + addonTotal;

  const isCutoffPassed = menu.cutoffTime ? new Date() > new Date(menu.cutoffTime) : false;
  const isOrderingClosed = isCutoffPassed || !(menu as any).isOrderingOpen;

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId) ?? null;

  // Group thalis by category for Browse view
  const categorized = new Map<string, DailyMenuThali[]>();
  const uncategorized: DailyMenuThali[] = [];
  const sabjilessThalis: DailyMenuThali[] = [];

  for (const dmt of menu.thalis) {
    if (dmt.thali.sabjiCount === 0) {
      sabjilessThalis.push(dmt);
      continue;
    }
    const catId = dmt.thali.categoryId ?? "__none__";
    if (!categorized.has(catId)) categorized.set(catId, []);
    categorized.get(catId)!.push(dmt);
    if (!dmt.thali.categoryId) uncategorized.push(dmt);
  }

  // ── Thali helpers ───────────────────────────────────────────────────────────
  const addThaliLine = (thali: Thali) => {
    if (!userId) { window.location.href = "/register"; return; }
    if (totalThaliQty >= MAX_THALI) { toast.error(`Maximum ${MAX_THALI} thali per order`); return; }

    const categorySabji = menu.sabjiOptions.filter((s) => s.categoryId === thali.categoryId);
    const requiredCount = Math.min(thali.sabjiCount ?? 1, categorySabji.length);
    const defaultSabjiIds = categorySabji.slice(0, requiredCount).map((s) => s.productId);

    setThaliLines((prev) => [
      ...prev,
      { lineId: newLineId(), thaliId: thali.id, thali, sabjiProductIds: defaultSabjiIds, quantity: 1 },
    ]);
  };

  // FIX #1: select thali → add line AND switch to order view
  const handleSelectThali = (thali: Thali) => {
    addThaliLine(thali);
    setView("order");
  };

  const removeThaliLine = (lineId: string) => {
    setThaliLines((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  const updateThaliSabji = (lineId: string, sabjiProductId: string) => {
    const targetLine = thaliLines.find((l) => l.lineId === lineId);
    if (!targetLine) return;

    const categorySabji = menu.sabjiOptions.filter((s) => s.categoryId === targetLine.thali.categoryId);
    const requiredCount = Math.min(targetLine.thali.sabjiCount ?? 1, categorySabji.length);

    setThaliLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        const currentIds = l.sabjiProductIds || [];
        if (requiredCount <= 1) {
          return { ...l, sabjiProductIds: [sabjiProductId] };
        } else {
          if (currentIds.includes(sabjiProductId)) {
            return { ...l, sabjiProductIds: currentIds.filter((id) => id !== sabjiProductId) };
          } else {
            if (currentIds.length >= requiredCount) {
              toast.error(`You can select at most ${requiredCount} sabjis for ${l.thali.name}`);
              return l;
            }
            return { ...l, sabjiProductIds: [...currentIds, sabjiProductId] };
          }
        }
      })
    );
  };

  const updateThaliQty = (lineId: string, delta: number) => {
    setThaliLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        const newQty = l.quantity + delta;
        if (newQty < 1) return l;
        if (totalThaliQty + delta > MAX_THALI) { toast.error(`Maximum ${MAX_THALI} thali per order`); return l; }
        return { ...l, quantity: newQty };
      })
    );
  };

  // FIX #4: per-product add-on limit (not a shared combined total)
  const updateAddon = (product: Product, delta: number) => {
    if (!userId) { window.location.href = "/register"; return; }
    setAddonLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      const currentQty = existing?.quantity ?? 0;
      const newQty = currentQty + delta;

      if (delta > 0 && newQty > MAX_QTY_PER_ADDON_ITEM) {
        toast.error(`Maximum ${MAX_QTY_PER_ADDON_ITEM} × ${product.name} per order`);
        return prev;
      }

      if (existing) {
        if (newQty <= 0) return prev.filter((l) => l.productId !== product.id);
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: newQty } : l));
      }
      if (delta > 0) {
        return [...prev, { productId: product.id, name: product.name, price: product.price, quantity: 1 }];
      }
      return prev;
    });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!userId) { window.location.href = "/register"; return; }
    if (thaliLines.length === 0) { toast.error("Add at least one thali to place order"); return; }

    // Validate sabji selection (only for thalis that require it)
    for (const line of thaliLines) {
      if (line.thali.sabjiCount === 0) continue; // sabji-less thali, skip
      const categorySabji = menu.sabjiOptions.filter((s) => s.categoryId === line.thali.categoryId);
      const requiredCount = Math.min(line.thali.sabjiCount ?? 1, categorySabji.length);
      if (categorySabji.length > 0 && line.sabjiProductIds.length < requiredCount) {
        toast.error(`Please select ${requiredCount} sabji(s) for your ${line.thali.name}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // FIX #3: send null (not "") for sabji-less thali items
      const thaliItemsPayload: { thaliId: string; sabjiProductId: string | null; quantity: number }[] = [];
      for (const l of thaliLines) {
        if (l.sabjiProductIds.length === 0) {
          thaliItemsPayload.push({ thaliId: l.thaliId, sabjiProductId: null, quantity: l.quantity });
        } else {
          for (const sabjiId of l.sabjiProductIds) {
            thaliItemsPayload.push({ thaliId: l.thaliId, sabjiProductId: sabjiId, quantity: l.quantity });
          }
        }
      }

      const res = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuId: menu.id,
          thaliItems: thaliItemsPayload,
          addonItems: addonLines.map((l) => ({ addonProductId: l.productId, quantity: l.quantity })),
          note: note.trim() || undefined,
          // FIX #8: include addressId
          addressId: selectedAddressId ?? undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Order failed"); return; }

      setOrderPlaced(true);
      setShowConfirm(false);
      toast.success("Order placed successfully! 🎉");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Order placed state ──────────────────────────────────────────────────────
  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-green-500" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">Order Placed!</h2>
          <p className="text-sm text-gray-500">
            Your thali order has been received. We&apos;ll prepare it fresh and deliver on time.
          </p>
          {selectedAddress && (
            <div className="bg-orange-50 rounded-xl px-4 py-3 text-left flex items-start gap-2">
              <MapPin size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-gray-700">{formatAddress(selectedAddress)}</p>
            </div>
          )}
          <div className="bg-orange-50 rounded-2xl p-4 text-left space-y-2.5">
            {thaliLines.map((l) => {
              const sabjiNames = l.sabjiProductIds
                .map((sid) => menu.sabjiOptions.find((s) => s.productId === sid)?.product.name)
                .filter(Boolean);
              return (
                <div key={l.lineId} className="border-b border-orange-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-800">{l.quantity}× {l.thali.name}</span>
                    <span className="font-bold text-gray-900">{formatCurrency(l.thali.price * l.quantity)}</span>
                  </div>
                  {sabjiNames.length > 0 && (
                    <p className="text-xs text-orange-700 font-medium mt-0.5">Sabji: {sabjiNames.join(", ")}</p>
                  )}
                </div>
              );
            })}
            {addonLines.map((l) => (
              <div key={l.productId} className="flex justify-between text-sm">
                <span className="text-gray-600">{l.quantity}× {l.name}</span>
                <span className="font-medium text-gray-800">{formatCurrency(l.price * l.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-orange-200 pt-2.5 flex justify-between font-extrabold text-base">
              <span>Total</span>
              <span className="text-orange-600">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
          <a href="/menu/orders" className="inline-block w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-sm transition-colors">
            View My Orders
          </a>
        </div>
      </div>
    );
  }

  // ── Closed/cutoff banner ────────────────────────────────────────────────────
  const closedBanner = !(menu as any).isOrderingOpen ? (
    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl p-3.5 text-sm font-medium text-red-600">
      <AlertCircle size={18} /> Ordering is temporarily closed by the administrator.
    </div>
  ) : isCutoffPassed ? (
    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl p-3.5 text-sm font-medium text-red-600">
      <AlertCircle size={18} /> Ordering cutoff has passed. Please contact admin.
    </div>
  ) : null;

  // ────────────────────────────────────────────────────────────────────────────
  // FIX #1: BROWSE VIEW — shows sabjis per category BEFORE any add-to-cart
  // ────────────────────────────────────────────────────────────────────────────
  if (view === "browse") {
    return (
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6 pb-40">
        {/* Page header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-gray-900">
            {menu.mealType === "LUNCH" ? "🌅 Lunch" : "🌙 Dinner"} Menu
          </h1>
          <p className="text-sm text-gray-500">
            {new Date(menu.date).toLocaleDateString("en-IN", {
              timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long"
            })}
          </p>
        </div>

        {closedBanner}

        {/* Categories with sabjis visible up front */}
        {Array.from(categorized.entries()).map(([catId, dmts]) => {
          // Get sabjis for this category
          const catName = dmts[0]?.thali.category?.name ?? "Thali";
          const catNameGu = dmts[0]?.thali.category?.nameGu;
          const sabjisForCat = menu.sabjiOptions.filter((s) => s.categoryId === catId && catId !== "__none__");

          return (
            <div key={catId} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Category header */}
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-white text-base">{catName}</h2>
                  {catNameGu && <span className="text-orange-100 text-sm">({catNameGu})</span>}
                </div>
                {/* Today's sabjis — visible immediately, no click needed */}
                {sabjisForCat.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="text-xs text-orange-100 font-medium mr-1 self-center">Today&apos;s Sabji:</span>
                    {sabjisForCat.map((s) => (
                      <span
                        key={s.productId}
                        className="text-xs bg-white/20 backdrop-blur text-white px-2.5 py-1 rounded-full font-medium border border-white/25"
                      >
                        {s.product.name}
                        {s.product.nameGu && <span className="opacity-75"> ({s.product.nameGu})</span>}
                      </span>
                    ))}
                  </div>
                )}
                {sabjisForCat.length === 0 && (
                  <p className="text-xs text-orange-100 mt-1.5 opacity-80">No sabji options configured for today</p>
                )}
              </div>

              {/* Thali options in this category */}
              <div className="divide-y divide-gray-50">
                {dmts.map(({ thali }) => (
                  <div key={thali.id} className="p-4 flex items-start justify-between gap-3 hover:bg-orange-50/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900 text-sm">{thali.name}</span>
                        {thali.nameGu && (
                          <span className="text-xs text-gray-400">({thali.nameGu})</span>
                        )}
                        {thali.sabjiCount > 0 && (
                          <span className="text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 rounded-full">
                            {thali.sabjiCount} Sabji Choice{thali.sabjiCount > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-orange-600 font-extrabold text-sm mt-0.5">{formatCurrency(thali.price)}</p>
                      {thali.items.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          {thali.items.map((i) => i.itemName).join(" · ")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleSelectThali(thali)}
                      disabled={isOrderingClosed}
                      className="flex-shrink-0 flex items-center gap-1 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                    >
                      Select <ChevronRight size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Sabji-less / single-item meals (Dal Fry, Jeera Rice etc.) */}
        {sabjilessThalis.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-600 to-slate-700 px-5 py-3.5">
              <h2 className="font-bold text-white text-base">Single Item Meals</h2>
              <p className="text-xs text-slate-300 mt-0.5">No sabji choice needed — standalone dishes</p>
            </div>
            <div className="divide-y divide-gray-50">
              {sabjilessThalis.map(({ thali }) => (
                <div key={thali.id} className="p-4 flex items-start justify-between gap-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">{thali.name}</span>
                      {thali.nameGu && <span className="text-xs text-gray-400">({thali.nameGu})</span>}
                    </div>
                    <p className="text-orange-600 font-extrabold text-sm mt-0.5">{formatCurrency(thali.price)}</p>
                    {thali.items.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">{thali.items.map((i) => i.itemName).join(" · ")}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSelectThali(thali)}
                    disabled={isOrderingClosed}
                    className="flex-shrink-0 flex items-center gap-1 px-4 py-2.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                  >
                    Select <ChevronRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sticky bottom bar — shows cart preview during browse */}
        {thaliLines.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3.5 shadow-2xl shadow-black/10 z-40">
            <div className="max-w-3xl mx-auto flex items-center gap-4">
              <div className="flex-1">
                <div className="text-xs text-gray-500 font-semibold">
                  {totalThaliQty} Thali{totalThaliQty > 1 ? "s" : ""} selected
                </div>
                <div className="text-lg font-extrabold text-gray-900">{formatCurrency(grandTotal)}</div>
              </div>
              <button
                onClick={() => setView("order")}
                className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/30 text-sm flex items-center gap-2"
              >
                <ShoppingCart size={16} /> View Cart
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ORDER VIEW — cart + sabji pickers + add-ons + address + submit
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start pb-40">
      <div className="space-y-5">
        {/* Back to menu */}
        <button
          onClick={() => setView("browse")}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 transition-colors font-medium group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Menu
        </button>

        {closedBanner}

        {/* FIX #8: Delivery Address */}
        {userId && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-orange-500" />
                <span className="text-sm font-bold text-gray-900">Delivery Address</span>
              </div>
              <button
                onClick={() => setShowAddressSheet(true)}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors"
              >
                {selectedAddress ? "Change" : "Add Address"}
              </button>
            </div>
            <div className="px-4 py-3">
              {selectedAddress ? (
                <div className="flex items-start gap-2">
                  <div className="mt-0.5 text-lg">{selectedAddress.type === "WORK" ? "🏢" : "🏠"}</div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-0.5">{selectedAddress.type}</p>
                    <p className="text-sm text-gray-800">{formatAddress(selectedAddress)}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddressSheet(true)}
                  className="w-full flex items-center gap-2 py-2 text-sm text-orange-600 font-medium hover:text-orange-700 transition-colors"
                >
                  <Plus size={16} /> Add a delivery address to continue
                </button>
              )}
            </div>
          </div>
        )}

        {/* Selected Thalis & Sabji Choices */}
        {thaliLines.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
            <div className="p-4 bg-orange-50/50 border-b border-orange-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <ShoppingCart size={16} className="text-orange-500" />
                Selected Thalis &amp; Sabji Choices ({thaliLines.length})
              </h3>
              <span className="text-xs font-semibold text-orange-700">{totalThaliQty} Thali(s)</span>
            </div>

            <div className="divide-y divide-gray-100">
              {thaliLines.map((line, index) => {
                const sabjiForCategory = menu.sabjiOptions.filter(
                  (s) => s.categoryId === line.thali.categoryId
                );
                const requiredCount = line.thali.sabjiCount === 0
                  ? 0
                  : Math.min(line.thali.sabjiCount ?? 1, sabjiForCategory.length);
                const selectedCount = line.sabjiProductIds?.length ?? 0;
                const isComplete = line.thali.sabjiCount === 0 || selectedCount >= requiredCount;

                return (
                  <div key={line.lineId} className="p-4 space-y-3 bg-white hover:bg-orange-50/20 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="font-bold text-sm text-gray-900 truncate">{line.thali.name}</span>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* FIX #5: disable minus at qty=1 */}
                        <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => updateThaliQty(line.lineId, -1)}
                            disabled={line.quantity <= 1}
                            aria-label="Decrease quantity"
                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-200 hover:text-orange-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors text-gray-600"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-bold w-5 text-center text-gray-900">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateThaliQty(line.lineId, 1)}
                            aria-label="Increase quantity"
                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-200 hover:text-orange-700 transition-colors text-gray-600"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <span className="text-sm font-extrabold text-orange-600 min-w-16 text-right">
                          {formatCurrency(line.thali.price * line.quantity)}
                        </span>

                        <button
                          type="button"
                          onClick={() => removeThaliLine(line.lineId)}
                          aria-label="Remove this thali"
                          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Sabji selector — only for thalis that require sabji */}
                    {line.thali.sabjiCount > 0 && sabjiForCategory.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-700">
                            Select Sabji for Thali #{index + 1}:
                            <span className="text-[10px] text-gray-500 font-semibold ml-1">(Pick {requiredCount})</span>
                          </label>
                          {isComplete ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                              ✓ Selected ({selectedCount}/{requiredCount})
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                              ⚠️ Select {requiredCount - selectedCount} more
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {sabjiForCategory.map((s) => {
                            const isSelected = line.sabjiProductIds?.includes(s.productId);
                            return (
                              <button
                                key={s.productId}
                                type="button"
                                onClick={() => updateThaliSabji(line.lineId, s.productId)}
                                className={`text-xs px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? "border-orange-500 bg-orange-500 text-white font-bold shadow-sm"
                                    : "border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50/50 font-medium"
                                }`}
                              >
                                {isSelected && <CheckCircle2 size={13} className="text-white" />}
                                <span>{s.product.name}</span>
                                {s.product.nameGu && (
                                  <span className={isSelected ? "text-orange-100" : "text-gray-400"}>
                                    ({s.product.nameGu})
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* FIX #3: show "No sabji needed" for sabji-less thalis */}
                    {line.thali.sabjiCount === 0 && (
                      <p className="text-xs text-gray-400 italic">No sabji selection needed for this dish</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add more button */}
            <div className="px-4 py-3 border-t border-gray-50">
              <button
                onClick={() => setView("browse")}
                className="flex items-center gap-2 text-xs font-bold text-orange-600 hover:text-orange-700 transition-colors"
              >
                <Plus size={14} /> Add another thali
              </button>
            </div>
          </div>
        )}

        {thaliLines.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center space-y-3">
            <ShoppingCart size={32} className="mx-auto text-gray-200" />
            <p className="font-medium text-gray-500">Your cart is empty</p>
            <button
              onClick={() => setView("browse")}
              className="inline-flex items-center gap-1 text-sm text-orange-600 font-bold hover:text-orange-700"
            >
              ← Browse Menu
            </button>
          </div>
        )}

        {/* Add-ons */}
        {addonProducts.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              type="button"
              className="w-full p-4 flex items-center justify-between text-left cursor-pointer"
              onClick={() => setAddonsExpanded((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <PackagePlus size={18} className="text-orange-500" />
                <span className="font-bold text-gray-900 text-sm">Add Extra Items</span>
                {totalAddonQty > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 font-bold px-2.5 py-0.5 rounded-full">
                    {totalAddonQty} item{totalAddonQty > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {addonsExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            {addonsExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {addonProducts.map((product) => {
                  const line = addonLines.find((l) => l.productId === product.id);
                  const currentQty = line?.quantity ?? 0;
                  return (
                    <div key={product.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-gray-800">{product.name}</span>
                        <span className="text-xs text-orange-600 font-extrabold ml-2">{formatCurrency(product.price)}</span>
                        {/* Show per-item cap indicator when approaching limit */}
                        {currentQty >= 25 && (
                          <span className="ml-2 text-[10px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                            {currentQty}/{MAX_QTY_PER_ADDON_ITEM}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
                        {/* FIX #5: disable minus at 0 (line doesn't exist yet) */}
                        <button
                          type="button"
                          onClick={() => updateAddon(product, -1)}
                          disabled={currentQty === 0}
                          aria-label={`Decrease ${product.name}`}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-200 hover:text-orange-700 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent transition-colors text-gray-600"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-bold w-5 text-center text-gray-900">{currentQty}</span>
                        <button
                          type="button"
                          onClick={() => updateAddon(product, 1)}
                          disabled={isOrderingClosed || currentQty >= MAX_QTY_PER_ADDON_ITEM}
                          aria-label={`Increase ${product.name}`}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-200 hover:text-orange-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-gray-600"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Special Instructions */}
        {thaliLines.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
            <label className="text-xs font-bold text-gray-700 block">
              Special Instructions (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="E.g., Less spicy, deliver at 1:00 PM..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none text-gray-700 placeholder-gray-300"
            />
            <p className="text-xs text-gray-400 text-right">{note.length}/200</p>
          </div>
        )}
      </div>

      {/* Desktop Order Summary Sidebar */}
      <div className="hidden lg:block sticky top-24 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-5">
        <h3 className="font-bold text-gray-900 text-base border-b border-gray-100 pb-3 flex items-center justify-between">
          <span>Order Summary</span>
          {thaliLines.length > 0 && (
            <span className="text-xs font-normal text-gray-400">{totalThaliQty} thalis</span>
          )}
        </h3>

        {thaliLines.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm space-y-2">
            <ShoppingCart className="mx-auto opacity-30" size={32} />
            <p className="font-medium text-gray-500">Your cart is empty</p>
            <button onClick={() => setView("browse")} className="text-xs text-orange-500 font-bold">
              ← Back to Menu
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1 divide-y divide-gray-50">
              {thaliLines.map((l) => {
                const sabjiNames = (l.sabjiProductIds || [])
                  .map((sid) => menu.sabjiOptions.find((s) => s.productId === sid)?.product.name)
                  .filter(Boolean);

                return (
                  <div key={l.lineId} className="pt-2 first:pt-0 space-y-1">
                    <div className="flex justify-between items-start text-sm">
                      <p className="font-bold text-gray-800 truncate pr-2">{l.quantity}× {l.thali.name}</p>
                      <span className="font-bold text-gray-900 flex-shrink-0">{formatCurrency(l.thali.price * l.quantity)}</span>
                    </div>
                    {sabjiNames.length > 0 ? (
                      <p className="text-[11px] text-orange-700 font-semibold bg-orange-50 px-2 py-0.5 rounded-md inline-block">
                        Sabji: {sabjiNames.join(", ")}
                      </p>
                    ) : l.thali.sabjiCount > 0 ? (
                      // Only show warning if sabji IS required but not selected
                      <p className="text-[11px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-md inline-block">
                        ⚠️ Sabji required
                      </p>
                    ) : (
                      // FIX #3: sabji-less thali → neutral message, never a warning
                      <p className="text-[11px] text-gray-400 italic">No sabji needed</p>
                    )}
                  </div>
                );
              })}

              {addonLines.map((l) => (
                <div key={l.productId} className="pt-2 flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">{l.quantity}× {l.name}</span>
                  <span className="font-semibold text-gray-800">{formatCurrency(l.price * l.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 font-bold">Total Amount</span>
                <span className="text-2xl font-extrabold text-orange-600">{formatCurrency(grandTotal)}</span>
              </div>

              {/* FIX #8: address hint when missing */}
              {!selectedAddressId && userId && (
                <p className="text-xs text-amber-600 font-medium bg-amber-50 px-3 py-2 rounded-xl">
                  📍 Add a delivery address above to continue
                </p>
              )}

              {/* FIX #8: opens confirm modal instead of submitting directly */}
              <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={submitting || isOrderingClosed || thaliLines.length === 0 || (!selectedAddressId && !!userId)}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20 text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                Review &amp; Place Order
                {!submitting && <CheckCircle2 size={18} />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile sticky footer */}
      {thaliLines.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3.5 shadow-2xl shadow-black/10 lg:hidden z-40">
          <div className="max-w-2xl mx-auto flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-gray-500 font-semibold">
                {totalThaliQty} Thali{totalThaliQty > 1 ? "s" : ""}{totalAddonQty > 0 ? ` + ${totalAddonQty} Add-on` : ""}
              </div>
              <div className="text-lg font-extrabold text-gray-900">{formatCurrency(grandTotal)}</div>
            </div>
            <button
              id="place-order-btn"
              type="button"
              onClick={() => setShowConfirm(true)}
              disabled={submitting || isOrderingClosed || thaliLines.length === 0 || (!selectedAddressId && !!userId)}
              className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/30 text-sm flex items-center gap-2 cursor-pointer"
            >
              {submitting ? "Placing..." : "Review Order"}
              {!submitting && <CheckCircle2 size={16} />}
            </button>
          </div>
        </div>
      )}

      {/* FIX #8: Address Sheet */}
      {showAddressSheet && (
        <AddressSheet
          onConfirm={(id) => {
            setSelectedAddressId(id);
            // Refresh address list
            fetch("/api/customer/addresses")
              .then((r) => r.json())
              .then((d) => setAddresses(d.addresses ?? []))
              .catch(() => {});
            setShowAddressSheet(false);
          }}
          onClose={() => setShowAddressSheet(false)}
        />
      )}

      {/* FIX #8: Confirm Modal */}
      {showConfirm && (
        <OrderConfirmModal
          thaliLines={thaliLines}
          addonLines={addonLines}
          grandTotal={grandTotal}
          note={note}
          selectedAddress={selectedAddress}
          menu={menu}
          submitting={submitting}
          onBack={() => setShowConfirm(false)}
          onConfirm={handleSubmit}
        />
      )}
    </div>
  );
}
