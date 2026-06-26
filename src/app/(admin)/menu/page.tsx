"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Trash2, Clock, Copy, ExternalLink, RefreshCw, ClipboardList, Save, ChevronDown } from "lucide-react";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/hooks/useToast";
import { formatCurrency, getTodayIST } from "@/lib/utils";
import { utcToISTTimeString } from "@/lib/time";
import SabjiPicker from "@/components/admin/SabjiPicker";

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
  description?: string | null;
  maxSabjiCount: number;
  items: ThaliItem[];
  // sabjiPool removed — admin picks sabji from ALL active products at menu creation time
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

export default function MenuPage() {
  const toast = useToast();

  const [selectedDate, setSelectedDate] = useState(() => getTodayIST());
  const [menus, setMenus] = useState<DailyMenu[]>([]);
  const [allThalis, setAllThalis] = useState<Thali[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Lunch states
  const [lunchCutoff, setLunchCutoff] = useState("11:30");
  const [lunchThalis, setLunchThalis] = useState<string[]>([]);
  const [lunchSabjiMap, setLunchSabjiMap] = useState<Record<string, string[]>>({});
  const [lunchMinSabjiMap, setLunchMinSabjiMap] = useState<Record<string, number>>({});
  const [isSavingLunch, setIsSavingLunch] = useState(false);

  // Dinner states
  const [dinnerCutoff, setDinnerCutoff] = useState("18:30");
  const [dinnerThalis, setDinnerThalis] = useState<string[]>([]);
  const [dinnerSabjiMap, setDinnerSabjiMap] = useState<Record<string, string[]>>({});
  const [dinnerMinSabjiMap, setDinnerMinSabjiMap] = useState<Record<string, number>>({});
  const [isSavingDinner, setIsSavingDinner] = useState(false);

  // Delete state
  const [deleteMenuId, setDeleteMenuId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState<"LUNCH" | "DINNER" | null>(null);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/menu-templates");
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates ?? []);
      }
    } catch (e) {
      console.error("Failed to load templates", e);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this template?")) return;
    try {
      const res = await fetch(`/api/menu-templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete template");
      toast.success("Template deleted successfully");
      fetchTemplates();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete template");
    }
  };

  const fetchMenuData = async () => {
    setIsLoading(true);
    try {
      fetchTemplates();
      const menuRes = await fetch(`/api/menu?date=${selectedDate}`);
      const menuJson = await menuRes.json();
      const fetchedMenus: DailyMenu[] = menuJson.menus ?? [];
      setMenus(fetchedMenus);

      // Populate LUNCH draft
      const lunch = fetchedMenus.find((m) => m.mealType === "LUNCH");
      if (lunch) {
        // cutoffTime is now a UTC DateTime from DB — convert to HH:MM IST string for display
        setLunchCutoff(lunch.cutoffTime ? utcToISTTimeString(new Date(lunch.cutoffTime)) : "11:30");
        setLunchThalis(lunch.thalis.map((mt) => mt.thali.id));
        
        const sabjis: Record<string, string[]> = {};
        const mins: Record<string, number> = {};
        lunch.thalis.forEach((mt) => {
          mins[mt.thali.id] = mt.minSabjiRequired ?? 1;
        });
        lunch.sabjiOptions.forEach((opt) => {
          if (!sabjis[opt.thaliId]) sabjis[opt.thaliId] = [];
          sabjis[opt.thaliId].push(opt.productId);
        });
        setLunchSabjiMap(sabjis);
        setLunchMinSabjiMap(mins);
      } else {
        setLunchCutoff("11:30");
        setLunchThalis([]);
        setLunchSabjiMap({});
        setLunchMinSabjiMap({});
      }

      // Populate DINNER draft
      const dinner = fetchedMenus.find((m) => m.mealType === "DINNER");
      if (dinner) {
        setDinnerCutoff(dinner.cutoffTime ? utcToISTTimeString(new Date(dinner.cutoffTime)) : "18:30");
        setDinnerThalis(dinner.thalis.map((mt) => mt.thali.id));
        
        const sabjis: Record<string, string[]> = {};
        const mins: Record<string, number> = {};
        dinner.thalis.forEach((mt) => {
          mins[mt.thali.id] = mt.minSabjiRequired ?? 1;
        });
        dinner.sabjiOptions.forEach((opt) => {
          if (!sabjis[opt.thaliId]) sabjis[opt.thaliId] = [];
          sabjis[opt.thaliId].push(opt.productId);
        });
        setDinnerSabjiMap(sabjis);
        setDinnerMinSabjiMap(mins);
      } else {
        setDinnerCutoff("18:30");
        setDinnerThalis([]);
        setDinnerSabjiMap({});
        setDinnerMinSabjiMap({});
      }

      // Load active thalis
      const thalisRes = await fetch("/api/thalis?isActive=true");
      const thalisJson = await thalisRes.json();
      setAllThalis(thalisJson.thalis ?? []);

      // Load all active products for SabjiPicker
      const productsRes = await fetch("/api/products?isActive=true&limit=200");
      const productsJson = await productsRes.json();
      setAllProducts(productsJson.products ?? []);

      // Load sessionStorage draft if available and no database menu exists
      const savedDraft = sessionStorage.getItem(`vdh_menu_draft_${selectedDate}`);
      if (savedDraft) {
        try {
          const draft = JSON.parse(savedDraft);
          if (!lunch) {
            if (draft.lunchCutoff !== undefined) setLunchCutoff(draft.lunchCutoff);
            if (draft.lunchThalis !== undefined) setLunchThalis(draft.lunchThalis);
            if (draft.lunchSabjiMap !== undefined) setLunchSabjiMap(draft.lunchSabjiMap);
            if (draft.lunchMinSabjiMap !== undefined) setLunchMinSabjiMap(draft.lunchMinSabjiMap);
          }
          if (!dinner) {
            if (draft.dinnerCutoff !== undefined) setDinnerCutoff(draft.dinnerCutoff);
            if (draft.dinnerThalis !== undefined) setDinnerThalis(draft.dinnerThalis);
            if (draft.dinnerSabjiMap !== undefined) setDinnerSabjiMap(draft.dinnerSabjiMap);
            if (draft.dinnerMinSabjiMap !== undefined) setDinnerMinSabjiMap(draft.dinnerMinSabjiMap);
          }
        } catch (e) {
          console.error("Error parsing menu draft:", e);
        }
      }
    } catch {
      toast.error("Failed to load menu data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  useEffect(() => {
    if (isLoading) return;
    const draft = {
      lunchCutoff,
      lunchThalis,
      lunchSabjiMap,
      lunchMinSabjiMap,
      dinnerCutoff,
      dinnerThalis,
      dinnerSabjiMap,
      dinnerMinSabjiMap,
    };
    sessionStorage.setItem(`vdh_menu_draft_${selectedDate}`, JSON.stringify(draft));
  }, [
    isLoading,
    selectedDate,
    lunchCutoff,
    lunchThalis,
    lunchSabjiMap,
    lunchMinSabjiMap,
    dinnerCutoff,
    dinnerThalis,
    dinnerSabjiMap,
    dinnerMinSabjiMap,
  ]);

  const todayStr = getTodayIST();

  const handlePrevDay = () => {
    if (selectedDate <= todayStr) return;
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
    setSelectedDate(todayStr);
  };

  const handleCopyFromYesterday = async (mealType: "LUNCH" | "DINNER") => {
    try {
      const d = new Date(selectedDate + "T00:00:00");
      d.setDate(d.getDate() - 1);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const yesterdayStr = `${yyyy}-${mm}-${dd}`;

      const res = await fetch(`/api/menu?date=${yesterdayStr}`);
      const json = await res.json();
      const yesterdayMenus: DailyMenu[] = json.menus ?? [];
      const menu = yesterdayMenus.find((m) => m.mealType === mealType);
      
      if (!menu) {
        toast.error(`No ${mealType.toLowerCase()} menu found for yesterday.`);
        return;
      }

      if (mealType === "LUNCH") {
        setLunchCutoff(menu.cutoffTime ? utcToISTTimeString(new Date(menu.cutoffTime)) : "11:30");
        setLunchThalis(menu.thalis.map((t) => t.thaliId));
        
        const sabjis: Record<string, string[]> = {};
        const mins: Record<string, number> = {};
        menu.thalis.forEach((mt) => {
          mins[mt.thaliId] = mt.minSabjiRequired;
        });
        menu.sabjiOptions.forEach((opt) => {
          if (!sabjis[opt.thaliId]) sabjis[opt.thaliId] = [];
          sabjis[opt.thaliId].push(opt.productId);
        });
        setLunchSabjiMap(sabjis);
        setLunchMinSabjiMap(mins);
      } else {
        setDinnerCutoff(menu.cutoffTime ? utcToISTTimeString(new Date(menu.cutoffTime)) : "18:30");
        setDinnerThalis(menu.thalis.map((t) => t.thaliId));
        
        const sabjis: Record<string, string[]> = {};
        const mins: Record<string, number> = {};
        menu.thalis.forEach((mt) => {
          mins[mt.thaliId] = mt.minSabjiRequired;
        });
        menu.sabjiOptions.forEach((opt) => {
          if (!sabjis[opt.thaliId]) sabjis[opt.thaliId] = [];
          sabjis[opt.thaliId].push(opt.productId);
        });
        setDinnerSabjiMap(sabjis);
        setDinnerMinSabjiMap(mins);
      }
      toast.success(`Copied yesterday's ${mealType.toLowerCase()} menu!`);
    } catch {
      toast.error("Failed to copy menu configuration");
    }
  };

  const handleLoadTemplate = (mealType: "LUNCH" | "DINNER", templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    if (mealType === "LUNCH") {
      setLunchCutoff(template.cutoffTime ?? "11:30");
      setLunchThalis(template.thaliIds);
      
      const sabjis: Record<string, string[]> = {};
      const mins: Record<string, number> = {};
      
      const config = Array.isArray(template.sabjiConfig) 
        ? template.sabjiConfig 
        : typeof template.sabjiConfig === "string" 
          ? JSON.parse(template.sabjiConfig) 
          : [];
          
      config.forEach((cfg: any) => {
        sabjis[cfg.thaliId] = cfg.productIds;
        mins[cfg.thaliId] = cfg.minRequired ?? 1;
      });
      
      setLunchSabjiMap(sabjis);
      setLunchMinSabjiMap(mins);
    } else {
      setDinnerCutoff(template.cutoffTime ?? "18:30");
      setDinnerThalis(template.thaliIds);
      
      const sabjis: Record<string, string[]> = {};
      const mins: Record<string, number> = {};
      
      const config = Array.isArray(template.sabjiConfig) 
        ? template.sabjiConfig 
        : typeof template.sabjiConfig === "string" 
          ? JSON.parse(template.sabjiConfig) 
          : [];
          
      config.forEach((cfg: any) => {
        sabjis[cfg.thaliId] = cfg.productIds;
        mins[cfg.thaliId] = cfg.minRequired ?? 1;
      });
      
      setDinnerSabjiMap(sabjis);
      setDinnerMinSabjiMap(mins);
    }
    toast.success(`Loaded template: ${template.name}`);
  };

  const handleSaveAsTemplate = async (mealType: "LUNCH" | "DINNER") => {
    const name = window.prompt("Enter a name for this template (e.g. 'Monday Lunch'):");
    if (!name?.trim()) return;

    const isLunch = mealType === "LUNCH";
    const cutoffTime = isLunch ? lunchCutoff : dinnerCutoff;
    const thaliIds = isLunch ? lunchThalis : dinnerThalis;
    const sabjiMap = isLunch ? lunchSabjiMap : dinnerSabjiMap;
    const minSabjiMap = isLunch ? lunchMinSabjiMap : dinnerMinSabjiMap;

    if (thaliIds.length === 0) {
      toast.error("Configure at least one thali before saving a template.");
      return;
    }

    const sabjiConfig = thaliIds.map((tid) => ({
      thaliId: tid,
      productIds: sabjiMap[tid] ?? [],
      minRequired: minSabjiMap[tid] ?? 1,
    }));

    try {
      const res = await fetch("/api/menu-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          mealType,
          cutoffTime,
          thaliIds,
          sabjiConfig,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(`Template "${name}" saved successfully!`);
      fetchTemplates();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save template");
    }
  };

  const handleSaveMenu = async (mealType: "LUNCH" | "DINNER") => {
    const isLunch = mealType === "LUNCH";
    const cutoffTime = isLunch ? lunchCutoff : dinnerCutoff;
    const thaliIds = isLunch ? lunchThalis : dinnerThalis;
    const sabjiMap = isLunch ? lunchSabjiMap : dinnerSabjiMap;
    const minSabjiMap = isLunch ? lunchMinSabjiMap : dinnerMinSabjiMap;
    const setSaving = isLunch ? setIsSavingLunch : setIsSavingDinner;
    const existingMenu = menus.find((m) => m.mealType === mealType);

    if (thaliIds.length === 0) {
      toast.error("Please select at least one thali");
      return;
    }

    // Validation of minimum sabji pool choices
    for (const thaliId of thaliIds) {
      const thali = allThalis.find((t) => t.id === thaliId);
      if (thali && thali.maxSabjiCount > 0) {
        const selectedSabjis = sabjiMap[thaliId] ?? [];
        const minReq = minSabjiMap[thaliId] ?? 1;
        if (selectedSabjis.length < minReq) {
          toast.error(`Please select at least ${minReq} sabji choices for ${thali.name}`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      const sabjiOptions = thaliIds
        .filter((tid) => {
          const t = allThalis.find((th) => th.id === tid);
          return t && t.maxSabjiCount > 0;
        })
        .map((tid) => ({
          thaliId: tid,
          productIds: sabjiMap[tid] ?? [],
        }));

      const body = {
        date: selectedDate,
        mealType,
        cutoffTime,
        thaliIds,
        sabjiOptions,
        minSabjiMap,
      };

      const url = existingMenu ? `/api/menu/${existingMenu.id}` : "/api/menu";
      const method = existingMenu ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(existingMenu ? "Menu updated!" : "Menu created!");
      fetchMenuData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteMenuId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/menu/${deleteMenuId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success("Menu deleted successfully");
      setDeleteMenuId(null);
      fetchMenuData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete menu");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleThali = (mealType: "LUNCH" | "DINNER", thaliId: string) => {
    const isLunch = mealType === "LUNCH";
    const selectedList = isLunch ? lunchThalis : dinnerThalis;
    const setSelectedList = isLunch ? setLunchThalis : setDinnerThalis;

    if (selectedList.includes(thaliId)) {
      setSelectedList(selectedList.filter((id) => id !== thaliId));
    } else {
      setSelectedList([...selectedList, thaliId]);
    }
  };

  const handleSabjiChange = (mealType: "LUNCH" | "DINNER", thaliId: string, productIds: string[]) => {
    const isLunch = mealType === "LUNCH";
    const setSabjiMap = isLunch ? setLunchSabjiMap : setDinnerSabjiMap;
    setSabjiMap((prev) => ({ ...prev, [thaliId]: productIds }));
  };

  const handleMinSabjiChange = (mealType: "LUNCH" | "DINNER", thaliId: string, minCount: number) => {
    const isLunch = mealType === "LUNCH";
    const setMinSabjiMap = isLunch ? setLunchMinSabjiMap : setDinnerMinSabjiMap;
    setMinSabjiMap((prev) => ({ ...prev, [thaliId]: minCount }));
  };

  const copyPublicLink = (slug: string) => {
    const origin = window.location.origin;
    const url = `${origin}/menu/${slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Public menu URL copied!");
  };

  const formattedDate = new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const isDateToday = () => selectedDate === todayStr;

  const lunchMenu = menus.find((m) => m.mealType === "LUNCH");
  const dinnerMenu = menus.find((m) => m.mealType === "DINNER");

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
            disabled={selectedDate <= todayStr}
            className={`p-1.5 rounded-lg text-gray-600 transition-colors ${selectedDate <= todayStr ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-100 cursor-pointer"}`}
          >
            <ChevronLeft size={18} />
          </button>
          
          <button
            onClick={handleToday}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
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
            min={todayStr}
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
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors cursor-pointer"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 h-96" />
          <div className="bg-white rounded-2xl border border-gray-200 p-6 h-96" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* LUNCH CARD */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌅</span>
                <div>
                  <h3 className="font-bold text-gray-900">Lunch Menu</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock size={12} className="text-gray-400" />
                    <input
                      type="time"
                      value={lunchCutoff}
                      onChange={(e) => setLunchCutoff(e.target.value)}
                      className="text-xs text-amber-600 font-semibold border-b border-dashed border-amber-300 outline-none w-14 focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {/* Load Template */}
                <div className="relative">
                  <button
                    onClick={() => setShowTemplateMenu(prev => prev === "LUNCH" ? null : "LUNCH")}
                    className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white hover:bg-gray-50 focus:ring-1 focus:ring-orange-500 outline-none text-gray-600 font-semibold cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <ClipboardList size={11} className="text-gray-400" />
                    Load Template
                    <ChevronDown size={10} className="text-gray-400" />
                  </button>
                  {showTemplateMenu === "LUNCH" && (
                    <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-25 min-w-[200px] py-1">
                      {templates.filter(t => t.mealType === "LUNCH").length === 0 ? (
                        <p className="text-xs text-gray-400 px-3 py-2 text-center">No templates saved yet</p>
                      ) : (
                        templates
                          .filter(t => t.mealType === "LUNCH")
                          .map(template => (
                            <div
                              key={template.id}
                              onClick={() => { handleLoadTemplate("LUNCH", template.id); setShowTemplateMenu(null); }}
                              className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 cursor-pointer transition-colors"
                            >
                              <span className="truncate pr-2 font-medium">{template.name}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                                className="text-gray-300 hover:text-red-400 p-1 rounded transition-colors"
                                title="Delete Template"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSaveAsTemplate("LUNCH")}
                  className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 focus:ring-1 focus:ring-orange-500 outline-none text-gray-600 font-semibold cursor-pointer flex items-center gap-1 transition-all"
                >
                  <Save size={11} className="text-gray-400" />
                  Save as Template
                </button>

                {!lunchMenu && (
                  <button
                    onClick={() => handleCopyFromYesterday("LUNCH")}
                    className="text-[11px] text-gray-500 hover:text-orange-500 flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 hover:bg-orange-50/20 cursor-pointer transition-all"
                  >
                    <RefreshCw size={10} /> Copy Yesterday
                  </button>
                )}
                {lunchMenu ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-250 font-semibold">
                    Published
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                    Unconfigured
                  </span>
                )}
              </div>
            </div>

            {/* Select Thalis checkboxes */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Thalis:</p>
              <div className="space-y-1.5">
                {allThalis.map((thali) => {
                  const isChecked = lunchThalis.includes(thali.id);

                  return (
                    <div key={thali.id} className="border border-gray-150 rounded-xl p-3 bg-white space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleThali("LUNCH", thali.id)}
                          className="mt-0.5 rounded text-orange-500 focus:ring-orange-500 border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-800">
                              {thali.name}
                              {thali.nameGu && (
                                <span className="text-xs text-gray-400 font-normal ml-1.5">({thali.nameGu})</span>
                              )}
                            </span>
                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                              {formatCurrency(thali.price)}
                            </span>
                          </div>
                          {thali.description && (
                            <p className="text-xs text-gray-500 mt-0.5 font-normal">{thali.description}</p>
                          )}
                        </div>
                      </label>

                      {isChecked && thali.maxSabjiCount > 0 && (
                        <div className="pt-2 border-t border-gray-100">
                          <SabjiPicker
                            products={allProducts}
                            selected={lunchSabjiMap[thali.id] ?? []}
                            onChange={(ids) => handleSabjiChange("LUNCH", thali.id, ids)}
                            maxCount={thali.maxSabjiCount}
                            minRequired={lunchMinSabjiMap[thali.id] ?? 1}
                            onMinChange={(n) => handleMinSabjiChange("LUNCH", thali.id, n)}
                            label="Configure Sabjis for Daily Menu:"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Public slug display */}
            {lunchMenu && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Customer-Facing Slug URL:</p>
                  <p className="text-xs font-mono text-orange-600 truncate mt-0.5">
                    /menu/{lunchMenu.publicSlug}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copyPublicLink(lunchMenu.publicSlug)}
                    className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                    title="Copy Public Link"
                  >
                    <Copy size={13} />
                  </button>
                  <a
                    href={`/menu/${lunchMenu.publicSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                    title="Open Menu"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <div className="flex gap-1.5">
                {lunchMenu && (
                  <Button
                    variant="danger"
                    leftIcon={<Trash2 size={13} />}
                    onClick={() => setDeleteMenuId(lunchMenu.id)}
                    size="sm"
                  >
                    Delete
                  </Button>
                )}
              </div>
              <Button
                variant="primary"
                onClick={() => handleSaveMenu("LUNCH")}
                isLoading={isSavingLunch}
                size="sm"
              >
                {lunchMenu ? "Update Lunch" : "Save Lunch"}
              </Button>
            </div>
          </div>

          {/* DINNER CARD */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌙</span>
                <div>
                  <h3 className="font-bold text-gray-900">Dinner Menu</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Clock size={12} className="text-gray-400" />
                    <input
                      type="time"
                      value={dinnerCutoff}
                      onChange={(e) => setDinnerCutoff(e.target.value)}
                      className="text-xs text-indigo-600 font-semibold border-b border-dashed border-indigo-350 outline-none w-14 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {/* Load Template */}
                <div className="relative">
                  <button
                    onClick={() => setShowTemplateMenu(prev => prev === "DINNER" ? null : "DINNER")}
                    className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white hover:bg-gray-50 focus:ring-1 focus:ring-orange-500 outline-none text-gray-600 font-semibold cursor-pointer flex items-center gap-1 transition-all"
                  >
                    <ClipboardList size={11} className="text-gray-400" />
                    Load Template
                    <ChevronDown size={10} className="text-gray-400" />
                  </button>
                  {showTemplateMenu === "DINNER" && (
                    <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-25 min-w-[200px] py-1">
                      {templates.filter(t => t.mealType === "DINNER").length === 0 ? (
                        <p className="text-xs text-gray-400 px-3 py-2 text-center">No templates saved yet</p>
                      ) : (
                        templates
                          .filter(t => t.mealType === "DINNER")
                          .map(template => (
                            <div
                              key={template.id}
                              onClick={() => { handleLoadTemplate("DINNER", template.id); setShowTemplateMenu(null); }}
                              className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-700 hover:bg-orange-50 hover:text-orange-700 cursor-pointer transition-colors"
                            >
                              <span className="truncate pr-2 font-medium">{template.name}</span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(template.id); }}
                                className="text-gray-300 hover:text-red-400 p-1 rounded transition-colors"
                                title="Delete Template"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          ))
                      )}
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleSaveAsTemplate("DINNER")}
                  className="text-[11px] border border-gray-200 rounded-lg px-2 py-1 bg-white hover:bg-orange-50 hover:border-orange-200 hover:text-orange-600 focus:ring-1 focus:ring-orange-500 outline-none text-gray-600 font-semibold cursor-pointer flex items-center gap-1 transition-all"
                >
                  <Save size={11} className="text-gray-400" />
                  Save as Template
                </button>

                {!dinnerMenu && (
                  <button
                    onClick={() => handleCopyFromYesterday("DINNER")}
                    className="text-[11px] text-gray-500 hover:text-orange-500 flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 hover:bg-orange-50/20 cursor-pointer transition-all"
                  >
                    <RefreshCw size={10} /> Copy Yesterday
                  </button>
                )}
                {dinnerMenu ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-250 font-semibold">
                    Published
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-medium">
                    Unconfigured
                  </span>
                )}
              </div>
            </div>

            {/* Select Thalis checkboxes */}
            <div className="space-y-2.5">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Select Thalis:</p>
              <div className="space-y-1.5">
                {allThalis.map((thali) => {
                  const isChecked = dinnerThalis.includes(thali.id);

                  return (
                    <div key={thali.id} className="border border-gray-150 rounded-xl p-3 bg-white space-y-3">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleThali("DINNER", thali.id)}
                          className="mt-0.5 rounded text-orange-500 focus:ring-orange-500 border-gray-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-800">
                              {thali.name}
                              {thali.nameGu && (
                                <span className="text-xs text-gray-400 font-normal ml-1.5">({thali.nameGu})</span>
                              )}
                            </span>
                            <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                              {formatCurrency(thali.price)}
                            </span>
                          </div>
                          {thali.description && (
                            <p className="text-xs text-gray-500 mt-0.5 font-normal">{thali.description}</p>
                          )}
                        </div>
                      </label>

                      {isChecked && thali.maxSabjiCount > 0 && (
                        <div className="pt-2 border-t border-gray-100">
                          <SabjiPicker
                            products={allProducts}
                            selected={dinnerSabjiMap[thali.id] ?? []}
                            onChange={(ids) => handleSabjiChange("DINNER", thali.id, ids)}
                            maxCount={thali.maxSabjiCount}
                            minRequired={dinnerMinSabjiMap[thali.id] ?? 1}
                            onMinChange={(n) => handleMinSabjiChange("DINNER", thali.id, n)}
                            label="Configure Sabjis for Daily Menu:"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Public slug display */}
            {dinnerMenu && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Customer-Facing Slug URL:</p>
                  <p className="text-xs font-mono text-orange-600 truncate mt-0.5">
                    /menu/{dinnerMenu.publicSlug}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => copyPublicLink(dinnerMenu.publicSlug)}
                    className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors cursor-pointer"
                    title="Copy Public Link"
                  >
                    <Copy size={13} />
                  </button>
                  <a
                    href={`/menu/${dinnerMenu.publicSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                    title="Open Menu"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <div className="flex gap-1.5">
                {dinnerMenu && (
                  <Button
                    variant="danger"
                    leftIcon={<Trash2 size={13} />}
                    onClick={() => setDeleteMenuId(dinnerMenu.id)}
                    size="sm"
                  >
                    Delete
                  </Button>
                )}
              </div>
              <Button
                variant="primary"
                onClick={() => handleSaveMenu("DINNER")}
                isLoading={isSavingDinner}
                size="sm"
              >
                {dinnerMenu ? "Update Dinner" : "Save Dinner"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {deleteMenuId && (
        <ConfirmDialog
          isOpen={!!deleteMenuId}
          onClose={() => setDeleteMenuId(null)}
          onConfirm={confirmDelete}
          isLoading={isDeleting}
          message="Are you sure you want to delete this menu? This will permanently remove this meal type configuration."
        />
      )}
    </div>
  );
}
