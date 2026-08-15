// src\app\(admin)\daily-menu\page.tsx

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { getTodayIST } from "@/lib/utils";
import WeekStrip from "./_WeekStrip";
import MealColumn from "./_MealColumn";
import CopyFromDialog from "./_CopyFromDialog";
import SaveTemplateModal from "./_SaveTemplateModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import useDirtyState from "@/hooks/useDirtyState";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { validateSabjiCoverage } from "@/lib/menu-validation";

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

interface MealDraft {
  existingId: string | null;
  publicSlug: string | null;
  selectedThaliIds: string[];
  sabjiMap: Record<string, string[]>;
  minSabjiMap: Record<string, number>;
  isSaving: boolean;
  isDeleting: boolean;
}

function emptyDraft(mealType: "LUNCH" | "DINNER", allThalis: Thali[] = []): MealDraft {
  const activeThalis = allThalis.filter((t) => t.isActive);
  const minSabjiMap: Record<string, number> = {};
  activeThalis.forEach((t) => { minSabjiMap[t.id] = t.sabjiCount ?? 1; });

  return {
    existingId: null,
    publicSlug: null,
    selectedThaliIds: activeThalis.map((t) => t.id),
    sabjiMap: {},
    minSabjiMap,
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

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { hasPermission } from "@/lib/rbac-client";

export default function MenuPage() {
  const currentUser = useCurrentUser();
  const canManageMenu = hasPermission(currentUser, "menu:manage");
  const todayStr = getTodayIST();
  const dateInputRef = useRef<HTMLInputElement>(null);

  const handleOpenDatePicker = () => {
    dateInputRef.current?.showPicker();
  };

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("date");
    if (fromQuery && /^\d{4}-\d{2}-\d{2}$/.test(fromQuery)) {
      setSelectedDate(fromQuery);
    }
  }, []);

  const [thalis, setThalis] = useState<Thali[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [summaries, setSummaries] = useState<DaySummary[]>([]);

  const [lunchDraft, setLunchDraft] = useState<MealDraft>(() => emptyDraft("LUNCH"));
  const [dinnerDraft, setDinnerDraft] = useState<MealDraft>(() => emptyDraft("DINNER"));

  const [lunchSnapshot, setLunchSnapshot] = useState<MealDraft | null>(null);
  const [dinnerSnapshot, setDinnerSnapshot] = useState<MealDraft | null>(null);

  const isLunchDirty = useDirtyState(lunchDraft, lunchSnapshot);
  const isDinnerDirty = useDirtyState(dinnerDraft, dinnerSnapshot);

  const [isLoading, setIsLoading] = useState(true);

  // Modals / dialogs
  const [pendingDateChange, setPendingDateChange] = useState<string | null>(null);
  const [deleteConfirmMeal, setDeleteConfirmMeal] = useState<"LUNCH" | "DINNER" | null>(null);
  const [copyModalMeal, setCopyModalMeal] = useState<"LUNCH" | "DINNER" | null>(null);
  const [templateSaveModal, setTemplateSaveModal] = useState<{
    isOpen: boolean;
    mealType: "LUNCH" | "DINNER";
  }>({ isOpen: false, mealType: "LUNCH" });

  const [pendingCopySource, setPendingCopySource] = useState<{
    mealType: "LUNCH" | "DINNER";
    sourceDate: string;
  } | null>(null);

  const [mobileActiveTab, setMobileActiveTab] = useState<"LUNCH" | "DINNER">("LUNCH");

  const fetchCatalog = useCallback(async () => {
    try {
      const [tRes, pRes, tmplRes] = await Promise.all([
        fetch("/api/thalis?isActive=true"),
        fetch("/api/products?isActive=true"),
        fetch("/api/menu-templates"),
      ]);
      const [tJson, pJson, tmplJson] = await Promise.all([
        tRes.json(),
        pRes.json(),
        tmplRes.json(),
      ]);
      const loadedThalis: Thali[] = tJson.thalis ?? [];
      const loadedProducts: Product[] = pJson.products ?? [];
      setThalis(loadedThalis);
      setProducts(loadedProducts);
      setTemplates(tmplJson.templates ?? []);
      return { loadedThalis };
    } catch {
      toast.error("Failed to load catalog");
      return { loadedThalis: [] };
    }
  }, []);

  const fetchSummaries = useCallback(async (anchorDateStr: string) => {
    try {
      const res = await fetch(`/api/menu-summaries?anchorDate=${anchorDateStr}`);
      const json = await res.json();
      setSummaries(json.summaries ?? []);
    } catch {
      // non-critical
    }
  }, []);

  const fetchMenusForDate = useCallback(
    async (dateStr: string, catalogThalis: Thali[]) => {
      try {
        const res = await fetch(`/api/menu?date=${dateStr}`);
        const json = await res.json();
        const menus: DailyMenu[] = json.menus ?? [];

        const lunchMenu = menus.find((m) => m.mealType === "LUNCH");
        const dinnerMenu = menus.find((m) => m.mealType === "DINNER");

        const buildDraftFromMenu = (menu: DailyMenu): MealDraft => {
          const sabjiMap: Record<string, string[]> = {};
          menu.sabjiOptions.forEach(({ categoryId, productId }) => {
            if (!sabjiMap[categoryId]) sabjiMap[categoryId] = [];
            sabjiMap[categoryId].push(productId);
          });

          const minSabjiMap: Record<string, number> = {};
          menu.thalis.forEach(({ thaliId, minSabjiRequired }) => {
            minSabjiMap[thaliId] = minSabjiRequired;
          });

          return {
            existingId: menu.id,
            publicSlug: menu.publicSlug ?? null,
            selectedThaliIds: menu.thalis.map((t) => t.thaliId),
            sabjiMap,
            minSabjiMap,
            isSaving: false,
            isDeleting: false,
          };
        };

        const newLunch = lunchMenu
          ? buildDraftFromMenu(lunchMenu)
          : emptyDraft("LUNCH", catalogThalis);
        const newDinner = dinnerMenu
          ? buildDraftFromMenu(dinnerMenu)
          : emptyDraft("DINNER", catalogThalis);

        setLunchDraft(newLunch);
        setDinnerDraft(newDinner);

        setLunchSnapshot(lunchMenu ? newLunch : null);
        setDinnerSnapshot(dinnerMenu ? newDinner : null);
      } catch {
        toast.error("Failed to load menus for date");
      }
    },
    []
  );

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      const { loadedThalis } = await fetchCatalog();
      if (!active) return;
      await Promise.all([
        fetchMenusForDate(selectedDate, loadedThalis),
        fetchSummaries(selectedDate),
      ]);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [fetchCatalog, fetchMenusForDate, fetchSummaries, selectedDate]);

  const loadDateTarget = (targetDateStr: string) => {
    setSelectedDate(targetDateStr);
    fetchMenusForDate(targetDateStr, thalis);
    fetchSummaries(targetDateStr);
  };

  const handleSelectDate = (dateStr: string) => {
    if (dateStr === selectedDate) return;
    if (isLunchDirty || isDinnerDirty) {
      setPendingDateChange(dateStr);
    } else {
      loadDateTarget(dateStr);
    }
  };

  const getDraft = (mealType: "LUNCH" | "DINNER"): MealDraft =>
    mealType === "LUNCH" ? lunchDraft : dinnerDraft;

  const updateDraft = (mealType: "LUNCH" | "DINNER", patch: Partial<MealDraft>) => {
    if (mealType === "LUNCH") {
      setLunchDraft((prev) => ({ ...prev, ...patch }));
    } else {
      setDinnerDraft((prev) => ({ ...prev, ...patch }));
    }
  };

  const applyTemplateToMeal = (template: MenuTemplate, mealType: "LUNCH" | "DINNER") => {
    const sabjiMap: Record<string, string[]> = {};
    template.sabjiConfig.forEach(({ categoryId, productIds }) => {
      sabjiMap[categoryId] = productIds;
    });

    updateDraft(mealType, {
      selectedThaliIds: template.thaliIds,
      sabjiMap,
    });
    toast.success(`Loaded template "${template.name}"`);
  };

  const handleSaveMenu = async (mealType: "LUNCH" | "DINNER") => {
    const draft = getDraft(mealType);
    if (draft.selectedThaliIds.length === 0) {
      toast.error("Please select at least one thali");
      return;
    }

    const groups = groupThalisByCategory(draft.selectedThaliIds, thalis);

    const thaliConfig = draft.selectedThaliIds.map((thaliId) => ({
      thaliId,
      minSabjiRequired: draft.minSabjiMap[thaliId] ?? 1,
    }));

    const validationSabjiGroups = groups
      .filter((g) => g.thalis[0].categoryId)
      .map((g) => ({
        categoryId: g.thalis[0].categoryId!,
        productIds: draft.sabjiMap[g.key] ?? [],
      }));

    const validationResult = validateSabjiCoverage(thalis, thaliConfig, validationSabjiGroups);
    if (!validationResult.isValid) {
      const firstIssue = validationResult.issues[0];
      toast.error(`Please select sabji choices for ${firstIssue.label}`);
      return;
    }

    updateDraft(mealType, { isSaving: true });
    try {
      const sabjiOptions: { categoryId: string; productId: string }[] = [];
      for (const group of groups) {
        const categoryId = group.thalis[0].categoryId;
        if (categoryId) {
          const productIds = draft.sabjiMap[group.key] ?? [];
          for (const productId of productIds) {
            sabjiOptions.push({ categoryId, productId });
          }
        }
      }

      const url = draft.existingId ? `/api/menu/${draft.existingId}` : "/api/menu";
      const method = draft.existingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          mealType,
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

      if (mealType === "LUNCH") setLunchSnapshot(updatedDraft);
      else setDinnerSnapshot(updatedDraft);

      fetchSummaries(selectedDate);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
      updateDraft(mealType, { isSaving: false });
    }
  };

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

      fetchSummaries(selectedDate);
    } catch {
      toast.error("Delete failed");
      updateDraft(mealType, { isDeleting: false });
    } finally {
      setDeleteConfirmMeal(null);
    }
  };

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

      updateDraft(mealType, {
        existingId: null,
        selectedThaliIds: menu.thalis.map((t) => t.thaliId),
        sabjiMap,
        minSabjiMap,
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
    <div className="space-y-6">
      {/* Compact Week Strip Navigation */}
      <WeekStrip
        selectedDate={selectedDate}
        todayStr={todayStr}
        summaries={summaries}
        onSelect={handleSelectDate}
        onOpenDatePicker={handleOpenDatePicker}
      />

      <input
        type="date"
        ref={dateInputRef}
        value={selectedDate}
        onChange={(e) => e.target.value && handleSelectDate(e.target.value)}
        className="sr-only absolute pointer-events-none"
      />

      {/* Mobile Tab Segmented Control */}
      <div className="flex md:hidden border border-gray-200 rounded-xl overflow-hidden p-1 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setMobileActiveTab("LUNCH")}
          className={cn(
            "flex-grow flex-1 py-2 text-xs font-bold text-center rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
            mobileActiveTab === "LUNCH"
              ? "bg-orange-500 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-50"
          )}
        >
          <span>🌞 Lunch Menu</span>
          {lunchDraft.existingId && (
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setMobileActiveTab("DINNER")}
          className={cn(
            "flex-grow flex-1 py-2 text-xs font-bold text-center rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5",
            mobileActiveTab === "DINNER"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-50"
          )}
        >
          <span>🌙 Dinner Menu</span>
          {dinnerDraft.existingId && (
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          )}
        </button>
      </div>

      {/* Main Grid: Lunch and Dinner Columns Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* LUNCH COLUMN */}
        <div className={cn("space-y-4", mobileActiveTab !== "LUNCH" && "hidden md:block")}>
          <MealColumn
            mealType="LUNCH"
            readOnly={!canManageMenu}
            selectedDate={selectedDate}
            todayStr={todayStr}
            draft={lunchDraft}
            isDirty={isLunchDirty}
            thalis={thalis}
            products={products}
            templates={templates}
            onUpdateDraft={(patch: Partial<MealDraft>) => updateDraft("LUNCH", patch)}
            onSave={() => handleSaveMenu("LUNCH")}
            onDelete={() => setDeleteConfirmMeal("LUNCH")}
            onLoadTemplate={(t) => applyTemplateToMeal(t, "LUNCH")}
            onOpenSaveTemplate={() =>
              setTemplateSaveModal({ isOpen: true, mealType: "LUNCH" })
            }
            onDeleteTemplate={deleteTemplate}
            onOpenCopyFrom={() => setCopyModalMeal("LUNCH")}
          />
        </div>

        {/* DINNER COLUMN */}
        <div className={cn("space-y-4", mobileActiveTab !== "DINNER" && "hidden md:block")}>
          <MealColumn
            mealType="DINNER"
            readOnly={!canManageMenu}
            selectedDate={selectedDate}
            todayStr={todayStr}
            draft={dinnerDraft}
            isDirty={isDinnerDirty}
            thalis={thalis}
            products={products}
            templates={templates}
            onUpdateDraft={(patch: Partial<MealDraft>) => updateDraft("DINNER", patch)}
            onSave={() => handleSaveMenu("DINNER")}
            onDelete={() => setDeleteConfirmMeal("DINNER")}
            onLoadTemplate={(t) => applyTemplateToMeal(t, "DINNER")}
            onOpenSaveTemplate={() =>
              setTemplateSaveModal({ isOpen: true, mealType: "DINNER" })
            }
            onDeleteTemplate={deleteTemplate}
            onOpenCopyFrom={() => setCopyModalMeal("DINNER")}
          />
        </div>
      </div>

      {/* Confirmation modal for unsaved changes before date change */}
      <ConfirmDialog
        isOpen={!!pendingDateChange}
        onClose={() => setPendingDateChange(null)}
        onConfirm={() => {
          if (pendingDateChange) {
            loadDateTarget(pendingDateChange);
            setPendingDateChange(null);
          }
        }}
        title="Unsaved Changes"
        message="You have unsaved menu edits for this date. Switching dates will discard your changes."
        confirmLabel="Discard & Switch Date"
      />

      <ConfirmDialog
        isOpen={!!pendingCopySource}
        onClose={() => setPendingCopySource(null)}
        onConfirm={handleConfirmCopyOverwrite}
        title="Overwrite Unsaved Menu?"
        message="You have unsaved changes in your current menu draft. Copying from another date will overwrite your current edits."
        confirmLabel="Yes, Overwrite Draft"
      />

      <ConfirmDialog
        isOpen={!!deleteConfirmMeal}
        onClose={() => setDeleteConfirmMeal(null)}
        onConfirm={runDeleteMenu}
        title={`Delete ${deleteConfirmMeal === "LUNCH" ? "Lunch" : "Dinner"} Menu?`}
        message={`Are you sure you want to delete the ${
          deleteConfirmMeal === "LUNCH" ? "Lunch" : "Dinner"
        } menu for ${formatDisplayDate(selectedDate)}?`}
        confirmLabel="Delete Menu"
        isLoading={
          deleteConfirmMeal
            ? getDraft(deleteConfirmMeal).isDeleting
            : false
        }
      />

      {copyModalMeal && (
        <CopyFromDialog
          isOpen={!!copyModalMeal}
          mealType={copyModalMeal}
          selectedDate={selectedDate}
          summaries={summaries}
          onClose={() => setCopyModalMeal(null)}
          onCopy={(srcDate: string) => handleCopyFromSelect(srcDate, copyModalMeal)}
        />
      )}

      {templateSaveModal.isOpen && (
        <SaveTemplateModal
          isOpen={templateSaveModal.isOpen}
          mealType={templateSaveModal.mealType}
          onClose={() => setTemplateSaveModal({ isOpen: false, mealType: "LUNCH" })}
          onSave={saveAsTemplate}
        />
      )}
    </div>
  );
}
