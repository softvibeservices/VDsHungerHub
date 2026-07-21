"use client";

import { useState, useEffect } from "react";
import {
  UtensilsCrossed, Plus, Minus, PackagePlus, CheckCircle2,
  ShoppingCart, Clock, AlertCircle, ChevronDown, ChevronUp, Trash2
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { toast } from "react-hot-toast";

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
  lineId: string; // client-side unique
  thaliId: string;
  thali: Thali;
  sabjiProductId: string;
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
const MAX_ADDON = 30;

let lineCounter = 0;
function newLineId() {
  return `line_${++lineCounter}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OrderingExperience({ userId, menu }: Props) {
  const [thaliLines, setThaliLines] = useState<ThaliLine[]>([]);
  const [addonLines, setAddonLines] = useState<AddonLine[]>([]);
  const [addonsExpanded, setAddonsExpanded] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [addonProducts, setAddonProducts] = useState<Product[]>([]);

  // Fetch add-on products (those marked isAddOnAvailable)
  useEffect(() => {
    if (!menu) return;
    fetch("/api/customer/products?addonsOnly=true")
      .then((r) => r.json())
      .then((d) => setAddonProducts(d.products ?? []))
      .catch(() => {});
  }, [menu]);

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

  // ── Computed totals ─────────────────────────────────────────────────────────
  const totalThaliQty = thaliLines.reduce((s, l) => s + l.quantity, 0);
  const totalAddonQty = addonLines.reduce((s, l) => s + l.quantity, 0);

  const thaliTotal = thaliLines.reduce(
    (s, l) => s + l.thali.price * l.quantity, 0
  );
  const addonTotal = addonLines.reduce((s, l) => s + l.price * l.quantity, 0);
  const grandTotal = thaliTotal + addonTotal;

  const isCutoffPassed = menu.cutoffTime
    ? new Date() > new Date(menu.cutoffTime)
    : false;

  const isOrderingClosed = isCutoffPassed || !(menu as any).isOrderingOpen;

  // ── Add thali line ──────────────────────────────────────────────────────────
  const addThaliLine = (thali: Thali) => {
    if (!userId) {
      window.location.href = "/register";
      return;
    }
    if (totalThaliQty >= MAX_THALI) {
      toast.error(`Maximum ${MAX_THALI} thali per order`);
      return;
    }

    // Pick the first available sabji for this thali's category by default
    const categorySabji = menu.sabjiOptions.filter(
      (s) => s.categoryId === thali.categoryId
    );
    const defaultSabji = categorySabji[0]?.productId ?? "";

    setThaliLines((prev) => [
      ...prev,
      {
        lineId: newLineId(),
        thaliId: thali.id,
        thali,
        sabjiProductId: defaultSabji,
        quantity: 1,
      },
    ]);
  };

  const removeThaliLine = (lineId: string) => {
    setThaliLines((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  const updateThaliSabji = (lineId: string, sabjiProductId: string) => {
    setThaliLines((prev) =>
      prev.map((l) => (l.lineId === lineId ? { ...l, sabjiProductId } : l))
    );
  };

  const updateThaliQty = (lineId: string, delta: number) => {
    setThaliLines((prev) =>
      prev.map((l) => {
        if (l.lineId !== lineId) return l;
        const newQty = l.quantity + delta;
        if (newQty < 1) return l;
        if (totalThaliQty + delta > MAX_THALI) {
          toast.error(`Maximum ${MAX_THALI} thali per order`);
          return l;
        }
        return { ...l, quantity: newQty };
      })
    );
  };

  // ── Add-on helpers ──────────────────────────────────────────────────────────
  const updateAddon = (product: Product, delta: number) => {
    if (!userId) {
      window.location.href = "/register";
      return;
    }
    setAddonLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      const newTotal = totalAddonQty + delta;

      if (delta > 0 && newTotal > MAX_ADDON) {
        toast.error(`Maximum ${MAX_ADDON} add-on items`);
        return prev;
      }

      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter((l) => l.productId !== product.id);
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: newQty } : l));
      }

      if (delta > 0) {
        return [
          ...prev,
          { productId: product.id, name: product.name, price: product.price, quantity: 1 },
        ];
      }
      return prev;
    });
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!userId) {
      window.location.href = "/register";
      return;
    }
    if (thaliLines.length === 0) {
      toast.error("Add at least one thali to place order");
      return;
    }

    for (const line of thaliLines) {
      const sabjiForCategory = menu.sabjiOptions.filter(
        (s) => s.categoryId === line.thali.categoryId
      );
      if (sabjiForCategory.length > 0 && !line.sabjiProductId) {
        toast.error(`Please select a sabji for your ${line.thali.name}`);
        return;
      }
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/customer/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuId: menu.id,
          thaliItems: thaliLines.map((l) => ({
            thaliId: l.thaliId,
            sabjiProductId: l.sabjiProductId,
            quantity: l.quantity,
          })),
          addonItems: addonLines.map((l) => ({
            addonProductId: l.productId,
            quantity: l.quantity,
          })),
          note: note.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Order failed");
        return;
      }

      setOrderPlaced(true);
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
          <div className="bg-orange-50 rounded-2xl p-4 text-left space-y-2.5">
            {thaliLines.map((l) => {
              const sabjiObj = menu.sabjiOptions.find((s) => s.productId === l.sabjiProductId);
              return (
                <div key={l.lineId} className="border-b border-orange-100 pb-2 last:border-0 last:pb-0">
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold text-gray-800">
                      {l.quantity}× {l.thali.name}
                    </span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(l.thali.price * l.quantity)}
                    </span>
                  </div>
                  {sabjiObj && (
                    <p className="text-xs text-orange-700 font-medium mt-0.5">
                      Sabji: {sabjiObj.product.name}
                      {sabjiObj.product.nameGu && ` (${sabjiObj.product.nameGu})`}
                    </p>
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
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 lg:grid lg:grid-cols-[1fr_380px] lg:gap-6 lg:items-start pb-40">
      <div className="space-y-6">
        {/* Cutoff warning */}
        {!(menu as any).isOrderingOpen ? (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl p-3.5 text-sm font-medium text-red-600">
            <AlertCircle size={18} />
            Ordering is temporarily closed by the administrator.
          </div>
        ) : isCutoffPassed ? (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl p-3.5 text-sm font-medium text-red-600">
            <AlertCircle size={18} />
            Ordering cutoff has passed. Please contact admin.
          </div>
        ) : null}

        {/* Thali menu options */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-gray-900 text-base">Choose Your Thali</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Select thalis and choose sabjis thali-wise
              </p>
            </div>
            <span className="text-xs font-semibold bg-orange-50 text-orange-700 px-2.5 py-1 rounded-full border border-orange-100">
              Total {totalThaliQty}/{MAX_THALI} Thalis
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {menu.thalis.map(({ thali }) => {
              return (
                <div key={thali.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">{thali.name}</span>
                        {thali.nameGu && (
                          <span className="text-xs text-gray-400 font-medium">({thali.nameGu})</span>
                        )}
                      </div>
                      <p className="text-orange-600 font-extrabold text-sm mt-0.5">
                        {formatCurrency(thali.price)}
                      </p>
                      {thali.items.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          {thali.items.map((i) => i.itemName).join(" · ")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => addThaliLine(thali)}
                      disabled={isOrderingClosed || totalThaliQty >= MAX_THALI}
                      className="flex-shrink-0 flex items-center gap-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                    >
                      <Plus size={14} /> Add Thali
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Thalis & Sabji Selection List (Responsive - Both Mobile & Desktop) */}
        {thaliLines.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
            <div className="p-4 bg-orange-50/50 border-b border-orange-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
                <ShoppingCart size={16} className="text-orange-500" />
                Selected Thalis & Sabji Choices ({thaliLines.length})
              </h3>
              <span className="text-xs font-semibold text-orange-700">
                {totalThaliQty} Thali(s)
              </span>
            </div>

            <div className="divide-y divide-gray-100">
              {thaliLines.map((line, index) => {
                const sabjiForCategory = menu.sabjiOptions.filter(
                  (s) => s.categoryId === line.thali.categoryId
                );

                return (
                  <div key={line.lineId} className="p-4 space-y-3 bg-white hover:bg-orange-50/20 transition-colors">
                    {/* Header line: Title + Quantity + Price */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className="font-bold text-sm text-gray-900 truncate">
                          {line.thali.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Quantity Controls */}
                        <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
                          <button
                            type="button"
                            onClick={() => updateThaliQty(line.lineId, -1)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-200 hover:text-orange-700 transition-colors text-gray-600"
                          >
                            <Minus size={12} />
                          </button>
                          <span className="text-xs font-bold w-5 text-center text-gray-900">{line.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateThaliQty(line.lineId, 1)}
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
                          className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50"
                          title="Remove item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Sabji Selector for THIS specific thali line */}
                    {sabjiForCategory.length > 0 && (
                      <div className="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                            <span>Select Sabji for Thali #{index + 1}:</span>
                          </label>
                          {!line.sabjiProductId && (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md border border-red-100">
                              ⚠️ Required
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {sabjiForCategory.map((s) => {
                            const isSelected = line.sabjiProductId === s.productId;
                            return (
                              <button
                                key={s.productId}
                                type="button"
                                onClick={() => updateThaliSabji(line.lineId, s.productId)}
                                className={`text-xs px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? "border-orange-500 bg-orange-500 text-white font-bold shadow-xs"
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
                  </div>
                );
              })}
            </div>
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
                    {totalAddonQty}/{MAX_ADDON} items
                  </span>
                )}
              </div>
              {addonsExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
            </button>

            {addonsExpanded && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {addonProducts.map((product) => {
                  const line = addonLines.find((l) => l.productId === product.id);
                  return (
                    <div key={product.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-semibold text-gray-800">{product.name}</span>
                        <span className="text-xs text-orange-600 font-extrabold ml-2">
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-100 rounded-xl p-1">
                        <button
                          type="button"
                          onClick={() => updateAddon(product, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-200 hover:text-orange-700 transition-colors text-gray-600"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-bold w-5 text-center text-gray-900">{line?.quantity ?? 0}</span>
                        <button
                          type="button"
                          onClick={() => updateAddon(product, 1)}
                          disabled={isOrderingClosed}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-200 hover:text-orange-700 disabled:opacity-40 transition-colors text-gray-600"
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

        {/* Note / Special Instructions */}
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
          </div>
        )}
      </div>

      {/* Desktop Order Summary Sidebar */}
      <div className="hidden lg:block sticky top-24 bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6">
        <h3 className="font-bold text-gray-900 text-base border-b border-gray-100 pb-3 flex items-center justify-between">
          <span>Order Summary</span>
          {thaliLines.length > 0 && (
            <span className="text-xs font-normal text-gray-400">
              {totalThaliQty} thalis
            </span>
          )}
        </h3>

        {thaliLines.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm space-y-2">
            <ShoppingCart className="mx-auto opacity-30 text-gray-400" size={32} />
            <p className="font-medium text-gray-500">Your cart is empty</p>
            <p className="text-xs text-gray-400">Click &quot;Add Thali&quot; above to select your meal.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3.5 max-h-[340px] overflow-y-auto pr-1 divide-y divide-gray-50">
              {thaliLines.map((l, idx) => {
                const sabjiObj = menu.sabjiOptions.find((s) => s.productId === l.sabjiProductId);
                return (
                  <div key={l.lineId} className="pt-2 first:pt-0 space-y-1">
                    <div className="flex justify-between items-start text-sm">
                      <p className="font-bold text-gray-800 truncate pr-2">
                        {l.quantity}× {l.thali.name}
                      </p>
                      <span className="font-bold text-gray-900 flex-shrink-0">
                        {formatCurrency(l.thali.price * l.quantity)}
                      </span>
                    </div>

                    {sabjiObj ? (
                      <p className="text-[11px] text-orange-700 font-semibold bg-orange-50 px-2 py-0.5 rounded-md inline-block">
                        Sabji: {sabjiObj.product.name}
                      </p>
                    ) : (
                      <p className="text-[11px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded-md inline-block">
                        ⚠️ Sabji required
                      </p>
                    )}
                  </div>
                );
              })}

              {addonLines.map((l) => (
                <div key={l.productId} className="pt-2 flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">{l.quantity}× {l.name}</span>
                  <span className="font-semibold text-gray-800">
                    {formatCurrency(l.price * l.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500 font-bold">Total Amount</span>
                <span className="text-2xl font-extrabold text-orange-600">{formatCurrency(grandTotal)}</span>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || isOrderingClosed || thaliLines.length === 0}
                className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/20 text-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {submitting ? "Placing Order..." : "Place Order Now"}
                {!submitting && <CheckCircle2 size={18} />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sticky order summary footer (visible on mobile/tablet) */}
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
              onClick={handleSubmit}
              disabled={submitting || isOrderingClosed || thaliLines.length === 0}
              className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/30 text-sm flex items-center gap-2 cursor-pointer"
            >
              {submitting ? "Placing..." : "Place Order"}
              {!submitting && <CheckCircle2 size={16} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
