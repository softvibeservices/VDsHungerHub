"use client";

import { useState } from "react";
import { Sun, Moon, Zap, Copy, Trash2, BookmarkPlus, Link2, Check, X, AlertTriangle, ChevronDown } from "lucide-react";
import TimeField from "@/components/ui/TimeField";
import Button from "@/components/ui/Button";
import SabjiPickerModal from "./_SabjiPickerModal";
import ThaliSelector from "./_ThaliSelector";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { validateSabjiCoverage } from "@/lib/menu-validation";

interface ThaliCategory {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
  isAddOnAvailable: boolean;
}

interface SabjiPoolEntry {
  productId: string;
  product: Product;
}

interface Thali {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  categoryId: string | null;
  category: ThaliCategory | null;
  sabjiCount: number;
  sabjiPool?: SabjiPoolEntry[];
}

interface MenuTemplate {
  id: string;
  name: string;
  mealType: "LUNCH" | "DINNER";
  cutoffTime: string | null;
  thaliIds: string[];
  sabjiConfig: { categoryId: string; productIds: string[] }[];
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

interface MealColumnProps {
  mealType: "LUNCH" | "DINNER";
  draft: MealDraft;
  isDirty: boolean;
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
  onOpenCopyFrom: () => void;
}

// Groups selected thalis by category for sabji pickers. (unchanged from original)
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

export default function MealColumn({
  mealType,
  draft,
  isDirty,
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
  onOpenCopyFrom,
}: MealColumnProps) {
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [activeDishGroupKey, setActiveDishGroupKey] = useState<string | null>(null);
  const [confirmDeleteTemplateId, setConfirmDeleteTemplateId] = useState<string | null>(null);
  const [isTemplateMenuOpen, setIsTemplateMenuOpen] = useState(false);
  const isLunch = mealType === "LUNCH";
  const isPast = selectedDate < todayStr;

  const toggleThali = (thaliId: string) => {
    const next = draft.selectedThaliIds.includes(thaliId)
      ? draft.selectedThaliIds.filter((id) => id !== thaliId)
      : [...draft.selectedThaliIds, thaliId];

    if (!next.includes(thaliId)) {
      const thali = thalis.find((t) => t.id === thaliId);
      const categoryKey = thali?.categoryId ?? `__uncategorized_${thaliId}`;

      const stillHasOtherInGroup = next.some((nid) => {
        const nt = thalis.find((t) => t.id === nid);
        return nt?.categoryId === thali?.categoryId && thali?.categoryId !== null;
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
        minSabjiMap: { ...draft.minSabjiMap, [thaliId]: thali?.sabjiCount ?? 1 },
      });
    }
  };

  const handleSelectCategory = (categoryThaliIds: string[], select: boolean) => {
    let next = [...draft.selectedThaliIds];
    const newMinMap = { ...draft.minSabjiMap };
    const newSabjiMap = { ...draft.sabjiMap };

    if (select) {
      categoryThaliIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
          const thali = thalis.find((t) => t.id === id);
          newMinMap[id] = thali?.sabjiCount ?? 1;
        }
      });
    } else {
      next = next.filter((id) => !categoryThaliIds.includes(id));
      categoryThaliIds.forEach((id) => {
        delete newMinMap[id];
      });

      const sampleThali = thalis.find((t) => t.id === categoryThaliIds[0]);
      if (sampleThali?.categoryId) {
        const hasRemaining = next.some((id) => {
          const t = thalis.find((th) => th.id === id);
          return t?.categoryId === sampleThali.categoryId;
        });
        if (!hasRemaining) {
          delete newSabjiMap[sampleThali.categoryId];
        }
      }
    }

    onUpdateDraft({ selectedThaliIds: next, minSabjiMap: newMinMap, sabjiMap: newSabjiMap });
  };

  const copyPublicUrl = () => {
    if (!draft.publicSlug) return;
    navigator.clipboard.writeText(`${window.location.origin}/menu/${draft.publicSlug}`);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
    toast.success("Public URL copied!");
  };

  const dishGroups = groupThalisByCategory(draft.selectedThaliIds, thalis).filter((g) => g.sabjiCount > 0);

  // Build the exact same shaped payload saveMenu() will send, so the on-screen
  // readiness indicator is always 100% consistent with what the server accepts.
  const thaliConfigForValidation = draft.selectedThaliIds.map((tid) => ({
    thaliId: tid,
    minSabjiRequired: draft.minSabjiMap[tid] ?? 1,
  }));
  const sabjiOptionsForValidation = dishGroups
    .filter((g) => g.thalis[0].categoryId)
    .map((g) => ({ categoryId: g.thalis[0].categoryId!, productIds: draft.sabjiMap[g.key] ?? [] }));
  const validation = validateSabjiCoverage(thalis, thaliConfigForValidation, sabjiOptionsForValidation);

  const activeGroup = dishGroups.find((g) => g.key === activeDishGroupKey) ?? null;
  const activeGroupPool = activeGroup
    ? (() => {
        const groupThalisWithPool = activeGroup.thalis.filter((t) => t.sabjiPool && t.sabjiPool.length > 0);
        return (
          groupThalisWithPool.length > 0
            ? Array.from(
                new Map(groupThalisWithPool.flatMap((t) => t.sabjiPool ?? []).map((sp) => [sp.product.id, sp.product])).values()
              )
            : products
        ).filter((p) => !p.isAddOnAvailable);
      })()
    : [];

  const activeGroupMinRequired = activeGroup
    ? Math.max(...activeGroup.thalis.map((t) => draft.minSabjiMap[t.id] ?? t.sabjiCount))
    : 0;

  return (
    <div
      className={cn(
        "bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full",
        isPast && "opacity-75"
      )}
    >
      {/* Column Header (unchanged) */}
      <div
        className={cn(
          "bg-gradient-to-r px-4 py-3.5 flex items-center justify-between flex-shrink-0 border-b border-gray-100",
          isLunch ? "from-orange-500 to-orange-600" : "from-indigo-500 to-indigo-600"
        )}
      >
        <div className="flex items-center gap-2.5 text-white">
          {isLunch ? <Sun size={18} /> : <Moon size={18} />}
          <div>
            <h3 className="font-extrabold text-sm">{isLunch ? "Lunch" : "Dinner"} Menu</h3>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isDirty ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-200 border border-amber-400/20 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Unsaved changes
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Saved
            </span>
          )}
        </div>
      </div>

      {/* SCROLLABLE MIDDLE ZONE — the only scroll region while browsing this column */}
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* Ultra-compact Actions Row: Load Template Dropdown + Copy Past Menu */}
        <div className="flex items-center gap-2 flex-wrap pb-1">
          {/* Load Template Popover Dropdown Button */}
          {templates.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTemplateMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-orange-50/50 hover:border-orange-300 text-xs font-bold text-gray-700 shadow-sm transition-all cursor-pointer"
              >
                <Zap size={13} className="fill-orange-400 text-orange-400" />
                Load Template ({templates.length})
                <ChevronDown size={12} className={cn("transition-transform text-gray-400", isTemplateMenuOpen && "rotate-180")} />
              </button>

              {/* Floating Dropdown Menu */}
              {isTemplateMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsTemplateMenuOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-1.5 w-60 bg-white border border-gray-200 rounded-xl shadow-xl z-30 p-1.5 space-y-1 animate-fadeIn">
                    <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider px-2.5 py-1 flex items-center justify-between">
                      <span>Saved Templates</span>
                      <span className="text-[9px] text-gray-300">Click to apply</span>
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-0.5">
                      {templates.map((tmpl) => (
                        <div
                          key={tmpl.id}
                          className="flex items-center justify-between gap-2 p-2 hover:bg-orange-50/70 rounded-lg group transition-colors"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onLoadTemplate(tmpl);
                              setIsTemplateMenuOpen(false);
                            }}
                            className="flex-1 text-left text-xs font-bold text-gray-800 hover:text-orange-600 truncate cursor-pointer"
                          >
                            {tmpl.name}
                          </button>
                          {confirmDeleteTemplateId === tmpl.id ? (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteTemplate(tmpl.id);
                                  setConfirmDeleteTemplateId(null);
                                }}
                                className="text-red-600 hover:bg-red-100 p-1 rounded font-bold text-[10px] cursor-pointer"
                                title="Confirm delete"
                              >
                                <Check size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTemplateId(null)}
                                className="text-gray-400 hover:bg-gray-100 p-1 rounded cursor-pointer"
                                title="Cancel"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTemplateId(tmpl.id)}
                              className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors cursor-pointer"
                              title="Delete template"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Copy From Past Menu Button */}
          <button
            type="button"
            onClick={onOpenCopyFrom}
            disabled={isPast}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-orange-50/50 hover:border-orange-300 text-xs font-bold text-gray-700 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <Copy size={13} className="text-gray-500" />
            Copy Past Menu...
          </button>
        </div>

        {/* Step 1 — Thali selector (unchanged) */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <p className="text-xs font-bold text-gray-600">Step 1 — Select Thalis</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const allIds = thalis.map((t) => t.id);
                  const minSabjiMap = { ...draft.minSabjiMap };
                  thalis.forEach((t) => {
                    if (minSabjiMap[t.id] === undefined) minSabjiMap[t.id] = t.sabjiCount ?? 1;
                  });
                  onUpdateDraft({ selectedThaliIds: allIds, minSabjiMap });
                }}
                className="text-[10px] text-orange-500 hover:underline font-bold cursor-pointer"
              >
                Select All
              </button>
              <span className="text-[10px] text-gray-300">|</span>
              <button
                type="button"
                onClick={() => onUpdateDraft({ selectedThaliIds: [], sabjiMap: {}, minSabjiMap: {} })}
                className="text-[10px] text-gray-400 hover:underline font-bold cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          <ThaliSelector
            allThalis={thalis}
            selectedThaliIds={draft.selectedThaliIds}
            onToggle={toggleThali}
            onSelectCategory={handleSelectCategory}
            sabjiMap={draft.sabjiMap}
            minSabjiMap={draft.minSabjiMap}
            onManageSabji={setActiveDishGroupKey}
          />
        </div>
      </div>

      {/* STICKY BOTTOM ZONE — always visible, never scrolls away */}
      <div className="flex-shrink-0 border-t border-gray-100 bg-white p-4 space-y-3">
        {draft.selectedThaliIds.length > 0 && !validation.isValid && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 space-y-1 animate-fadeIn">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
              <span>Select required Sabjis before saving:</span>
            </div>
            <ul className="text-[11px] font-semibold text-amber-800 list-disc list-inside pl-1 space-y-0.5">
              {validation.issues.map((issue) => (
                <li key={issue.key}>
                  <strong className="text-amber-950">{issue.label}</strong>: needs at least {issue.required} sabji{issue.required > 1 ? "s" : ""} ({issue.configured} selected)
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="primary"
            className={cn("flex-1", isDirty && validation.isValid && !isPast && "animate-pulse")}
            isLoading={draft.isSaving}
            disabled={draft.selectedThaliIds.length === 0 || !validation.isValid || isPast}
            onClick={onSave}
          >
            <BookmarkPlus size={15} className="mr-1.5" />
            {draft.existingId ? "Update" : "Save"} {isLunch ? "Lunch" : "Dinner"}
          </Button>

          {draft.existingId && (
            <>
              <button
                onClick={onOpenSaveTemplate}
                title="Save as template"
                className="p-2.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 border border-gray-200 hover:border-orange-200 rounded-xl transition-colors cursor-pointer"
              >
                <BookmarkPlus size={16} />
              </button>
              <button
                onClick={onDelete}
                disabled={draft.isDeleting}
                title="Delete menu"
                className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-xl transition-colors cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>

        {isPast && (
          <div className="flex items-center justify-center gap-1.5 p-2 bg-amber-50 border border-amber-100 rounded-xl text-xs font-semibold text-amber-700">
            <AlertTriangle size={14} />
            Past date — view only mode
          </div>
        )}
      </div>

      {/* Full-screen Dish Picker Modal — the ONLY place a long dish list is ever shown */}
      {activeGroup && (
        <SabjiPickerModal
          isOpen={true}
          onClose={() => setActiveDishGroupKey(null)}
          categoryLabel={activeGroup.label}
          thaliNames={activeGroup.thalis.map((t) => t.name)}
          products={activeGroupPool}
          selected={draft.sabjiMap[activeGroup.key] ?? []}
          maxCount={activeGroup.sabjiCount}
          minRequired={activeGroupMinRequired}
          readOnly={isPast}
          onMinChange={(n) => {
            const updatedMinMap = { ...draft.minSabjiMap };
            activeGroup.thalis.forEach((t) => {
              updatedMinMap[t.id] = Math.min(n, t.sabjiCount);
            });
            onUpdateDraft({ minSabjiMap: updatedMinMap });
          }}
          onChange={(ids) => onUpdateDraft({ sabjiMap: { ...draft.sabjiMap, [activeGroup.key]: ids } })}
        />
      )}
    </div>
  );
}
