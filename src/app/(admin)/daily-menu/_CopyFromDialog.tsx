"use client";

import { useState, useMemo } from "react";
import { Copy, AlertCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface DaySummary {
  date: string; // YYYY-MM-DD
  hasLunch: boolean;
  hasDinner: boolean;
}

interface CopyFromDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mealType: "LUNCH" | "DINNER";
  selectedDate: string; // the date we are copying TO (current page date)
  summaries: DaySummary[];
  onCopy: (sourceDate: string) => void;
}

export default function CopyFromDialog({
  isOpen,
  onClose,
  mealType,
  selectedDate,
  summaries,
  onCopy,
}: CopyFromDialogProps) {
  const [selectedSource, setSelectedSource] = useState<string>("");

  // Get configured dates for this mealType in the past
  const pastConfiguredDates = useMemo(() => {
    return summaries
      .filter((s) => {
        // Must have this meal type configured
        const hasMeal = mealType === "LUNCH" ? s.hasLunch : s.hasDinner;
        // Must be in the past relative to the selectedDate
        return hasMeal && s.date < selectedDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date)) // descending (newest first)
      .slice(0, 10); // show top 10 recent configured menus
  }, [summaries, mealType, selectedDate]);

  const handleCopy = () => {
    if (!selectedSource) return;
    onCopy(selectedSource);
    onClose();
  };

  const formatDisplayDate = (dStr: string) => {
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    } catch {
      return dStr;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Copy ${mealType === "LUNCH" ? "Lunch" : "Dinner"} Menu`}
      footer={
        <div className="flex gap-2 w-full justify-end">
          <Button variant="secondary" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCopy}
            disabled={!selectedSource}
            leftIcon={<Copy size={14} />}
            size="sm"
          >
            Copy Menu
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          Select a previously configured {mealType.toLowerCase()} menu to copy all thalis and sabji pools onto your current draft.
        </p>

        {pastConfiguredDates.length > 0 ? (
          <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100">
            {pastConfiguredDates.map((item) => {
              const isSelected = selectedSource === item.date;
              return (
                <button
                  key={item.date}
                  type="button"
                  onClick={() => setSelectedSource(item.date)}
                  className={cn(
                    "w-full text-left px-4 py-3 flex items-center justify-between text-xs transition-all cursor-pointer",
                    isSelected
                      ? "bg-orange-50/30 text-orange-600 font-bold"
                      : "bg-white hover:bg-gray-50 text-gray-700"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      checked={isSelected}
                      onChange={() => setSelectedSource(item.date)}
                      className="text-orange-500 focus:ring-orange-400 h-4 w-4 border-gray-300"
                    />
                    <span>{formatDisplayDate(item.date)}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono font-medium">
                    {item.date}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-gray-400 gap-2 border border-dashed border-gray-200 rounded-xl">
            <AlertCircle size={24} className="text-gray-300" />
            <p className="text-xs font-semibold">No configured menus found</p>
            <p className="text-[10px] text-gray-400">
              Configure and save at least one menu to be able to copy from it.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
