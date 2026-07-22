// src/app/(admin)/daily-menu/_SabjiPickerModal.tsx
"use client";

import { useMemo } from "react";
import { Search, X, Zap, Check } from "lucide-react";
import { useSabjiSearch } from "@/hooks/useSabjiSearch";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Dishes for: ${categoryLabel}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <span className={cn("text-xs font-bold", isReady ? "text-emerald-600" : "text-red-500")}>
            {isReady
              ? `Looks good — ${selected.length} dish${selected.length === 1 ? "" : "es"} ready`
              : `Add at least ${stillNeeded} more dish${stillNeeded === 1 ? "" : "es"}`}
          </span>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-gray-500 font-medium -mt-2">
          Used by: {thaliNames.join(" · ")}
        </p>

        {/* Status + Min Dish Count Selector */}
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
            <p className="text-xs text-gray-600 flex-1 font-medium">How many dishes must the customer choose?</p>
            <select
              value={minRequired}
              onChange={(e) => onMinChange(Number(e.target.value))}
              className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-orange-500/30 outline-none font-bold"
            >
              {Array.from({ length: maxCount + 1 }, (_, i) => (
                <option key={i} value={i}>
                  {i} {i === 0 ? "(optional)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Search Input */}
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
            className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {!readOnly && (
          <div className="flex items-center justify-between">
            <button type="button" onClick={selectAll} className="text-xs font-bold text-orange-500 hover:underline cursor-pointer">
              Select All ({products.length})
            </button>
            {selected.length > 0 && (
              <button type="button" onClick={clearAll} className="text-xs font-bold text-red-500 hover:underline cursor-pointer">
                Clear All
              </button>
            )}
          </div>
        )}

        {frequentItems.length > 0 && !query && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-0.5 text-[10px] text-orange-600 font-bold uppercase tracking-wider">
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
                    "text-xs px-2.5 py-0.5 rounded-full border font-medium transition-all",
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

        {/* Scrollable dish list */}
        <div className="max-h-64 overflow-y-auto px-1 py-1 space-y-3">
          {grouped.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6 italic">No matching dishes found.</p>
          )}
          {grouped.map(([letter, items]) => (
            <div key={letter}>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-1">
                {letter}
              </p>
              <div className="space-y-1">
                {items.map((product) => {
                  const isSelected = selected.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggle(product.id)}
                      disabled={readOnly}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left text-xs transition-all",
                        isSelected
                          ? "border-orange-400 bg-orange-50/50 text-orange-700 font-bold"
                          : "border-gray-150 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50",
                        readOnly ? "cursor-not-allowed opacity-70" : "cursor-pointer"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors",
                          isSelected ? "bg-orange-500 border-orange-500" : "border-gray-300 bg-white"
                        )}
                      >
                        {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{product.name}</p>
                        {product.nameGu && <p className="text-[10px] text-gray-400 truncate">{product.nameGu}</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
