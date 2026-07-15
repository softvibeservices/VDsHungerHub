"use client";

import { useState } from "react";
import {
  Sun,
  Moon,
  Zap,
  Copy,
  Trash2,
  BookmarkPlus,
  Link2,
  Check,
  X,
  AlertTriangle,
} from "lucide-react";
import TimeField from "@/components/ui/TimeField";
import Button from "@/components/ui/Button";
import SabjiPicker from "@/components/admin/SabjiPicker";
import ThaliSelector from "./_ThaliSelector";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

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

// Groups selected thalis by category for sabji pickers.
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
  const isLunch = mealType === "LUNCH";

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
        minSabjiMap: {
          ...draft.minSabjiMap,
          [thaliId]: thali?.sabjiCount ?? 1,
        },
      });
    }
  };

  const handleSelectCategory = (categoryThaliIds: string[], select: boolean) => {
    let next = [...draft.selectedThaliIds];
    const newMinMap = { ...draft.minSabjiMap };
    const newSabjiMap = { ...draft.sabjiMap };

    if (select) {
      // Add all category thalis that aren't already selected
      categoryThaliIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
          const thali = thalis.find((t) => t.id === id);
          newMinMap[id] = thali?.sabjiCount ?? 1;
        }
      });
    } else {
      // Remove all category thalis from selection
      next = next.filter((id) => !categoryThaliIds.includes(id));
      categoryThaliIds.forEach((id) => {
        delete newMinMap[id];
      });

      // Clear the sabji selection for this category group if no thalis remain
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

    onUpdateDraft({
      selectedThaliIds: next,
      minSabjiMap: newMinMap,
      sabjiMap: newSabjiMap,
    });
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
    <div
      className={cn(
        "bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col h-full",
        isPast && "opacity-75"
      )}
    >
      {/* Column Header */}
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

        {/* Dirty State Indicator */}
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

      {/* Column Content */}
      <div className="p-4 space-y-4 flex-1 overflow-y-auto min-h-[400px]">
        {/* Templates section (always visible, horizontal row) */}
        {templates.length > 0 && (
          <div className="space-y-1.5 bg-gray-50/50 border border-gray-100 p-3 rounded-xl">
            <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Zap size={11} className="fill-orange-400 text-orange-400" /> Load Template:
            </p>
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="flex-shrink-0 flex items-center gap-1 bg-white border border-gray-200 hover:border-orange-300 rounded-lg p-1.5 transition-all text-[11px] group"
                >
                  <button
                    type="button"
                    onClick={() => onLoadTemplate(tmpl)}
                    className="font-semibold text-gray-700 hover:text-orange-500 text-left cursor-pointer"
                  >
                    {tmpl.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteTemplate(tmpl.id)}
                    className="text-gray-300 hover:text-red-500 cursor-pointer p-0.5 transition-colors"
                    title="Delete template"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Copy From / Cutoff Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50/30 border border-gray-100 p-3 rounded-xl">
          <TimeField
            label="Cutoff Time"
            value={draft.cutoffTime}
            onChange={(e) => onUpdateDraft({ cutoffTime: e.target.value })}
            disabled={isPast}
          />
          <div className="flex flex-col justify-end">
            <Button
              variant="secondary"
              onClick={onOpenCopyFrom}
              disabled={isPast}
              leftIcon={<Copy size={13} />}
              size="md"
              className="h-[38px] w-full"
            >
              Copy From...
            </Button>
          </div>
        </div>

        {/* Thali selector */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline">
            <p className="text-xs font-bold text-gray-600">Select Thalis</p>
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
                className="text-[10px] text-orange-500 hover:underline font-bold cursor-pointer"
              >
                Select All
              </button>
              <span className="text-[10px] text-gray-300">|</span>
              <button
                type="button"
                onClick={() => {
                  onUpdateDraft({ selectedThaliIds: [], sabjiMap: {}, minSabjiMap: {} });
                }}
                className="text-[10px] text-gray-450 hover:underline font-bold cursor-pointer"
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
          />
        </div>

        {/* Category-grouped sabji pickers */}
        {draft.selectedThaliIds.length > 0 && (
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-600">Sabji Options Configuration</h4>
            {groupThalisByCategory(draft.selectedThaliIds, thalis)
              .filter((g) => g.sabjiCount > 0)
              .map((group) => {
                const groupThalisWithPool = group.thalis.filter(
                  (t) => t.sabjiPool && t.sabjiPool.length > 0
                );
                const pool = (
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

                const primaryThaliId = group.thalis[0].id;
                const minRequired = draft.minSabjiMap[primaryThaliId] ?? group.sabjiCount;

                return (
                  <SabjiPicker
                    key={group.key}
                    label={`Sabji for category: ${group.label}`}
                    products={pool}
                    selected={draft.sabjiMap[group.key] ?? []}
                    maxCount={group.sabjiCount}
                    minRequired={minRequired}
                    adminMode={true}
                    onMinChange={(n) => {
                      const updatedMinMap = { ...draft.minSabjiMap };
                      group.thalis.forEach((t) => {
                        updatedMinMap[t.id] = n;
                      });
                      onUpdateDraft({ minSabjiMap: updatedMinMap });
                    }}
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
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
            <Link2 size={14} className="text-gray-400 flex-shrink-0" />
            <code className="text-xs text-orange-600 font-mono flex-1 truncate">
              /menu/{draft.publicSlug}
            </code>
            <button
              onClick={copyPublicUrl}
              className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer flex-shrink-0 flex items-center gap-1 font-semibold"
            >
              {copiedSlug ? (
                <>
                  <Check size={12} className="text-emerald-500" /> Copied
                </>
              ) : (
                "Copy"
              )}
            </button>
            <a
              href={`/menu/${draft.publicSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-orange-500 hover:text-orange-600 flex-shrink-0"
            >
              Open &rarr;
            </a>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-3 border-t border-gray-100 flex-shrink-0">
          <Button
            variant="primary"
            className={cn("flex-1", isDirty && !isPast && "animate-pulse")}
            isLoading={draft.isSaving}
            disabled={draft.selectedThaliIds.length === 0 || isPast}
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
    </div>
  );
}
