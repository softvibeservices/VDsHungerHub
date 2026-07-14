"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Save,
  Trash2,
  BookmarkPlus,
  Zap,
  Copy,
  Check,
  X,
  Link2,
} from "lucide-react";
import toast from "react-hot-toast";
import SabjiPicker from "@/components/admin/SabjiPicker";
import Button from "@/components/ui/Button";
import { formatDateForAPI, getTodayIST } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface ThaliItem { id: string; itemName: string }
interface Product { id: string; name: string; nameGu?: string | null; isAddOnAvailable?: boolean }
interface ThaliCategory { id: string; name: string; nameGu?: string | null }
interface Thali {
  id: string;
  name: string;
  nameGu?: string | null;
  price: number;
  sabjiCount: number;
  categoryId: string | null;
  category?: ThaliCategory | null;
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
  cutoffTime?: string | null;
  thaliIds: string[];
  sabjiConfig: { categoryId: string; productIds: string[] }[];
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
  } catch { return mealType === "LUNCH" ? "11:30" : "18:30"; }
}

function saveLastCutoff(mealType: "LUNCH" | "DINNER", value: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_CUTOFF_KEY) ?? "{}");
    stored[mealType] = value;
    localStorage.setItem(LAST_CUTOFF_KEY, JSON.stringify(stored));
  } catch { /* ignore */ }
}

// Groups the currently-checked thalis by category.
// Uncategorized thalis each form their own single-thali group, keyed by '__uncategorized_...'
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

// ─── MealDraft shape ───────────────────────────────────────────────────────────
interface MealDraft {
  existingId: string | null;
  publicSlug: string | null;
  cutoffTime: string;
  selectedThaliIds: string[];
  // sabjiMap: categoryId → selected product IDs
  sabjiMap: Record<string, string[]>;
  // minSabjiMap: thaliId → min required
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

// ─── Component ─────────────────────────────────────────────────────────────────
export default function MenuPage() {
  const todayStr = getTodayIST();

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [thalis, setThalis] = useState<Thali[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [lunchDraft, setLunchDraft] = useState<MealDraft>(() => emptyDraft("LUNCH"));
  const [dinnerDraft, setDinnerDraft] = useState<MealDraft>(() => emptyDraft("DINNER"));

  // Template save modal state
  const [templateSaveModal, setTemplateSaveModal] = useState<{
    mealType: "LUNCH" | "DINNER";
    open: boolean;
    name: string;
  }>({ mealType: "LUNCH", open: false, name: "" });

  // Fetch master data once
  useEffect(() => {
    Promise.all([
      fetch("/api/thalis?isActive=true").then((r) => r.json()),
      fetch("/api/products?isActive=true").then((r) => r.json()),
      fetch("/api/menu-templates").then((r) => r.json()),
    ]).then(([thaliData, productData, templateData]) => {
      setThalis(thaliData.thalis ?? []);
      setProducts(productData.products ?? []);
      setTemplates(templateData.templates ?? []);
    }).catch(() => toast.error("Failed to load catalog data"))
    .finally(() => setIsLoading(false));
  }, []);

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

        // Parse cutoffTime (stored as UTC DateTime) back to IST "HH:MM"
        let cutoffTime = getLastCutoff(mealType);
        if (menu.cutoffTime) {
          try {
            const d = new Date(menu.cutoffTime);
            const ist = new Date(d.getTime() + 330 * 60 * 1000);
            cutoffTime = `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
          } catch { /* use default */ }
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

      setLunchDraft(buildDraft("LUNCH"));
      setDinnerDraft(buildDraft("DINNER"));
    } catch {
      toast.error("Failed to load menus for this date");
    }
  }, []);

  useEffect(() => {
    fetchMenusForDate(selectedDate);
  }, [selectedDate, fetchMenusForDate]);

  // ── Draft helpers ────────────────────────────────────────────────────────────
  const updateDraft = (
    mealType: "LUNCH" | "DINNER",
    partial: Partial<MealDraft>
  ) => {
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

    // Validation 2: Block uncategorized thalis that require sabjis
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
          thaliIds: draft.selectedThaliIds,
          sabjiOptions,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");

      toast.success(
        draft.existingId
          ? `${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu updated`
          : `${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu created`
      );

      const saved: DailyMenu = json.menu;
      updateDraft(mealType, {
        existingId: saved.id,
        publicSlug: saved.publicSlug ?? null,
        isSaving: false,
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      updateDraft(mealType, { isSaving: false });
    }
  };

  // ── Delete menu ──────────────────────────────────────────────────────────────
  const deleteMenu = async (mealType: "LUNCH" | "DINNER") => {
    const draft = getDraft(mealType);
    if (!draft.existingId) return;
    if (!confirm(`Delete ${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu? This cannot be undone.`)) return;

    updateDraft(mealType, { isDeleting: true });
    try {
      const res = await fetch(`/api/menu/${draft.existingId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success(`${mealType === "LUNCH" ? "Lunch" : "Dinner"} menu deleted`);
      updateDraft(mealType, { ...emptyDraft(mealType), isDeleting: false });
    } catch {
      toast.error("Delete failed");
      updateDraft(mealType, { isDeleting: false });
    }
  };


  // ── Save as template ─────────────────────────────────────────────────────────
  const saveAsTemplate = async () => {
    const { mealType, name } = templateSaveModal;
    const draft = getDraft(mealType);
    if (!name.trim()) { toast.error("Enter a template name"); return; }
    if (draft.selectedThaliIds.length === 0) { toast.error("No thalis selected"); return; }

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
          name: name.trim(),
          mealType,
          cutoffTime: draft.cutoffTime || null,
          thaliIds: draft.selectedThaliIds,
          sabjiConfig,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(`Template "${name.trim()}" saved`);
      setTemplates((prev) => {
        const exists = prev.find((t) => t.name === json.template.name);
        if (exists) return prev.map((t) => t.name === json.template.name ? json.template : t);
        return [...prev, json.template];
      });
      setTemplateSaveModal((v) => ({ ...v, open: false, name: "" }));
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
    } catch { toast.error("Failed to delete template"); }
  };

  // ── Copy yesterday to today ──────────────────────────────────────────────────
  const copyYesterdayToToday = async () => {
    if (selectedDate !== todayStr) {
      toast.error("This shortcut only works for today's date");
      return;
    }
    const yesterdayStr = dateAddDays(todayStr, -1);
    try {
      const res = await fetch(`/api/menu?date=${yesterdayStr}`);
      const json = await res.json();
      const menus: DailyMenu[] = json.menus ?? [];
      if (menus.length === 0) {
        toast.error("No menus found for yesterday");
        return;
      }

      for (const mealType of ["LUNCH", "DINNER"] as const) {
        const menu = menus.find((m) => m.mealType === mealType);
        if (!menu) continue;

        const sabjiMap: Record<string, string[]> = {};
        menu.sabjiOptions.forEach(({ categoryId, productId }) => {
          if (!sabjiMap[categoryId]) sabjiMap[categoryId] = [];
          sabjiMap[categoryId].push(productId);
        });
        const minSabjiMap: Record<string, number> = {};
        menu.thalis.forEach(({ thaliId, minSabjiRequired }) => {
          minSabjiMap[thaliId] = minSabjiRequired;
        });

        updateDraft(mealType, {
          existingId: null, // force create
          selectedThaliIds: menu.thalis.map((t) => t.thaliId),
          sabjiMap,
          minSabjiMap,
        });
      }
      toast.success("Yesterday's menu loaded — review and save");
    } catch { toast.error("Failed to copy yesterday's menu"); }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Daily Menu</h2>
          <p className="text-sm text-gray-500 mt-0.5">Set lunch & dinner for any date</p>
        </div>
        {/* Copy yesterday shortcut */}
        {selectedDate === todayStr && (
          <button
            onClick={copyYesterdayToToday}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-600 border border-dashed border-gray-300 hover:border-orange-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
          >
            <Copy size={14} />
            Copy Yesterday&apos;s Menu
          </button>
        )}
      </div>

      {/* ── Date Navigator ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-2 w-fit shadow-sm">
        <button
          onClick={() => setSelectedDate(dateAddDays(selectedDate, -1))}
          disabled={selectedDate <= todayStr}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft size={18} />
        </button>

        <input
          type="date"
          value={selectedDate}
          min={todayStr}
          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
          className="text-sm font-semibold text-gray-800 border-none outline-none bg-transparent cursor-pointer"
        />
        <span className="text-xs text-gray-400 hidden sm:block">
          {formatDisplayDate(selectedDate)}
        </span>
        {selectedDate === todayStr && (
          <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">TODAY</span>
        )}

        <button
          onClick={() => setSelectedDate(dateAddDays(selectedDate, 1))}
          className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <ChevronRight size={18} />
        </button>

        {selectedDate !== todayStr && (
          <button
            onClick={() => setSelectedDate(todayStr)}
            className="text-xs text-orange-500 hover:text-orange-600 font-semibold px-2 py-1 cursor-pointer"
          >
            Today
          </button>
        )}
      </div>

      {/* ── Meal Columns ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {(["LUNCH", "DINNER"] as const).map((mealType) => (
          <MealColumn
            key={mealType}
            mealType={mealType}
            draft={getDraft(mealType)}
            thalis={thalis}
            products={products}
            templates={templates.filter((t) => t.mealType === mealType)}
            selectedDate={selectedDate}
            todayStr={todayStr}
            onUpdateDraft={(partial) => updateDraft(mealType, partial)}
            onSave={() => saveMenu(mealType)}
            onDelete={() => deleteMenu(mealType)}
            onLoadTemplate={(t) => loadTemplate(mealType, t)}
            onOpenSaveTemplate={() =>
              setTemplateSaveModal({ mealType, open: true, name: "" })
            }
            onDeleteTemplate={deleteTemplate}
          />
        ))}
      </div>

      {/* ── Save Template Modal ─────────────────────────────────────────────── */}
      {templateSaveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() =>
            setTemplateSaveModal((v) => ({ ...v, open: false }))
          } />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-bold text-gray-900">
              Save {templateSaveModal.mealType === "LUNCH" ? "Lunch" : "Dinner"} Template
            </h3>
            <p className="text-sm text-gray-500">
              Give this template a name so you can reuse it later in one click.
            </p>
            <input
              type="text"
              autoFocus
              value={templateSaveModal.name}
              onChange={(e) =>
                setTemplateSaveModal((v) => ({ ...v, name: e.target.value }))
              }
              onKeyDown={(e) => e.key === "Enter" && saveAsTemplate()}
              placeholder="e.g. Regular Lunch, Friday Special..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTemplateSaveModal((v) => ({ ...v, open: false }))}
              >
                Cancel
              </Button>
              <Button variant="primary" size="sm" onClick={saveAsTemplate}>
                <BookmarkPlus size={14} className="mr-1" /> Save Template
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MealColumn sub-component ──────────────────────────────────────────────────
interface MealColumnProps {
  mealType: "LUNCH" | "DINNER";
  draft: MealDraft;
  thalis: Thali[];
  products: Product[];
  templates: MenuTemplate[];
  selectedDate: string;
  todayStr: string;
  onUpdateDraft: (partial: Partial<MealDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  onLoadTemplate: (t: MenuTemplate) => void;
  onOpenSaveTemplate: () => void;
  onDeleteTemplate: (id: string) => void;
}

function MealColumn({
  mealType,
  draft,
  thalis,
  products,
  templates,
  selectedDate,
  todayStr,
  onUpdateDraft,
  onSave,
  onDelete,
  onLoadTemplate,
  onOpenSaveTemplate,
  onDeleteTemplate,
}: MealColumnProps) {
  const [showTemplates, setShowTemplates] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  const isLunch = mealType === "LUNCH";
  const accentClasses = isLunch
    ? { header: "from-orange-500 to-orange-600", tag: "bg-orange-500" }
    : { header: "from-indigo-500 to-indigo-600", tag: "bg-indigo-500" };

  const toggleThali = (thaliId: string) => {
    const next = draft.selectedThaliIds.includes(thaliId)
      ? draft.selectedThaliIds.filter((id) => id !== thaliId)
      : [...draft.selectedThaliIds, thaliId];

    if (!next.includes(thaliId)) {
      const thali = thalis.find((t) => t.id === thaliId);
      const categoryKey = thali?.categoryId ?? `__uncategorized_${thaliId}`;

      const stillHasOtherInGroup = next.some((nid) => {
        const nt = thalis.find((t) => t.id === nid);
        return (nt?.categoryId === thali?.categoryId && thali?.categoryId !== null);
      });

      const newSabjiMap = { ...draft.sabjiMap };
      if (!stillHasOtherInGroup) {
        delete newSabjiMap[categoryKey];
      }

      const newMinMap = { ...draft.minSabjiMap };
      delete newMinMap[thaliId];
      onUpdateDraft({ selectedThaliIds: next, sabjiMap: newSabjiMap, minSabjiMap: newMinMap });
    } else {
      const thali = thalis.find((t) => t.id === thaliId);
      onUpdateDraft({
        selectedThaliIds: next,
        minSabjiMap: {
          ...draft.minSabjiMap,
          [thaliId]: thali?.sabjiCount ?? 1,
        },
      });
    }
  };

  const copyPublicUrl = () => {
    if (!draft.publicSlug) return;
    navigator.clipboard.writeText(`${window.location.origin}/menu/${draft.publicSlug}`);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
    toast.success("Public URL copied!");
  };

  const isPast = selectedDate < todayStr;

  return (
    <div className={`bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm ${isPast ? "opacity-60" : ""}`}>

      {/* Column Header */}
      <div className={`bg-gradient-to-r ${accentClasses.header} px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5 text-white">
          {isLunch ? <Sun size={18} /> : <Moon size={18} />}
          <div>
            <p className="font-bold text-sm">{isLunch ? "Lunch" : "Dinner"}</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Templates section */}
        {templates.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-500 hover:text-orange-600 cursor-pointer"
            >
              <Zap size={12} className="fill-orange-400 text-orange-400" />
              Load Template ({templates.length})
              <span className="text-gray-300 ml-1">{showTemplates ? "▲" : "▼"}</span>
            </button>

            {showTemplates && (
              <div className="mt-2 space-y-1">
                {templates.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    className="flex items-center gap-2 group"
                  >
                    <button
                      type="button"
                      onClick={() => { onLoadTemplate(tmpl); setShowTemplates(false); }}
                      className="flex-1 text-left text-xs px-2.5 py-1.5 bg-gray-50 hover:bg-orange-50 border border-gray-100 hover:border-orange-200 rounded-lg transition-all cursor-pointer"
                    >
                      <span className="font-medium text-gray-700">{tmpl.name}</span>
                      <span className="text-gray-400 ml-2">
                        {tmpl.thaliIds.length} thali · {tmpl.cutoffTime ?? "no cutoff"}
                      </span>
                    </button>
                    <button
                      onClick={() => onDeleteTemplate(tmpl.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-400 transition-all cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cutoff time */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-600 w-20 flex-shrink-0">
            Cutoff Time
          </label>
          <input
            type="time"
            value={draft.cutoffTime}
            onChange={(e) => onUpdateDraft({ cutoffTime: e.target.value })}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 w-full max-w-[130px]"
          />
          <span className="text-xs text-gray-400">IST</span>
        </div>

        {/* Thali selector */}
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <p className="text-xs font-semibold text-gray-600">Thalis</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const allIds = thalis.map((t) => t.id);
                  const minSabjiMap = { ...draft.minSabjiMap };
                  thalis.forEach((t) => {
                    if (minSabjiMap[t.id] === undefined) {
                      minSabjiMap[t.id] = t.sabjiCount ?? 1;
                    }
                  });
                  onUpdateDraft({ selectedThaliIds: allIds, minSabjiMap });
                }}
                className="text-[10px] text-orange-500 hover:underline font-semibold cursor-pointer"
              >
                Select All
              </button>
              <span className="text-[10px] text-gray-300">|</span>
              <button
                type="button"
                onClick={() => {
                  onUpdateDraft({ selectedThaliIds: [], sabjiMap: {}, minSabjiMap: {} });
                }}
                className="text-[10px] text-gray-450 hover:underline font-semibold cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {thalis.map((thali) => {
              const isSelected = draft.selectedThaliIds.includes(thali.id);
              return (
                <button
                  key={thali.id}
                  type="button"
                  onClick={() => toggleThali(thali.id)}
                  className={`text-xs px-3 py-1.5 rounded-xl border font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? `${accentClasses.tag} text-white border-transparent`
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span>{thali.name}</span>
                  {thali.sabjiCount > 0 && (
                    <span className={`text-[10px] px-1 py-0.25 rounded-md ${isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                      {thali.sabjiCount}S
                    </span>
                  )}
                  {thali.category ? (
                    <span className={`text-[9px] px-1 py-0.25 rounded ${isSelected ? "bg-white/10 text-white/80" : "bg-orange-50 text-orange-600 border border-orange-100"}`}>
                      {thali.category.name}
                    </span>
                  ) : (
                    <span className={`text-[9px] px-1 py-0.25 rounded ${isSelected ? "bg-white/10 text-white/80" : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
                      Uncategorized
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category-grouped sabji pickers */}
        {draft.selectedThaliIds.length > 0 && (
          <div className="space-y-3 pt-2">
            {groupThalisByCategory(draft.selectedThaliIds, thalis)
              .filter((g) => g.sabjiCount > 0)
              .map((group) => {
                const groupThalisWithPool = group.thalis.filter((t) => t.sabjiPool && t.sabjiPool.length > 0);
                const pool: Product[] = (
                  groupThalisWithPool.length > 0
                    ? Array.from(
                        new Map(
                          groupThalisWithPool
                            .flatMap((t) => t.sabjiPool ?? [])
                            .map((sp) => [sp.product.id, sp.product])
                        ).values()
                      )
                    : products
                ).filter((p) => !p.isAddOnAvailable);

                return (
                  <SabjiPicker
                    key={group.key}
                    label={`Sabji for category: ${group.label}`}
                    products={pool}
                    selected={draft.sabjiMap[group.key] ?? []}
                    maxCount={group.sabjiCount}
                    minRequired={group.sabjiCount}
                    adminMode={true}
                    onChange={(ids) =>
                      onUpdateDraft({
                        sabjiMap: { ...draft.sabjiMap, [group.key]: ids },
                      })
                    }
                  />
                );
              })}
          </div>
        )}

        {/* Public URL (after save) */}
        {draft.existingId && draft.publicSlug && (
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <Link2 size={13} className="text-gray-400 flex-shrink-0" />
            <code className="text-xs text-orange-600 font-mono flex-1 truncate">
              /menu/{draft.publicSlug}
            </code>
            <button
              onClick={copyPublicUrl}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer flex-shrink-0 flex items-center gap-1"
            >
              {copiedSlug ? (
                <><Check size={12} className="text-emerald-500" /> Copied</>
              ) : (
                "Copy"
              )}
            </button>
            <a
              href={`/menu/${draft.publicSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-orange-500 hover:text-orange-600 flex-shrink-0"
            >
              Open →
            </a>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <Button
            variant="primary"
            className="flex-1"
            isLoading={draft.isSaving}
            disabled={draft.selectedThaliIds.length === 0 || isPast}
            onClick={onSave}
          >
            <Save size={14} className="mr-1.5" />
            {draft.existingId ? "Update" : "Save"} {isLunch ? "Lunch" : "Dinner"}
          </Button>

          {draft.existingId && (
            <>
              <button
                onClick={onOpenSaveTemplate}
                title="Save as template"
                className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 border border-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                <BookmarkPlus size={16} />
              </button>
              <button
                onClick={onDelete}
                disabled={draft.isDeleting}
                title="Delete menu"
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>

        {isPast && (
          <p className="text-xs text-amber-600 text-center">
            Past date — view only
          </p>
        )}
      </div>
    </div>
  );
}
