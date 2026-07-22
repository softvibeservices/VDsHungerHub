"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Thali {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  sabjiCount: number;
}

interface ThaliSelectorProps {
  allThalis: Thali[];
  selectedThaliIds: string[];
  onToggle: (thaliId: string) => void;
  onSelectCategory: (thaliIds: string[], select: boolean) => void;
  sabjiMap: Record<string, string[]>;
  minSabjiMap: Record<string, number>;
  onManageSabji: (categoryId: string) => void;
}

export default function ThaliSelector({
  allThalis,
  selectedThaliIds,
  onToggle,
  onSelectCategory,
  sabjiMap,
  minSabjiMap,
  onManageSabji,
}: ThaliSelectorProps) {
  // Group thalis by category
  const groups = useMemo(() => {
    const categoryMap = new Map<string, { name: string; thalis: Thali[] }>();
    const uncategorized: Thali[] = [];

    allThalis.forEach((t) => {
      if (t.categoryId && t.category) {
        if (!categoryMap.has(t.categoryId)) {
          categoryMap.set(t.categoryId, { name: t.category.name, thalis: [] });
        }
        categoryMap.get(t.categoryId)!.thalis.push(t);
      } else {
        uncategorized.push(t);
      }
    });

    return {
      categories: Array.from(categoryMap.entries()).map(([id, c]) => ({
        id,
        name: c.name,
        thalis: c.thalis,
      })),
      uncategorized,
    };
  }, [allThalis]);

  return (
    <div className="space-y-4">
      {/* Category Groups */}
      {groups.categories.map((cat) => {
        const catSelected = cat.thalis.filter((t) => selectedThaliIds.includes(t.id));
        const allSelected = catSelected.length === cat.thalis.length;

        // Check if any thali in this category requires a sabji choice
        const requiresSabji = cat.thalis.some((t) => t.sabjiCount > 0);
        
        // Compute minRequired per category as the maximum minSabjiRequired / sabjiCount across all selected thalis in that category
        const minRequired = catSelected.length > 0
          ? Math.max(...catSelected.map((t) => minSabjiMap[t.id] ?? t.sabjiCount))
          : 0;
        const selectedCount = (sabjiMap[cat.id] ?? []).length;
        const isOk = selectedCount >= Math.max(minRequired, 1);

        return (
          <div
            key={cat.id}
            className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-2.5 gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-extrabold text-sm text-gray-800">{cat.name}</h4>
                  {requiresSabji && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                      Pick ≥ {cat.thalis[0]?.sabjiCount ?? 1} dish{(cat.thalis[0]?.sabjiCount ?? 1) === 1 ? "" : "es"}
                    </span>
                  )}
                  <span className="text-[10px] text-gray-400 font-medium">
                    ({catSelected.length} of {cat.thalis.length} selected)
                  </span>
                </div>
                {catSelected.length > 0 && requiresSabji && (
                  <p className={cn("text-[11px] font-bold mt-0.5", isOk ? "text-emerald-600" : "text-red-600")}>
                    {selectedCount} dish{selectedCount === 1 ? "" : "es"} added — {isOk ? "ready ✓" : `need at least ${minRequired}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 self-end sm:self-center">
                {catSelected.length > 0 && requiresSabji && (
                  <button
                    type="button"
                    onClick={() => onManageSabji(cat.id)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-sm",
                      isOk
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                        : "bg-orange-500 border-orange-500 text-white hover:bg-orange-600"
                    )}
                  >
                    Select Sabji
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelectCategory(cat.thalis.map((t) => t.id), !allSelected)}
                  className="text-[10px] text-orange-500 hover:underline font-bold cursor-pointer"
                >
                  {allSelected ? "Clear All" : "Select All"}
                </button>
              </div>
            </div>

            {/* Inline Flex Row for Same-Category Thalis */}
            <div className="flex flex-wrap gap-2.5">
              {cat.thalis.map((t) => {
                const isSelected = selectedThaliIds.includes(t.id);
                return (
                  <label
                    key={t.id}
                    className={cn(
                      "flex items-center justify-between gap-3 p-3 border rounded-xl cursor-pointer transition-all hover:bg-gray-50/50 select-none min-h-[46px] flex-1 min-w-[200px] max-w-[280px]",
                      isSelected
                        ? "bg-orange-50/20 border-orange-200"
                        : "bg-white border-gray-100 hover:border-gray-200"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggle(t.id)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-400 h-4 w-4"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-gray-700 leading-tight">
                          {t.name}
                        </span>
                        <span className="text-[10px] text-gray-450 mt-0.5 font-medium">
                          ₹{t.price} · {t.sabjiCount} {t.sabjiCount === 1 ? "sabji" : "sabjis"}
                        </span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Uncategorized Section */}
      {groups.uncategorized.length > 0 && (
        <div className="bg-amber-50/30 border border-amber-100 rounded-2xl p-4 shadow-sm space-y-3">
          {/* Header */}
          <div className="flex items-baseline gap-2 border-b border-amber-100 pb-2">
            <h4 className="font-extrabold text-sm text-amber-800 flex items-center gap-1.5">
              <AlertCircle size={15} /> Uncategorized Thalis
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {groups.uncategorized.map((t) => {
              const isSelected = selectedThaliIds.includes(t.id);
              const needsCategory = t.sabjiCount > 0;

              return (
                <div
                  key={t.id}
                  className={cn(
                    "flex items-center justify-between p-3 border rounded-xl select-none min-h-[46px]",
                    needsCategory
                      ? "bg-gray-50/50 border-gray-200 opacity-60 cursor-not-allowed"
                      : isSelected
                      ? "bg-orange-50/20 border-orange-200 cursor-pointer"
                      : "bg-white border-gray-100 hover:border-gray-200 cursor-pointer"
                  )}
                  title={needsCategory ? "Needs a category to support sabji options" : undefined}
                >
                  <label className="flex items-center gap-2.5 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={needsCategory}
                      onChange={() => onToggle(t.id)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-400 h-4 w-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-gray-700 leading-tight">
                        {t.name}
                      </span>
                      <span className="text-[10px] text-gray-450 mt-0.5">
                        ₹{t.price} · {t.sabjiCount} {t.sabjiCount === 1 ? "sabji" : "sabjis"}
                      </span>
                    </div>
                  </label>

                  {needsCategory && (
                    <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-100 font-bold px-1.5 py-0.5 rounded">
                      Disabled
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Hint warning to fix in catalog */}
          {groups.uncategorized.some((t) => t.sabjiCount > 0) && (
            <p className="text-[11px] text-amber-700 leading-relaxed pt-1">
              ⚠️ Thalis requiring sabjis cannot be added until they are assigned a category.{" "}
              <Link
                href="/catalog"
                className="font-bold underline hover:text-amber-800 transition-colors"
              >
                Fix in Catalog &rarr;
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
