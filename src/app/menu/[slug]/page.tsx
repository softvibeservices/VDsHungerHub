"use client";

import { useEffect, useState, use } from "react";
import { UtensilsCrossed, MessageCircle, Clock, AlertCircle, CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils";
import { toast } from "react-hot-toast";

interface ThaliItem {
  id: string;
  itemName: string;
}

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
}

interface Thali {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
  maxSabjiCount: number;
  items: ThaliItem[];
  sabjiPool: { product: Product }[];
}

interface DailyMenuThali {
  id: string;
  thaliId: string;
  thali: Thali;
  minSabjiRequired: number;
}

interface DailyMenuSabjiOption {
  id: string;
  thaliId: string;
  productId: string;
  product: Product;
}

interface DailyMenu {
  id: string;
  publicSlug: string;
  date: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime?: string | null;
  isPublished: boolean;
  thalis: DailyMenuThali[];
  sabjiOptions: DailyMenuSabjiOption[];
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default function PublicMenuPage({ params }: PageProps) {
  const { slug } = use(params);

  const [menu, setMenu] = useState<DailyMenu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Customer order states
  const [selectedThaliId, setSelectedThaliId] = useState<string>("");
  const [selectedSabjis, setSelectedSabjis] = useState<Record<string, string[]>>({}); // thaliId -> productIds[]

  useEffect(() => {
    fetch(`/api/public/menu/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Menu not found");
        return res.json();
      })
      .then((data) => {
        setMenu(data.menu);
        // Pre-select first thali if available
        if (data.menu?.thalis?.length > 0) {
          setSelectedThaliId(data.menu.thalis[0].thali.id);
        }
      })
      .catch((err) => {
        setError(err.message || "Failed to load menu");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500 font-medium">{"Loading today's menu..."}</p>
        </div>
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-6 text-center shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto">
            <AlertCircle size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Menu Unavailable</h2>
            <p className="text-sm text-gray-500 mt-1">
              This menu may have expired or is not configured yet. Please check back later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedMenuThali = menu.thalis.find((mt) => mt.thali.id === selectedThaliId);

  const toggleSabji = (thaliId: string, productId: string, maxCount: number) => {
    const current = selectedSabjis[thaliId] ?? [];
    if (current.includes(productId)) {
      setSelectedSabjis({
        ...selectedSabjis,
        [thaliId]: current.filter((id) => id !== productId),
      });
    } else {
      if (current.length < maxCount) {
        setSelectedSabjis({
          ...selectedSabjis,
          [thaliId]: [...current, productId],
        });
      } else if (maxCount === 1) {
        // If maxCount is 1, just replace the selection
        setSelectedSabjis({
          ...selectedSabjis,
          [thaliId]: [productId],
        });
      } else {
        toast.error(`You can select at most ${maxCount} sabji(s)`);
      }
    }
  };

  const getWhatsAppLink = () => {
    if (!selectedMenuThali) return "";

    const thali = selectedMenuThali.thali;
    const dateFormatted = new Date(menu.date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    const isLunch = menu.mealType === "LUNCH";
    const thaliName = thali.name + (thali.nameGu ? ` (${thali.nameGu})` : "");
    const sabjisForThali = selectedSabjis[thali.id] ?? [];
    
    // Find product names for selected sabjis
    const sabjiNames = sabjisForThali
      .map((id) => {
        const opt = menu.sabjiOptions.find((o) => o.productId === id);
        if (!opt) return null;
        return opt.product.name + (opt.product.nameGu ? ` (${opt.product.nameGu})` : "");
      })
      .filter(Boolean);

    let text = `*VD's Hunger Hub Order*\n`;
    text += `📅 Date: ${dateFormatted}\n`;
    text += `🌅 Meal: ${isLunch ? "Lunch" : "Dinner"}\n`;
    text += `🍱 Thali: ${thaliName}\n`;
    
    if (thali.maxSabjiCount > 0) {
      text += `🥘 Sabji: ${sabjiNames.join(", ") || "None selected"}\n`;
    }
    
    text += `💰 Price: ${formatCurrency(thali.price)}`;

    const encoded = encodeURIComponent(text);
    return `https://wa.me/916356350086?text=${encoded}`;
  };

  const validateOrder = () => {
    if (!selectedMenuThali) return false;
    const thali = selectedMenuThali.thali;
    if (thali.maxSabjiCount > 0) {
      const selectedCount = (selectedSabjis[thali.id] ?? []).length;
      const minReq = selectedMenuThali.minSabjiRequired;
      if (selectedCount < minReq) {
        return false;
      }
    }
    return true;
  };

  const isLunch = menu.mealType === "LUNCH";
  const dateStr = new Date(menu.date).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="min-h-screen bg-gray-50/50 py-10 px-4 md:px-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md">
            <UtensilsCrossed className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{"VD's Hunger Hub"}</h1>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Fresh Tiffin, Delivered Daily</p>
          </div>
        </div>

        {/* Date and Meal info card */}
        <div className="bg-white rounded-2xl border border-gray-150 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{"Today's Menu Selection:"}</p>
            <p className="text-base font-bold text-gray-800 mt-0.5">{dateStr}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
              isLunch ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-indigo-50 text-indigo-700 border border-indigo-200"
            }`}>
              {isLunch ? "🌅 Lunch" : "🌙 Dinner"}
            </span>
            {menu.cutoffTime && (
              <span className="text-xs text-red-500 flex items-center gap-1 font-semibold">
                <Clock size={13} /> Cutoff: {menu.cutoffTime}
              </span>
            )}
          </div>
        </div>

        {/* Thali Selector Tabs */}
        <div className="space-y-2.5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Step 1: Choose Your Thali</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {menu.thalis.map((mt) => {
              const thali = mt.thali;
              const isSelected = thali.id === selectedThaliId;

              return (
                <button
                  key={thali.id}
                  onClick={() => setSelectedThaliId(thali.id)}
                  className={`p-4 rounded-2xl border text-left flex justify-between items-start transition-all cursor-pointer shadow-sm ${
                    isSelected
                      ? "border-orange-500 bg-orange-500/5 text-orange-950 ring-1 ring-orange-500"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="space-y-1">
                    <span className="font-bold text-sm block">
                      {thali.name}
                      {thali.nameGu && <span className="text-xs text-gray-500 font-medium block mt-0.5">{thali.nameGu}</span>}
                    </span>
                    <span className="text-[11px] text-gray-500 block">
                      {thali.maxSabjiCount > 0 ? `Choice of ${thali.maxSabjiCount} Sabji` : "Fixed contents"}
                    </span>
                  </div>
                  <span className={`text-sm font-extrabold px-2.5 py-0.5 rounded-lg border ${
                    isSelected ? "bg-orange-500 text-white border-orange-500" : "bg-gray-50 text-gray-800 border-gray-150"
                  }`}>
                    {formatCurrency(thali.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Thali Details card */}
        {selectedMenuThali && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5 shadow-sm">
            {/* Fixed Items List */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Fixed Thali Items:</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedMenuThali.thali.items.map((item) => (
                  <span key={item.id} className="text-xs px-3 py-1 bg-gray-50 rounded-lg border border-gray-150 text-gray-700 font-medium">
                    • {item.itemName}
                  </span>
                ))}
                {selectedMenuThali.thali.items.length === 0 && (
                  <span className="text-xs text-gray-400 italic">No fixed items configured</span>
                )}
              </div>
            </div>

            {/* Sabji Selection Option */}
            {selectedMenuThali.thali.maxSabjiCount > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-baseline border-b border-gray-100 pb-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Step 2: Choose Sabji
                  </p>
                  <p className="text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">
                    Pick {selectedSabjis[selectedMenuThali.thali.id]?.length ?? 0} of {selectedMenuThali.thali.maxSabjiCount} (Min: {selectedMenuThali.minSabjiRequired})
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {menu.sabjiOptions
                    .filter((opt) => opt.thaliId === selectedMenuThali.thali.id)
                    .map((opt) => {
                      const isChecked = (selectedSabjis[selectedMenuThali.thali.id] ?? []).includes(opt.productId);

                      return (
                        <button
                          key={opt.id}
                          onClick={() => toggleSabji(selectedMenuThali.thali.id, opt.productId, selectedMenuThali.thali.maxSabjiCount)}
                          className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                            isChecked
                              ? "border-orange-400 bg-orange-50 text-orange-950"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            isChecked ? "bg-orange-500 border-orange-500 text-white" : "border-gray-300 bg-white"
                          }`}>
                            {isChecked && <CheckCircle size={14} className="fill-orange-500 text-white" />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-gray-800 block truncate">{opt.product.name}</span>
                            {opt.product.nameGu && (
                              <span className="text-[10px] text-gray-400 font-medium block truncate mt-0.5">{opt.product.nameGu}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}

                  {menu.sabjiOptions.filter((opt) => opt.thaliId === selectedMenuThali.thali.id).length === 0 && (
                    <p className="text-xs text-gray-400 italic py-2 col-span-2 text-center">No sabjis available for this thali today.</p>
                  )}
                </div>
              </div>
            )}

            {/* WhatsApp Send button */}
            <div className="pt-3 border-t border-gray-100">
              <a
                href={validateOrder() ? getWhatsAppLink() : "#"}
                target={validateOrder() ? "_blank" : undefined}
                rel="noreferrer"
                className="block"
              >
                <Button
                  variant="primary"
                  className="w-full flex justify-center py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white cursor-pointer border-none font-bold text-sm shadow-md"
                  leftIcon={<MessageCircle size={18} className="fill-white text-emerald-600" />}
                  disabled={!validateOrder()}
                >
                  {validateOrder()
                    ? "Order via WhatsApp"
                    : `Please select at least ${selectedMenuThali.minSabjiRequired} sabji(s)`}
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
