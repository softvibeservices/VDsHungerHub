"use client";

import { useSabjiSearch } from "@/hooks/useSabjiSearch";
import { Search, X, Zap } from "lucide-react";

interface Product {
  id: string;
  name: string;
  nameGu?: string | null;
}

interface SabjiPickerProps {
  products: Product[];          // Only thali's approved sabji pool
  selected: string[];           // Selected product IDs
  onChange: (ids: string[]) => void;
  maxCount: number;             // thali.maxSabjiCount
  minRequired?: number;         // for menu slot
  onMinChange?: (n: number) => void;
  label?: string;
  adminMode?: boolean;          // NEW — when true, no selection cap is enforced
}

export default function SabjiPicker({
  products,
  selected,
  onChange,
  maxCount,
  minRequired = 1,
  onMinChange,
  label,
  adminMode = false,            // NEW
}: SabjiPickerProps) {
  const { query, setQuery, sorted, frequentItems, recordSelection } =
    useSabjiSearch(products);

  const toggle = (id: string) => {
    const next = selected.includes(id)
      ? selected.filter((s) => s !== id)
      : [...selected, id];
    onChange(next);
    if (!selected.includes(id)) recordSelection(id);
  };

  const selectAll = () => {
    products.forEach((p) => {
      if (!selected.includes(p.id)) recordSelection(p.id);
    });
    onChange(products.map((p) => p.id));
  };

  // In adminMode there is no cap. In user mode, cap at maxCount.
  const isAtCap = !adminMode && selected.length >= maxCount;

  return (
    <div className="space-y-2 bg-gray-50 border border-gray-150 p-3.5 rounded-xl">
      {label && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-700">{label}</p>
          <button
            type="button"
            onClick={selectAll}
            className="text-xs text-orange-500 hover:text-orange-650 font-semibold cursor-pointer"
          >
            Select All ({products.length})
          </button>
        </div>
      )}

      {/* Frequent chips (when no search) */}
      {frequentItems.length > 0 && !query && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="flex items-center gap-0.5 text-[10px] text-orange-600 font-semibold uppercase tracking-wider">
            <Zap size={10} className="fill-orange-500 text-orange-500" /> Quick Add:
          </span>
          {frequentItems.map((p) => {
            const isSelected = selected.includes(p.id);
            const isDisabled = isAtCap && !isSelected;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => !isDisabled && toggle(p.id)}
                disabled={isDisabled}
                className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-all cursor-pointer ${
                  isSelected
                    ? "bg-orange-100 border-orange-400 text-orange-700"
                    : isDisabled
                    ? "bg-gray-50 border-gray-150 text-gray-350 opacity-40 cursor-not-allowed"
                    : "bg-white border-gray-200 text-gray-600 hover:border-orange-300"
                }`}
              >
                {p.name}
                {isSelected && " ✓"}
              </button>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sabji by name or Gujarati..."
          className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-650 cursor-pointer"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Product list */}
      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
        {sorted.map((product) => {
          const isSelected = selected.includes(product.id);
          const isDisabled = isAtCap && !isSelected;
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => {
                if (isDisabled) return;
                toggle(product.id);
              }}
              disabled={isDisabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left text-xs transition-all cursor-pointer ${
                isSelected
                  ? "border-orange-400 bg-orange-50/50 text-orange-700 font-medium"
                  : isDisabled
                  ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                  : "border-gray-100 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div
                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  isSelected ? "bg-orange-500 border-orange-500" : "border-gray-300 bg-white"
                }`}
              >
                {isSelected && (
                  <svg viewBox="0 0 10 8" fill="none" className="w-2.5 h-2.5">
                    <path
                      d="M1 4l3 3 5-6"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate text-xs">{product.name}</p>
                {product.nameGu && (
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{product.nameGu}</p>
                )}
              </div>
            </button>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4 italic">
            No matching products found
          </p>
        )}
      </div>

      {/* Min sabji required selector */}
      {onMinChange && (
        <div className="flex items-center gap-2 pt-1.5 border-t border-gray-100">
          <p className="text-[10px] text-gray-500 flex-1">
            Min choices required from customer:
          </p>
          <select
            value={minRequired}
            onChange={(e) => onMinChange(Number(e.target.value))}
            className="text-[10px] bg-white border border-gray-200 rounded-md px-1.5 py-0.5 focus:ring-2 focus:ring-orange-500/30 outline-none"
          >
            {Array.from({ length: maxCount + 1 }, (_, i) => (
              <option key={i} value={i}>
                {i} {i === 0 ? "(optional)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Selection summary */}
      <div className="flex justify-between items-center text-[10px] text-gray-400 pt-0.5">
        <span>
          {selected.length} of {products.length} options selected
          {adminMode ? " (Admin — no limit)" : ` (Max choice: ${maxCount})`}
        </span>
        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="text-red-400 hover:text-red-500 cursor-pointer font-medium"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
