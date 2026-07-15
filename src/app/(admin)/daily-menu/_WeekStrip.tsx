"use client";

import { useMemo } from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DaySummary {
  date: string; // YYYY-MM-DD
  hasLunch: boolean;
  hasDinner: boolean;
}

interface WeekStripProps {
  selectedDate: string; // YYYY-MM-DD
  todayStr: string; // YYYY-MM-DD
  summaries: DaySummary[];
  onSelect: (date: string) => void;
  onOpenDatePicker: () => void;
}

export default function WeekStrip({
  selectedDate,
  todayStr,
  summaries,
  onSelect,
  onOpenDatePicker,
}: WeekStripProps) {
  // Generate 14 days starting from today
  const days = useMemo(() => {
    const list = [];
    const baseDate = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      // Find matching summary
      const match = summaries.find((s) => s.date === dateStr);
      list.push({
        dateStr,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
        monthName: d.toLocaleDateString("en-US", { month: "short" }),
        hasLunch: match?.hasLunch ?? false,
        hasDinner: match?.hasDinner ?? false,
        isToday: dateStr === todayStr,
      });
    }
    return list;
  }, [summaries, todayStr]);

  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-3 shadow-sm select-none">
      {/* Horizontal Swipeable Row */}
      <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-none snap-x py-1 px-0.5">
        {days.map((day) => {
          const isSelected = day.dateStr === selectedDate;
          return (
            <button
              key={day.dateStr}
              onClick={() => onSelect(day.dateStr)}
              className={cn(
                "flex-shrink-0 snap-start flex flex-col items-center justify-between w-[72px] h-[84px] rounded-xl border p-2 transition-all cursor-pointer",
                isSelected
                  ? "bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-500/20"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
              )}
            >
              {/* Day Name */}
              <span
                className={cn(
                  "text-[10px] font-bold uppercase tracking-wider",
                  isSelected ? "text-orange-100" : "text-gray-400"
                )}
              >
                {day.isToday ? "Today" : day.dayName}
              </span>

              {/* Day Number */}
              <span className="text-lg font-black leading-none my-0.5">
                {day.dayNum}
              </span>

              {/* Month / Meal Status Dots */}
              <div className="flex items-center justify-center gap-1.5 mt-1">
                {/* Lunch Dot */}
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    day.hasLunch
                      ? isSelected
                        ? "bg-white"
                        : "bg-orange-500"
                      : isSelected
                      ? "bg-transparent border border-orange-200"
                      : "bg-transparent border border-gray-300"
                  )}
                  title="Lunch Status"
                />
                {/* Dinner Dot */}
                <div
                  className={cn(
                    "w-2 h-2 rounded-full",
                    day.hasDinner
                      ? isSelected
                        ? "bg-white"
                        : "bg-indigo-500"
                      : isSelected
                      ? "bg-transparent border border-orange-200"
                      : "bg-transparent border border-gray-300"
                  )}
                  title="Dinner Status"
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Fallback Date Picker Button */}
      <button
        onClick={onOpenDatePicker}
        className="flex-shrink-0 w-11 h-[84px] rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-gray-700 transition-all cursor-pointer shadow-inner"
        aria-label="Select Date"
      >
        <Calendar size={18} />
        <span className="text-[9px] font-bold uppercase tracking-wide">More</span>
      </button>
    </div>
  );
}
