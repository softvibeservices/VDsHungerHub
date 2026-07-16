// src/app/(admin)/daily-menu/_SabjiPickerModal.tsx
"use client";

import { useMemo } from "react";
import { Search, X, Zap, Check } from "lucide-react";
import { useSabjiSearch } from "@/hooks/useSabjiSearch";
import { cn } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
}

interface SabjiPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categoryLabel: string;
  thaliNames: string[];
  products: Product[];
  selected: string[];
  onChange: (ids: string[]) => void;
  maxCount: number;
  minRequired: number;
  onMinChange: (n: number) => void;
  readOnly?: boolean;
}

export default function SabjiPickerModal({
  isOpen,
  onClose,
  categoryLabel,
  thaliNames,
  products,
  selected,
  onChange,
  maxCount,
  minRequired,
  onMinChange,
  readOnly = false,
}: SabjiPickerModalProps) {
  const { query, setQuery, frequentItems, recordSelection } = useSabjiSearch(products);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.nameGu ?? "").toLowerCase().includes(q)
    );
  }, [query, products]);

  // Stable A→Z grouping — a 50+ item list stays scannable and predictable,
  // instead of reshuffling itself based on how often things were picked before.
  const grouped = useMemo(() => {
    const alpha = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    const map = new Map<string, Product[]>();
    for (const p of alpha) {
      const letter = /[a-zA-Z]/.test(p.name[0] ?? "") ? p.name[0].toUpperCase() : "#";
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(p);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const toggle = (id: string) => {
    if (readOnly) return;
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    onChange(next);
    if (!selected.includes(id)) recordSelection(id);
  };

  const selectAll = () => {
    if (readOnly) return;
    products.forEach((p) => {
      if (!selected.includes(p.id)) recordSelection(p.id);
    });
    onChange(products.map((p) => p.id));
  };

  const clearAll = () => {
    if (readOnly) return;
    onChange([]);
  };

  const isReady = selected.length >= Math.max(minRequired, 1);
  const stillNeeded = Math.max(minRequired, 1) - selected.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className={cn(
          "relative w-full sm:max-w-2xl bg-white flex flex-col shadow-2xl",
          "rounded-t-2xl sm:rounded-2xl",
          "h-[92vh] sm:h-auto sm:max-h-[85vh]",
          "animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-extrabold text-gray-900 truncate">Dishes for: {categoryLabel}</h2>
            <p className="text-[11px] text-gray-450 truncate mt-0.5">Used by: {thaliNames.join(" · ")}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sticky status + search + controls */}
        <div className="px-5 py-3 border-b border-gray-100 flex-shrink-0 space-y-3 bg-gray-50/40">
          <div
            className={cn(
              "flex items-center justify-between text-xs font-bold px-3 py-2 rounded-xl border",
              isReady ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-amber-50 border-amber-200 text-amber-700"
            )}
          >
            <span>
              {selected.length} dish{selected.length === 1 ? "" : "es"} added · customers must pick {minRequired || 0}
            </span>
            {isReady && <Check size={15} />}
          </div>

          {!readOnly && (
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-gray-500 flex-1">How many dishes must the customer choose?</p>
              <select
                value={minRequired}
                onChange={(e) => onMinChange(Number(e.target.value))}
                className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-orange-500/30 outline-none font-semibold"
              >
                {Array.from({ length: maxCount + 1 }, (_, i) => (
                  <option key={i} value={i}>
                    {i} {i === 0 ? "(optional)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered.length > 0) {
                    const firstItem = filtered[0];
                    toggle(firstItem.id);
                    setQuery("");
                  }
                }
              }}
              placeholder={`Search all ${products.length} dishes by name or Gujarati...`}
              className="w-full pl-9 pr-8 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center justify-between">
              <button type="button" onClick={selectAll} className="text-[11px] font-bold text-orange-500 hover:underline cursor-pointer">
                Select All ({products.length})
              </button>
              {selected.length > 0 && (
                <button type="button" onClick={clearAll} className="text-[11px] font-bold text-red-400 hover:underline cursor-pointer">
                  Clear All
                </button>
              )}
            </div>
          )}

          {frequentItems.length > 0 && !query && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-0.5 text-[10px] text-orange-600 font-semibold uppercase tracking-wider">
                <Zap size={10} className="fill-orange-500 text-orange-500" /> Quick Add:
              </span>
              {frequentItems.map((p) => {
                const isSelected = selected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggle(p.id)}
                    disabled={readOnly}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all",
                      isSelected ? "bg-orange-100 border-orange-400 text-orange-700" : "bg-white border-gray-200 text-gray-600 hover:border-orange-300",
                      readOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                    )}
                  >
                    {p.name}
                    {isSelected && " ✓"}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Scrollable dish list — the ONLY scroll region in this whole flow */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {grouped.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-10 italic">No matching dishes found. Try a different search word.</p>
          )}
          {grouped.map(([letter, items]) => (
            <div key={letter} className="mb-4">
              <p className="text-[10px] font-black text-gray-350 uppercase tracking-widest px-1 mb-1.5 sticky top-0 bg-white/95 backdrop-blur-sm py-1">
                {letter}
              </p>
              <div className="space-y-1.5">
                {items.map((product) => {
                  const isSelected = selected.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggle(product.id)}
                      disabled={readOnly}
                      className={cn(
                        "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left text-sm transition-all",
                        isSelected
                          ? "border-orange-400 bg-orange-50/50 text-orange-700 font-semibold"
                          : "border-gray-100 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
                        readOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors",
                          isSelected ? "bg-orange-500 border-orange-500" : "border-gray-300 bg-white"
                        )}
                      >
                        {isSelected && <Check size={13} className="text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{product.name}</p>
                        {product.nameGu && <p className="text-[11px] text-gray-400 truncate mt-0.5">{product.nameGu}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Sticky footer — always visible, never needs scrolling to reach */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/50 rounded-b-2xl">
          <span className={cn("text-xs font-bold", isReady ? "text-emerald-600" : "text-red-500")}>
            {isReady
              ? `Looks good — ${selected.length} dish${selected.length === 1 ? "" : "es"} ready`
              : `Add at least ${stillNeeded} more dish${stillNeeded === 1 ? "" : "es"}`}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold shadow-sm transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
