// src\app\(admin)\daily-menu\_WeekStrip.tsx

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight, History } from "lucide-react";
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

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

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

export default function WeekStrip({ selectedDate, todayStr, summaries, onSelect, onOpenDatePicker }: WeekStripProps) {
  const days = useMemo(() => {
    const list = [];
    for (let i = -4; i <= 9; i++) {
      const dateStr = addDays(selectedDate, i);
      const d = new Date(dateStr + "T00:00:00.000Z");
      const match = summaries.find((s) => s.date === dateStr);
      list.push({
        dateStr,
        dayNum: d.getUTCDate(),
        dayName: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        hasLunch: match?.hasLunch ?? false,
        hasDinner: match?.hasDinner ?? false,
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
      });
    }
    return list;
  }, [selectedDate, summaries, todayStr]);

  return (
    <div className="space-y-1.5">
      {/* Top Header Row with Active Date Indicator */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500">Active Date:</span>
          <span className="text-xs font-bold text-orange-600">
            {formatDisplayDate(selectedDate)}
          </span>
          {selectedDate === todayStr && (
            <span className="text-[9px] font-extrabold text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Today
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onSelect(addDays(selectedDate, -7))}
            className="flex items-center gap-0.5 text-[11px] font-bold text-gray-500 hover:text-orange-600 cursor-pointer px-2 py-0.5 rounded-lg hover:bg-orange-50"
          >
            <ChevronLeft size={13} /> 7 Days Back
          </button>
          {selectedDate !== todayStr && (
            <button
              type="button"
              onClick={() => onSelect(todayStr)}
              className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-0.5 rounded-full cursor-pointer hover:bg-orange-100"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={() => onSelect(addDays(selectedDate, 7))}
            className="flex items-center gap-0.5 text-[11px] font-bold text-gray-500 hover:text-orange-600 cursor-pointer px-2 py-0.5 rounded-lg hover:bg-orange-50"
          >
            7 Days Forward <ChevronRight size={13} />
          </button>

          {/* ── NEW: direct entry point into Menu History (Req: findability fix) ── */}
          <span className="w-px h-4 bg-gray-200 mx-0.5" aria-hidden="true" />
          <Link
            href="/daily-menu/history"
            className="flex items-center gap-1 text-[11px] font-bold text-gray-500 hover:text-orange-600 cursor-pointer px-2 py-0.5 rounded-lg hover:bg-orange-50"
            title="View every past menu"
          >
            <History size={13} /> History
          </Link>
        </div>
      </div>

      {/* Compact Date Strip Container */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl p-2 shadow-sm select-none">
        <div className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-none snap-x py-0.5 px-0.5">
          {days.map((day) => {
            const isSelected = day.dateStr === selectedDate;
            return (
              <button
                key={day.dateStr}
                onClick={() => onSelect(day.dateStr)}
                className={cn(
                  "flex-shrink-0 snap-start flex flex-col items-center justify-between w-[58px] h-[58px] rounded-xl border p-1.5 transition-all cursor-pointer",
                  isSelected
                    ? "bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-500/20"
                    : day.isPast
                    ? "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                )}
              >
                <span className={cn("text-[9px] font-bold uppercase tracking-wider leading-none", isSelected ? "text-orange-100" : "text-gray-400")}>
                  {day.isToday ? "Today" : day.dayName}
                </span>
                <span className="text-base font-bold leading-none my-0.5">{day.dayNum}</span>
                <div className="flex items-center justify-center gap-1">
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      day.hasLunch ? (isSelected ? "bg-white" : "bg-orange-500") : isSelected ? "bg-transparent border border-orange-200" : "bg-transparent border border-gray-300"
                    )}
                    title="Lunch Status"
                  />
                  <div
                    className={cn(
                      "w-1.5 h-1.5 rounded-full",
                      day.hasDinner ? (isSelected ? "bg-white" : "bg-indigo-500") : isSelected ? "bg-transparent border border-orange-200" : "bg-transparent border border-gray-300"
                    )}
                    title="Dinner Status"
                  />
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={onOpenDatePicker}
          className="flex-shrink-0 w-10 h-[58px] rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 flex flex-col items-center justify-center gap-0.5 text-gray-500 hover:text-gray-700 transition-all cursor-pointer shadow-inner"
          aria-label="Select Date"
          title="Pick any date"
        >
          <Calendar size={15} />
          <span className="text-[8px] font-bold uppercase tracking-wide">Pick</span>
        </button>
      </div>
    </div>
  );
}
