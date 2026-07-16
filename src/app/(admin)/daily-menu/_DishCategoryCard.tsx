// src/app/(admin)/daily-menu/_DishCategoryCard.tsx
"use client";

import { CheckCircle2, AlertTriangle } from "lucide-react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface DishCategoryCardProps {
  label: string; // e.g. "Gujarati Thali"
  thaliNames: string[]; // e.g. ["Small Gujarati Thali", "Large Gujarati Thali"]
  selectedCount: number;
  minRequired: number;
  totalAvailable: number; // size of the approved sabji pool for this group
  onManage: () => void;
  disabled?: boolean; // true when viewing a past, read-only date
}

export default function DishCategoryCard({
  label,
  thaliNames,
  selectedCount,
  minRequired,
  totalAvailable,
  onManage,
  disabled = false,
}: DishCategoryCardProps) {
  const isOk = selectedCount >= Math.max(minRequired, 1);

  return (
    <div
      className={cn(
        "w-full p-3.5 rounded-xl border text-left bg-white border-gray-200 shadow-sm space-y-2",
        disabled && "opacity-60"
      )}
    >
      {/* Row 1: Icon, Category name, and Select Sabji button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isOk ? (
            <CheckCircle2 size={18} className="text-emerald-500 flex-shrink-0" />
          ) : (
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
          )}
          <span className="text-xs font-black text-gray-800 truncate">{label}</span>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant={isOk ? "secondary" : "primary"}
            size="sm"
            onClick={onManage}
            className="flex-shrink-0 text-xs py-1.5 h-8 font-bold cursor-pointer"
          >
            Select Sabji
          </Button>
        )}
      </div>

      {/* Row 2: Subtitle (thali names) and status text */}
      <div className="pl-[26px] text-[10px] text-gray-450 space-y-1">
        <p className="truncate">{thaliNames.join(" · ")}</p>
        <p className={cn("text-[11px] font-bold", isOk ? "text-emerald-600" : "text-red-600")}>
          {selectedCount} of {totalAvailable} dishes added — {isOk ? "ready ✓" : `need at least ${Math.max(minRequired, 1)}`}
        </p>
      </div>
    </div>
  );
}
