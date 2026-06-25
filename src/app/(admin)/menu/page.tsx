"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Plus, Pencil, Trash2, Clock, Utensils, Check } from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import MenuSetupModal from "@/components/modals/MenuSetupModal";
import { useToast } from "@/hooks/useToast";
import { formatCurrency } from "@/lib/utils";

interface ThaliItem {
  id: string;
  itemName: string;
}

interface Thali {
  id: string;
  name: string;
  price: number;
  maxSabjiCount: number;
  items: ThaliItem[];
}

interface Product {
  id: string;
  name: string;
}

interface DailyMenuThali {
  id: string;
  thali: Thali;
}

interface DailyMenuSabjiOption {
  id: string;
  thaliId: string;
  productId: string;
  product: Product;
}

interface DailyMenu {
  id: string;
  date: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime?: string | null;
  isPublished: boolean;
  thalis: DailyMenuThali[];
  sabjiOptions: DailyMenuSabjiOption[];
}

export default function MenuPage() {
  const toast = useToast();
  
  // Date state (default to today, format YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [menus, setMenus] = useState<DailyMenu[]>([]);
  const [allThalis, setAllThalis] = useState<Thali[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal / Action states
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [selectedMealType, setSelectedMealType] = useState<"LUNCH" | "DINNER">("LUNCH");
  const [editMenu, setEditMenu] = useState<DailyMenu | null>(null);
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchMenuData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch menus for selected date
      const menuRes = await fetch(`/api/menu?date=${selectedDate}`);
      const menuJson = await menuRes.json();
      setMenus(menuJson.menus ?? []);

      // 2. Fetch thalis and products if they aren't loaded yet
      if (allThalis.length === 0 || allProducts.length === 0) {
        const [thalisRes, productsRes] = await Promise.all([
          fetch("/api/thalis?isActive=true"),
          fetch("/api/products?isActive=true"),
        ]);
        const thalisJson = await thalisRes.json();
        const productsJson = await productsRes.json();
        setAllThalis(thalisJson.thalis ?? []);
        setAllProducts(productsJson.products ?? []);
      }
    } catch {
      toast.error("Failed to load menu data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
  }, [selectedDate]);

  const handlePrevDay = () => {
    const current = new Date(selectedDate + "T00:00:00");
    current.setDate(current.getDate() - 1);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleNextDay = () => {
    const current = new Date(selectedDate + "T00:00:00");
    current.setDate(current.getDate() + 1);
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, "0");
    const dd = String(current.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/menu/${deleteId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Menu deleted successfully");
      setDeleteId(null);
      fetchMenuData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete menu");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenSetup = (mealType: "LUNCH" | "DINNER", existing?: DailyMenu) => {
    setSelectedMealType(mealType);
    if (existing) {
      setEditMenu(existing);
    } else {
      setEditMenu(null);
    }
    setSetupModalOpen(true);
  };

  const lunchMenu = menus.find((m) => m.mealType === "LUNCH");
  const dinnerMenu = menus.find((m) => m.mealType === "DINNER");

  const formattedDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const isDateToday = () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return selectedDate === `${yyyy}-${mm}-${dd}`;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Daily Menu</h2>
          <p className="text-sm text-gray-500 mt-0.5">Setup and publish lunch & dinner menus</p>
        </div>

        {/* Date Selector Navigation */}
        <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          <button
            onClick={handlePrevDay}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          
          <button
            onClick={handleToday}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
              isDateToday()
                ? "bg-orange-50 text-orange-600"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            }`}
          >
            Today
          </button>

          <span className="text-sm font-semibold text-gray-800 px-2 min-w-[150px] text-center flex items-center justify-center gap-1.5">
            <Calendar size={15} className="text-gray-400" />
            {formattedDate}
          </span>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDate(e.target.value);
            }}
            className="sr-only"
            id="menu-date-picker"
          />
          <label
            htmlFor="menu-date-picker"
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors cursor-pointer"
          >
            <Calendar size={16} />
          </label>

          <button
            onClick={handleNextDay}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Main Meal Options Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse h-96" />
          <div className="bg-white rounded-2xl border border-gray-200 p-6 animate-pulse h-96" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LUNCH CARD */}
          <div
            className={`bg-white rounded-2xl border p-6 flex flex-col justify-between transition-all ${
              lunchMenu
                ? "border-amber-200 shadow-sm"
                : "border-gray-200 border-dashed bg-gray-50/50 hover:bg-gray-50"
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌅</span>
                  <div>
                    <h3 className="font-bold text-gray-900">Lunch Menu</h3>
                    {lunchMenu?.cutoffTime && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5 font-medium">
                        <Clock size={12} /> Cutoff: {lunchMenu.cutoffTime}
                      </p>
                    )}
                  </div>
                </div>
                {lunchMenu ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
                    <Check size={12} /> Set
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                    Not Configured
                  </span>
                )}
              </div>

              {lunchMenu ? (
                <div className="space-y-4">
                  {lunchMenu.thalis.map((menuThali) => {
                    const thali = menuThali.thali;
                    const options = lunchMenu.sabjiOptions.filter(
                      (opt) => opt.thaliId === thali.id
                    );

                    return (
                      <div key={thali.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900 text-sm">{thali.name}</h4>
                          <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                            {formatCurrency(thali.price)}
                          </span>
                        </div>
                        {thali.maxSabjiCount > 0 ? (
                          <div className="space-y-1.5">
                            <p className="text-xs text-gray-500 font-medium">
                              Sabji Choices (pick {thali.maxSabjiCount}):
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {options.length > 0 ? (
                                options.map((opt) => (
                                  <span
                                    key={opt.id}
                                    className="text-[11px] font-medium bg-white text-gray-700 px-2 py-1 rounded-md border border-gray-200 shadow-sm"
                                  >
                                    {opt.product.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-red-500 italic">No options selected!</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Fixed items only (no sabji selection)</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100">
                    <Utensils size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-700 text-sm">No Lunch Menu Set</h4>
                    <p className="text-xs text-gray-400 max-w-[200px] mt-1 mx-auto">
                      Configure thalis and dishes to enable ordering for lunch.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
              {lunchMenu ? (
                <>
                  <Button
                    variant="secondary"
                    leftIcon={<Pencil size={14} />}
                    onClick={() => handleOpenSetup("LUNCH", lunchMenu)}
                    size="sm"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    leftIcon={<Trash2 size={14} />}
                    onClick={() => setDeleteId(lunchMenu.id)}
                    size="sm"
                  >
                    Delete
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  leftIcon={<Plus size={14} />}
                  onClick={() => handleOpenSetup("LUNCH")}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  Set Lunch Menu
                </Button>
              )}
            </div>
          </div>

          {/* DINNER CARD */}
          <div
            className={`bg-white rounded-2xl border p-6 flex flex-col justify-between transition-all ${
              dinnerMenu
                ? "border-indigo-200 shadow-sm"
                : "border-gray-200 border-dashed bg-gray-50/50 hover:bg-gray-50"
            }`}
          >
            <div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🌙</span>
                  <div>
                    <h3 className="font-bold text-gray-900">Dinner Menu</h3>
                    {dinnerMenu?.cutoffTime && (
                      <p className="text-xs text-indigo-600 flex items-center gap-1 mt-0.5 font-medium">
                        <Clock size={12} /> Cutoff: {dinnerMenu.cutoffTime}
                      </p>
                    )}
                  </div>
                </div>
                {dinnerMenu ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex items-center gap-1">
                    <Check size={12} /> Set
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                    Not Configured
                  </span>
                )}
              </div>

              {dinnerMenu ? (
                <div className="space-y-4">
                  {dinnerMenu.thalis.map((menuThali) => {
                    const thali = menuThali.thali;
                    const options = dinnerMenu.sabjiOptions.filter(
                      (opt) => opt.thaliId === thali.id
                    );

                    return (
                      <div key={thali.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-gray-900 text-sm">{thali.name}</h4>
                          <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                            {formatCurrency(thali.price)}
                          </span>
                        </div>
                        {thali.maxSabjiCount > 0 ? (
                          <div className="space-y-1.5">
                            <p className="text-xs text-gray-500 font-medium">
                              Sabji Choices (pick {thali.maxSabjiCount}):
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {options.length > 0 ? (
                                options.map((opt) => (
                                  <span
                                    key={opt.id}
                                    className="text-[11px] font-medium bg-white text-gray-700 px-2 py-1 rounded-md border border-gray-200 shadow-sm"
                                  >
                                    {opt.product.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-red-500 italic">No options selected!</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Fixed items only (no sabji selection)</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 border border-indigo-100">
                    <Utensils size={20} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-700 text-sm">No Dinner Menu Set</h4>
                    <p className="text-xs text-gray-400 max-w-[200px] mt-1 mx-auto">
                      Configure thalis and dishes to enable ordering for dinner.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
              {dinnerMenu ? (
                <>
                  <Button
                    variant="secondary"
                    leftIcon={<Pencil size={14} />}
                    onClick={() => handleOpenSetup("DINNER", dinnerMenu)}
                    size="sm"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    leftIcon={<Trash2 size={14} />}
                    onClick={() => setDeleteId(dinnerMenu.id)}
                    size="sm"
                  >
                    Delete
                  </Button>
                </>
              ) : (
                <Button
                  variant="primary"
                  leftIcon={<Plus size={14} />}
                  onClick={() => handleOpenSetup("DINNER")}
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  Set Dinner Menu
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Setup / Edit Menu Modal */}
      {setupModalOpen && (
        <MenuSetupModal
          isOpen={setupModalOpen}
          onClose={() => {
            setSetupModalOpen(false);
            setEditMenu(null);
          }}
          onSuccess={fetchMenuData}
          date={selectedDate}
          mealType={selectedMealType}
          existingMenuId={editMenu?.id}
          thalis={allThalis}
          products={allProducts}
          initialData={
            editMenu
              ? {
                  cutoffTime: editMenu.cutoffTime ?? undefined,
                  thaliIds: editMenu.thalis.map((mt) => mt.thali.id),
                  sabjiOptions: editMenu.sabjiOptions.reduce(
                    (acc, opt) => {
                      let thaliGroup = acc.find((g) => g.thaliId === opt.thaliId);
                      if (!thaliGroup) {
                        thaliGroup = { thaliId: opt.thaliId, productIds: [] };
                        acc.push(thaliGroup);
                      }
                      thaliGroup.productIds.push(opt.productId);
                      return acc;
                    },
                    [] as { thaliId: string; productIds: string[] }[]
                  ),
                }
              : undefined
          }
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        message="Are you sure you want to delete this menu? This will permanently remove the configuration for this meal type."
      />
    </div>
  );
}
