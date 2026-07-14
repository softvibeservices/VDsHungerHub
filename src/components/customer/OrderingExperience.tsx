"use client";

import { useState, useEffect } from "react";
import {
  UtensilsCrossed, Plus, Minus, PackagePlus, CheckCircle2,
  ShoppingCart, LogOut, Clock, AlertCircle, ChevronDown, ChevronUp
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
  userId: string;
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
  const [userInfo, setUserInfo] = useState<{ name: string; number: string } | null>(null);
  const [addonProducts, setAddonProducts] = useState<Product[]>([]);

  // Fetch user profile
  useEffect(() => {
    fetch("/api/customer/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) setUserInfo({ name: d.user.name, number: d.user.number });
      })
      .catch(() => {});
  }, []);

  // Fetch add-on products (those marked isAddOnAvailable)
  useEffect(() => {
    if (!menu) return;
    fetch("/api/products?addonsOnly=true")
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
    if (totalThaliQty >= MAX_THALI) {
      toast.error(`Maximum ${MAX_THALI} thali per order`);
      return;
    }

    // Pick the first available sabji for this thali's category
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
          toast.error(`Maximum ${MAX_THALI} thali`);
          return l;
        }
        return { ...l, quantity: newQty };
      })
    );
  };

  // ── Add-on helpers ──────────────────────────────────────────────────────────
  const updateAddon = (product: Product, delta: number) => {
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
    if (thaliLines.length === 0) {
      toast.error("Add at least one thali");
      return;
    }

    for (const line of thaliLines) {
      if (!line.sabjiProductId) {
        toast.error(`Please select a sabji for ${line.thali.name}`);
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

  const handleLogout = async () => {
    await fetch("/api/customer/logout", { method: "POST" });
    window.location.reload();
  };

  // ── Order placed state ──────────────────────────────────────────────────────
  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-green-500" />
          </div>
          <h2 className="text-xl font-extrabold text-gray-900">Order Placed!</h2>
          <p className="text-sm text-gray-500">
            Your thali order has been received. We&apos;ll prepare it fresh and deliver on time.
          </p>
          <div className="bg-orange-50 rounded-2xl p-4 text-left space-y-1">
            {thaliLines.map((l) => (
              <div key={l.lineId} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {l.quantity}× {l.thali.name}
                </span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(l.thali.price * l.quantity)}
                </span>
              </div>
            ))}
            {addonLines.map((l) => (
              <div key={l.productId} className="flex justify-between text-sm">
                <span className="text-gray-500">{l.quantity}× {l.name}</span>
                <span className="text-gray-700">{formatCurrency(l.price * l.quantity)}</span>
              </div>
            ))}
            <div className="border-t border-orange-100 pt-2 mt-2 flex justify-between font-bold">
              <span>Total</span>
              <span className="text-orange-600">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-amber-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-gray-900">
            {menu.mealType === "LUNCH" ? "🌞 Lunch" : "🌙 Dinner"} Menu
          </span>
          {menu.cutoffTime && (
            <div className={`flex items-center gap-1 text-xs mt-0.5 ${isCutoffPassed ? "text-red-500" : "text-gray-400"}`}>
              <Clock size={11} />
              {isCutoffPassed ? "Cutoff passed" : `Cutoff: ${new Date(menu.cutoffTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}`}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {userInfo && <span className="text-xs text-gray-500 hidden sm:block">{userInfo.name}</span>}
          <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-5 pb-40">
        {/* Cutoff warning */}
        {!(menu as any).isOrderingOpen ? (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl p-3 text-sm text-red-600">
            <AlertCircle size={16} />
            Ordering is temporarily closed by the administrator.
          </div>
        ) : isCutoffPassed ? (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-2xl p-3 text-sm text-red-600">
            <AlertCircle size={16} />
            Ordering cutoff has passed. Please contact admin.
          </div>
        ) : null}

        {/* Thali selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">Choose Your Thali</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalThaliQty}/{MAX_THALI} thali added
            </p>
          </div>

          <div className="divide-y divide-gray-50">
            {menu.thalis.map(({ thali, minSabjiRequired }) => {
              const sabjiForCategory = menu.sabjiOptions.filter(
                (s) => s.categoryId === thali.categoryId
              );

              return (
                <div key={thali.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{thali.name}</span>
                        {thali.nameGu && (
                          <span className="text-xs text-gray-400">{thali.nameGu}</span>
                        )}
                      </div>
                      <p className="text-orange-600 font-bold text-sm mt-0.5">
                        {formatCurrency(thali.price)}
                      </p>
                      {thali.items.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          {thali.items.map((i) => i.itemName).join(" · ")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => addThaliLine(thali)}
                      disabled={isOrderingClosed || totalThaliQty >= MAX_THALI}
                      className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 bg-orange-500 text-white text-xs font-semibold rounded-xl hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus size={13} /> Add
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cart lines */}
        {thaliLines.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-50">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart size={16} className="text-orange-500" />
                Your Order
              </h2>
            </div>

            <div className="divide-y divide-gray-50">
              {thaliLines.map((line) => {
                const sabjiForCategory = menu.sabjiOptions.filter(
                  (s) => s.categoryId === line.thali.categoryId
                );

                return (
                  <div key={line.lineId} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-gray-900">{line.thali.name}</span>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl p-1">
                          <button onClick={() => updateThaliQty(line.lineId, -1)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-100 hover:text-orange-600 transition-colors">
                            <Minus size={12} />
                          </button>
                          <span className="text-sm font-bold w-5 text-center">{line.quantity}</span>
                          <button onClick={() => updateThaliQty(line.lineId, 1)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-100 hover:text-orange-600 transition-colors">
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="text-sm font-bold text-orange-600 w-16 text-right">
                          {formatCurrency(line.thali.price * line.quantity)}
                        </span>
                        <button onClick={() => removeThaliLine(line.lineId)}
                          className="text-gray-300 hover:text-red-400 transition-colors text-xs">✕</button>
                      </div>
                    </div>

                    {/* Sabji selector for this line */}
                    {sabjiForCategory.length > 0 && (
                      <div>
                        <label className="text-xs text-gray-500 font-medium mb-1 block">
                          Sabji choice for this thali:
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {sabjiForCategory.map((s) => (
                            <button
                              key={s.productId}
                              onClick={() => updateThaliSabji(line.lineId, s.productId)}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                                line.sabjiProductId === s.productId
                                  ? "border-orange-400 bg-orange-50 text-orange-700 font-semibold"
                                  : "border-gray-200 text-gray-600 hover:border-orange-300"
                              }`}
                            >
                              {line.sabjiProductId === s.productId && "✓ "}
                              {s.product.name}
                              {s.product.nameGu && ` · ${s.product.nameGu}`}
                            </button>
                          ))}
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
              className="w-full p-4 flex items-center justify-between text-left"
              onClick={() => setAddonsExpanded((v) => !v)}
            >
              <div className="flex items-center gap-2">
                <PackagePlus size={16} className="text-orange-400" />
                <span className="font-bold text-gray-900 text-sm">Add-ons</span>
                {totalAddonQty > 0 && (
                  <span className="text-xs bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">
                    {totalAddonQty}/{MAX_ADDON}
                  </span>
                )}
              </div>
              {addonsExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
            </button>

            {addonsExpanded && (
              <div className="border-t border-gray-50 divide-y divide-gray-50">
                {addonProducts.map((product) => {
                  const line = addonLines.find((l) => l.productId === product.id);
                  return (
                    <div key={product.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-800">{product.name}</span>
                        <span className="text-xs text-orange-600 font-semibold ml-2">
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-gray-50 rounded-xl p-1">
                        <button onClick={() => updateAddon(product, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-100 hover:text-orange-600 transition-colors">
                          <Minus size={12} />
                        </button>
                        <span className="text-sm font-bold w-5 text-center">{line?.quantity ?? 0}</span>
                        <button onClick={() => updateAddon(product, 1)}
                          disabled={isOrderingClosed}
                          className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-orange-100 hover:text-orange-600 disabled:opacity-40 transition-colors">
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

        {/* Note */}
        {thaliLines.length > 0 && (
          <div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="Special instructions (optional)..."
              className="w-full px-4 py-3 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none text-gray-600 placeholder-gray-300"
            />
          </div>
        )}
      </div>

      {/* Sticky order summary footer */}
      {thaliLines.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-100 px-4 py-4 shadow-2xl shadow-black/5">
          <div className="max-w-2xl mx-auto flex items-center gap-4">
            <div className="flex-1">
              <div className="text-xs text-gray-500">{totalThaliQty} thali{totalThaliQty > 1 ? "s" : ""}{totalAddonQty > 0 ? ` + ${totalAddonQty} add-on` : ""}</div>
              <div className="text-lg font-extrabold text-gray-900">{formatCurrency(grandTotal)}</div>
            </div>
            <button
              id="place-order-btn"
              onClick={handleSubmit}
              disabled={submitting || isOrderingClosed || thaliLines.length === 0}
              className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold rounded-2xl hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-orange-500/30 text-sm flex items-center gap-2"
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
