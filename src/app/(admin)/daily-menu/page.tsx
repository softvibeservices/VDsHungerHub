"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { getTodayIST } from "@/lib/utils";
import WeekStrip from "./_WeekStrip";
import MealColumn from "./_MealColumn";
import CopyFromDialog from "./_CopyFromDialog";
import SaveTemplateModal from "./_SaveTemplateModal";
import useDirtyState from "@/hooks/useDirtyState";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ThaliItem {
  id: string;
  itemName: string;
}

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  isAddOnAvailable: boolean;
}

interface ThaliCategory {
  id: string;
  name: string;
}

interface Thali {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  categoryId: string | null;
  category: ThaliCategory | null;
  sabjiCount: number;
  items: ThaliItem[];
  sabjiPool?: { productId: string; product: Product }[];
}

interface DailyMenu {
  id: string;
  publicSlug?: string | null;
  mealType: "LUNCH" | "DINNER";
  cutoffTime?: string | null;
  thalis: { thaliId: string; thali: Thali; minSabjiRequired: number }[];
  sabjiOptions: { categoryId: string; productId: string }[];
}

interface MenuTemplate {
  id: string;
  name: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime: string | null;
  thaliIds: string[];
  sabjiConfig: { categoryId: string; productIds: string[] }[];
}

interface DaySummary {
  date: string;
  hasLunch: boolean;
  hasDinner: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────
function dateAddDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  return d.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const LAST_CUTOFF_KEY = "vdh_last_cutoff";

function getLastCutoff(mealType: "LUNCH" | "DINNER"): string {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_CUTOFF_KEY) ?? "{}");
    return stored[mealType] ?? (mealType === "LUNCH" ? "11:30" : "18:30");
  } catch {
    return mealType === "LUNCH" ? "11:30" : "18:30";
  }
}

function saveLastCutoff(mealType: "LUNCH" | "DINNER", value: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_CUTOFF_KEY) ?? "{}");
    stored[mealType] = value;
    localStorage.setItem(LAST_CUTOFF_KEY, JSON.stringify(stored));
  } catch {
    /* ignore */
  }
}

interface MealDraft {
  existingId: string | null;
  publicSlug: string | null;
  cutoffTime: string;
  selectedThaliIds: string[];
  sabjiMap: Record<string, string[]>;
  minSabjiMap: Record<string, number>;
  isSaving: boolean;
  isDeleting: boolean;
}

function emptyDraft(mealType: "LUNCH" | "DINNER"): MealDraft {
  return {
    existingId: null,
    publicSlug: null,
    cutoffTime: getLastCutoff(mealType),
    selectedThaliIds: [],
    sabjiMap: {},
    minSabjiMap: {},
    isSaving: false,
    isDeleting: false,
  };
}

function groupThalisByCategory(selectedThaliIds: string[], allThalis: Thali[]) {
  const groups: { key: string; label: string; thalis: Thali[]; sabjiCount: number }[] = [];
  const byCategory = new Map<string, Thali[]>();

  for (const id of selectedThaliIds) {
    const thali = allThalis.find((t) => t.id === id);
    if (!thali) continue;
    const groupKey = thali.categoryId ?? `__uncategorized_${thali.id}`;
    if (!byCategory.has(groupKey)) byCategory.set(groupKey, []);
    byCategory.get(groupKey)!.push(thali);
  }

  for (const [key, thalis] of byCategory) {
    const label = thalis[0].category?.name ?? thalis[0].name;
    const sabjiCount = Math.max(...thalis.map((t) => t.sabjiCount));
    groups.push({ key, label, thalis, sabjiCount });
  }
  return groups;
}

export default function MenuPage() {
  const todayStr = getTodayIST();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleOpenDatePicker = () => {
    dateInputRef.current?.showPicker();
  };

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [thalis, setThalis] = useState<Thali[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [summaries, setSummaries] = useState<DaySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Active tab on mobile
  const [mobileActiveTab, setMobileActiveTab] = useState<"LUNCH" | "DINNER">("LUNCH");

  // Drafts & Snapshots for dirty state tracking
  const [lunchDraft, setLunchDraft] = useState<MealDraft>(() => emptyDraft("LUNCH"));
  const [dinnerDraft, setDinnerDraft] = useState<MealDraft>(() => emptyDraft("DINNER"));
  const [lunchSnapshot, setLunchSnapshot] = useState<MealDraft | null>(null);
  const [dinnerSnapshot, setDinnerSnapshot] = useState<MealDraft | null>(null);

  // Dirty hook bindings
  const isLunchDirty = useDirtyState(lunchDraft, lunchSnapshot);
  const isDinnerDirty = useDirtyState(dinnerDraft, dinnerSnapshot);

  // Modals state
  const [pendingDateChange, setPendingDateChange] = useState<string | null>(null);
  const [deleteConfirmMeal, setDeleteConfirmMeal] = useState<"LUNCH" | "DINNER" | null>(null);

  const [templateSaveModal, setTemplateSaveModal] = useState<{
    mealType: "LUNCH" | "DINNER";
    open: boolean;
  }>({ mealType: "LUNCH", open: false });

  const [copyFromDialog, setCopyFromDialog] = useState<{
    mealType: "LUNCH" | "DINNER";
    open: boolean;
  }>({ mealType: "LUNCH", open: false });

  const [pendingCopySource, setPendingCopySource] = useState<{
    mealType: "LUNCH" | "DINNER";
    sourceDate: string;
  } | null>(null);

  // Fetch summaries for WeekStrip (2 weeks range)
  const fetchSummaries = useCallback(async () => {
    try {
      const from = todayStr;
      const to = dateAddDays(todayStr, 13);
      const res = await fetch(`/api/menu/summary?from=${from}&to=${to}`);
      if (res.ok) {
        const json = await res.json();
        const map = new Map<string, { hasLunch: boolean; hasDinner: boolean }>();

        // Prepopulate dates in range so they appear on list
        for (let i = 0; i < 14; i++) {
          const dateStr = dateAddDays(todayStr, i);
          map.set(dateStr, { hasLunch: false, hasDinner: false });
        }

        json.days.forEach((day: { date: string; mealType: "LUNCH" | "DINNER" }) => {
          if (map.has(day.date)) {
            if (day.mealType === "LUNCH") map.get(day.date)!.hasLunch = true;
            if (day.mealType === "DINNER") map.get(day.date)!.hasDinner = true;
          }
        });

        const list = Array.from(map.entries()).map(([date, meals]) => ({
          date,
          hasLunch: meals.hasLunch,
          hasDinner: meals.hasDinner,
        }));
        setSummaries(list);
      }
    } catch {
      /* ignore */
    }
  }, [todayStr]);

  // Fetch catalog master data
  useEffect(() => {
    Promise.all([
      fetch("/api/thalis?isActive=true").then((r) => r.json()),
      fetch("/api/products?isActive=true").then((r) => r.json()),
      fetch("/api/menu-templates").then((r) => r.json()),
    ])
      .then(([thaliData, productData, templateData]) => {
        setThalis(thaliData.thalis ?? []);
        setProducts(productData.products ?? []);
        setTemplates(templateData.templates ?? []);
        fetchSummaries();
      })
      .catch(() => toast.error("Failed to load catalog data"))
      .finally(() => setIsLoading(false));
  }, [fetchSummaries]);

  // Fetch menus for selected date
  const fetchMenusForDate = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/menu?date=${date}`);
      const json = await res.json();
      const menus: DailyMenu[] = json.menus ?? [];

      const buildDraft = (mealType: "LUNCH" | "DINNER"): MealDraft => {
        const menu = menus.find((m) => m.mealType === mealType);
        if (!menu) return emptyDraft(mealType);

        const sabjiMap: Record<string, string[]> = {};
        menu.sabjiOptions.forEach(({ categoryId, productId }) => {
          if (!sabjiMap[categoryId]) sabjiMap[categoryId] = [];
          sabjiMap[categoryId].push(productId);
        });

        const minSabjiMap: Record<string, number> = {};
        menu.thalis.forEach(({ thaliId, minSabjiRequired }) => {
          minSabjiMap[thaliId] = minSabjiRequired;
        });

        let cutoffTime = getLastCutoff(mealType);
        if (menu.cutoffTime) {
          try {
            const d = new Date(menu.cutoffTime);
            const ist = new Date(d.getTime() + 330 * 60 * 1000);
            cutoffTime = `${String(ist.getUTCHours()).padStart(2, "0")}:${String(
              ist.getUTCMinutes()
            ).padStart(2, "0")}`;
          } catch {
            /* use default */
          }
        }

        return {
          existingId: menu.id,
          publicSlug: menu.publicSlug ?? null,
          cutoffTime,
          selectedThaliIds: menu.thalis.map((t) => t.thaliId),
          sabjiMap,
          minSabjiMap,
          isSaving: false,
          isDeleting: false,
        };
      };

      const lunch = buildDraft("LUNCH");
      const dinner = buildDraft("DINNER");

      setLunchDraft(lunch);
      setLunchSnapshot(lunch);
      setDinnerDraft(dinner);
      setDinnerSnapshot(dinner);
    } catch {
      toast.error("Failed to load menus for this date");
    }
  }, []);

  useEffect(() => {
    fetchMenusForDate(selectedDate);
  }, [selectedDate, fetchMenusForDate]);

  // ── Date Navigation dirty warnings ──────────────────────────────────────────
  const handleSelectDate = (date: string) => {
    if (isLunchDirty || isDinnerDirty) {
      setPendingDateChange(date);
    } else {
      setSelectedDate(date);
    }
  };

  const handleConfirmDateChange = () => {
    if (pendingDateChange) {
      setSelectedDate(pendingDateChange);
      setPendingDateChange(null);
    }
  };

  // ── Draft helpers ────────────────────────────────────────────────────────────
  const updateDraft = (mealType: "LUNCH" | "DINNER", partial: Partial<MealDraft>) => {
    if (mealType === "LUNCH") setLunchDraft((prev) => ({ ...prev, ...partial }));
    else setDinnerDraft((prev) => ({ ...prev, ...partial }));
  };

  const getDraft = (mealType: "LUNCH" | "DINNER") =>
    mealType === "LUNCH" ? lunchDraft : dinnerDraft;

  // ── Load template ────────────────────────────────────────────────────────────
  const loadTemplate = (mealType: "LUNCH" | "DINNER", template: MenuTemplate) => {
    const sabjiMap: Record<string, string[]> = {};
    const minSabjiMap: Record<string, number> = {};
    (template.sabjiConfig ?? []).forEach(
      ({ categoryId, productIds }: { categoryId: string; productIds: string[] }) => {
        sabjiMap[categoryId] = productIds;
      }
    );
    template.thaliIds.forEach((tid) => {
      const thali = thalis.find((t) => t.id === tid);
      minSabjiMap[tid] = thali?.sabjiCount ?? 1;
    });

    updateDraft(mealType, {
      selectedThaliIds: template.thaliIds,
      sabjiMap,
      minSabjiMap,
      cutoffTime: template.cutoffTime ?? getLastCutoff(mealType),
    });
    toast.success(`Template "${template.name}" loaded`);
  };

  // ── Save menu ────────────────────────────────────────────────────────────────
  const saveMenu = async (mealType: "LUNCH" | "DINNER") => {
    const draft = getDraft(mealType);
    if (draft.selectedThaliIds.length === 0) {
      toast.error("Select at least one thali");
      return;
    }

    const groups = groupThalisByCategory(draft.selectedThaliIds, thalis);

    // Validation: Block uncategorized thalis that require sabjis
    const uncategorizedWithSabji = draft.selectedThaliIds
      .map((id) => thalis.find((t) => t.id === id))
      .filter((t) => t && !t.categoryId && t.sabjiCount > 0);
    if (uncategorizedWithSabji.length > 0) {
      toast.error(
        `Assign a category to: ${uncategorizedWithSabji
          .map((t) => t!.name)
          .join(", ")} before adding them to a daily menu.`
      );
      return;
    }

    updateDraft(mealType, { isSaving: true });
    saveLastCutoff(mealType, draft.cutoffTime);

    const sabjiOptions = groups
      .filter((g) => g.sabjiCount > 0 && g.thalis[0].categoryId)
      .map((g) => ({
        categoryId: g.thalis[0].categoryId!,
        productIds: draft.sabjiMap[g.key] ?? [],
      }));

    // Build the correct thaliConfig with custom minSabjiRequired overrides
    const thaliConfig = draft.selectedThaliIds.map((tid) => ({
      thaliId: tid,
      minSabjiRequired: draft.minSabjiMap[tid] ?? 1,
    }));

    try {
      const url = draft.existingId ? `/api/menu/${draft.existingId}` : "/api/menu";
      const method = draft.existingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          mealType,
          cutoffTime: draft.cutoffTime || null,
          thaliConfig,
          sabjiOptions,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");

      toast.success(
        draft.existingId
          ? `${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu updated!`
          : `${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu created!`
      );

      const saved: DailyMenu = json.menu;
      const updatedDraft: MealDraft = {
        ...draft,
        existingId: saved.id,
        publicSlug: saved.publicSlug ?? null,
        isSaving: false,
      };

      updateDraft(mealType, updatedDraft);

      // Save snapshots for dirty checks
      if (mealType === "LUNCH") setLunchSnapshot(updatedDraft);
      else setDinnerSnapshot(updatedDraft);

      // Refresh week strip summaries
      fetchSummaries();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      updateDraft(mealType, { isSaving: false });
    }
  };

  // ── Delete menu ──────────────────────────────────────────────────────────────
  const runDeleteMenu = async () => {
    if (!deleteConfirmMeal) return;
    const mealType = deleteConfirmMeal;
    const draft = getDraft(mealType);
    if (!draft.existingId) return;

    updateDraft(mealType, { isDeleting: true });
    try {
      const res = await fetch(`/api/menu/${draft.existingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(`${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu deleted`);

      const cleared = emptyDraft(mealType);
      updateDraft(mealType, cleared);

      if (mealType === "LUNCH") setLunchSnapshot(null);
      else setDinnerSnapshot(null);

      fetchSummaries();
    } catch {
      toast.error("Delete failed");
      updateDraft(mealType, { isDeleting: false });
    } finally {
      setDeleteConfirmMeal(null);
    }
  };

  // ── Save as template ─────────────────────────────────────────────────────────
  const saveAsTemplate = async (name: string) => {
    const { mealType } = templateSaveModal;
    const draft = getDraft(mealType);

    const groups = groupThalisByCategory(draft.selectedThaliIds, thalis);
    const sabjiConfig = groups
      .filter((g) => g.sabjiCount > 0 && g.thalis[0].categoryId)
      .map((g) => ({
        categoryId: g.thalis[0].categoryId!,
        productIds: draft.sabjiMap[g.key] ?? [],
      }));

    try {
      const res = await fetch("/api/menu-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mealType,
          cutoffTime: draft.cutoffTime || null,
          thaliIds: draft.selectedThaliIds,
          sabjiConfig,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(`Template "${name}" saved`);
      setTemplates((prev) => {
        const exists = prev.find((t) => t.name === json.template.name);
        if (exists) return prev.map((t) => (t.name === json.template.name ? json.template : t));
        return [...prev, json.template];
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save template failed");
    }
  };

  // ── Delete template ──────────────────────────────────────────────────────────
  const deleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/menu-templates?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    }
  };

  // ── Copy Menu From previous Date ─────────────────────────────────────────────
  const copyMenuFromDate = async (sourceDate: string, mealType: "LUNCH" | "DINNER") => {
    try {
      const res = await fetch(`/api/menu?date=${sourceDate}`);
      const json = await res.json();
      const menus: DailyMenu[] = json.menus ?? [];
      const menu = menus.find((m) => m.mealType === mealType);
      if (!menu) {
        toast.error(`No ${mealType.toLowerCase()} menu found on ${sourceDate}`);
        return;
      }

      const sabjiMap: Record<string, string[]> = {};
      menu.sabjiOptions.forEach(({ categoryId, productId }) => {
        if (!sabjiMap[categoryId]) sabjiMap[categoryId] = [];
        sabjiMap[categoryId].push(productId);
      });
      const minSabjiMap: Record<string, number> = {};
      menu.thalis.forEach(({ thaliId, minSabjiRequired }) => {
        minSabjiMap[thaliId] = minSabjiRequired;
      });

      let cutoffTime = getLastCutoff(mealType);
      if (menu.cutoffTime) {
        try {
          const d = new Date(menu.cutoffTime);
          const ist = new Date(d.getTime() + 330 * 60 * 1000);
          cutoffTime = `${String(ist.getUTCHours()).padStart(2, "0")}:${String(
            ist.getUTCMinutes()
          ).padStart(2, "0")}`;
        } catch {
          /* use default */
        }
      }

      updateDraft(mealType, {
        existingId: null, // force create new menu
        selectedThaliIds: menu.thalis.map((t) => t.thaliId),
        sabjiMap,
        minSabjiMap,
        cutoffTime,
        publicSlug: null,
      });
      toast.success(`Copied ${mealType.toLowerCase()} menu from ${sourceDate}`);
    } catch {
      toast.error("Failed to copy menu");
    }
  };

  const handleCopyFromSelect = (sourceDate: string, mealType: "LUNCH" | "DINNER") => {
    const isDirty = mealType === "LUNCH" ? isLunchDirty : isDinnerDirty;
    if (isDirty) {
      setPendingCopySource({ mealType, sourceDate });
    } else {
      copyMenuFromDate(sourceDate, mealType);
    }
  };

  const handleConfirmCopyOverwrite = () => {
    if (pendingCopySource) {
      copyMenuFromDate(pendingCopySource.sourceDate, pendingCopySource.mealType);
      setPendingCopySource(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-500">Loading catalog...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 leading-tight">Daily Menu</h2>
        <p className="text-xs text-gray-400 font-medium mt-0.5">
          Configure active thalis and sabji choices for any date
        </p>
      </div>

      {/* Week Strip Navigation (today + 13 dayslookahead) */}
      <WeekStrip
        selectedDate={selectedDate}
        todayStr={todayStr}
        summaries={summaries}
        onSelect={handleSelectDate}
        onOpenDatePicker={handleOpenDatePicker}
      />

      {/* Hidden Native Date Picker for jump navigations */}
      <input
        type="date"
        ref={dateInputRef}
        value={selectedDate}
        min={todayStr}
        onChange={(e) => e.target.value && handleSelectDate(e.target.value)}
        className="sr-only absolute pointer-events-none"
      />

      {/* Date Indicator info display */}
      <div className="flex items-center justify-between bg-white border border-gray-150 rounded-2xl px-4 py-3 shadow-inner">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-700">Active Date:</span>
          <span className="text-xs font-black text-orange-600">
            {formatDisplayDate(selectedDate)}
          </span>
          {selectedDate === todayStr && (
            <span className="text-[9px] font-extrabold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Today
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => handleSelectDate(dateAddDays(selectedDate, -1))}
            disabled={selectedDate <= todayStr}
            className="p-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => handleSelectDate(dateAddDays(selectedDate, 1))}
            className="p-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Mobile Tab Segmented Control */}
      <div className="flex md:hidden border border-gray-200 rounded-xl overflow-hidden p-1 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setMobileActiveTab("LUNCH")}
          className={cn(
            "flex-grow flex-1 py-2 text-xs font-bold text-center rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
            mobileActiveTab === "LUNCH"
              ? "bg-orange-500 text-white shadow-sm"
              : "text-gray-500 hover:bg-gray-50"
          )}
        >
          🌞 Lunch
          {isLunchDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileActiveTab("DINNER")}
          className={cn(
            "flex-grow flex-1 py-2 text-xs font-bold text-center rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
            mobileActiveTab === "DINNER"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-500 hover:bg-gray-50"
          )}
        >
          🌙 Dinner
          {isDinnerDirty && (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Meal Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={cn("md:block h-full", mobileActiveTab === "LUNCH" ? "block" : "hidden")}>
          <MealColumn
            mealType="LUNCH"
            draft={lunchDraft}
            isDirty={isLunchDirty}
            thalis={thalis}
            products={products}
            templates={templates.filter((t) => t.mealType === "LUNCH")}
            selectedDate={selectedDate}
            todayStr={todayStr}
            onUpdateDraft={(partial: any) => updateDraft("LUNCH", partial)}
            onSave={() => saveMenu("LUNCH")}
            onDelete={() => setDeleteConfirmMeal("LUNCH")}
            onLoadTemplate={(t: any) => loadTemplate("LUNCH", t)}
            onOpenSaveTemplate={() => setTemplateSaveModal({ mealType: "LUNCH", open: true })}
            onDeleteTemplate={deleteTemplate}
            onOpenCopyFrom={() => setCopyFromDialog({ mealType: "LUNCH", open: true })}
          />
        </div>
        <div className={cn("md:block h-full", mobileActiveTab === "DINNER" ? "block" : "hidden")}>
          <MealColumn
            mealType="DINNER"
            draft={dinnerDraft}
            isDirty={isDinnerDirty}
            thalis={thalis}
            products={products}
            templates={templates.filter((t) => t.mealType === "DINNER")}
            selectedDate={selectedDate}
            todayStr={todayStr}
            onUpdateDraft={(partial: any) => updateDraft("DINNER", partial)}
            onSave={() => saveMenu("DINNER")}
            onDelete={() => setDeleteConfirmMeal("DINNER")}
            onLoadTemplate={(t: any) => loadTemplate("DINNER", t)}
            onOpenSaveTemplate={() => setTemplateSaveModal({ mealType: "DINNER", open: true })}
            onDeleteTemplate={deleteTemplate}
            onOpenCopyFrom={() => setCopyFromDialog({ mealType: "DINNER", open: true })}
          />
        </div>
      </div>

      {/* ── Confirm Modals ──────────────────────────────────────────────────── */}
      {/* Date change discard confirmation */}
      <ConfirmDialog
        isOpen={pendingDateChange !== null}
        onClose={() => setPendingDateChange(null)}
        onConfirm={handleConfirmDateChange}
        title="Discard Unsaved Changes?"
        message="You have unsaved changes in your menu drafts. Navigating away will lose these changes. Proceed anyway?"
        confirmLabel="Discard & Navigate"
      />

      {/* Menu delete confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmMeal !== null}
        onClose={() => setDeleteConfirmMeal(null)}
        onConfirm={runDeleteMenu}
        title={`Delete ${deleteConfirmMeal === "LUNCH" ? "Lunch" : "Dinner"} Menu`}
        message={`Are you sure you want to delete the ${
          deleteConfirmMeal === "LUNCH" ? "Lunch" : "Dinner"
        } menu for ${formatDisplayDate(selectedDate)}? This will delete the public link and cannot be undone.`}
        confirmLabel="Delete Menu"
      />

      {/* Copy overwrite confirmation */}
      <ConfirmDialog
        isOpen={pendingCopySource !== null}
        onClose={() => setPendingCopySource(null)}
        onConfirm={handleConfirmCopyOverwrite}
        title="Overwrite Draft?"
        message={`Copying this menu will overwrite your current unsaved ${pendingCopySource?.mealType.toLowerCase()} changes. Do you want to proceed?`}
        confirmLabel="Overwrite & Copy"
      />

      {/* Save Template Modal */}
      {templateSaveModal.open && (
        <SaveTemplateModal
          isOpen={templateSaveModal.open}
          onClose={() => setTemplateSaveModal((v) => ({ ...v, open: false }))}
          mealType={templateSaveModal.mealType}
          onSave={saveAsTemplate}
        />
      )}

      {/* Copy From Dialog */}
      {copyFromDialog.open && (
        <CopyFromDialog
          isOpen={copyFromDialog.open}
          onClose={() => setCopyFromDialog((v) => ({ ...v, open: false }))}
          mealType={copyFromDialog.mealType}
          selectedDate={selectedDate}
          summaries={summaries}
          onCopy={(sourceDate) => handleCopyFromSelect(sourceDate, copyFromDialog.mealType)}
        />
      )}
    </div>
  );
}
