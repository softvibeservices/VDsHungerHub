"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Clock, X, Check, ChevronDown, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimeFieldProps {
  label?: string;
  value?: string; // "HH:MM" in 24h format (e.g. "11:30", "19:00")
  onChange?: (e: { target: { value: string } }) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  id?: string;
}

function parse24to12(time24: string = "12:00") {
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr || "12", 10);
  const m = parseInt(mStr || "00", 10);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour12: h, minute: m, period };
}

function format12to24(hour12: number, minute: number, period: "AM" | "PM"): string {
  let h24 = hour12;
  if (period === "PM" && h24 < 12) h24 += 12;
  if (period === "AM" && h24 === 12) h24 = 0;
  const hPad = String(h24).padStart(2, "0");
  const mPad = String(minute).padStart(2, "0");
  return `${hPad}:${mPad}`;
}

function format12Display(time24: string = "12:00"): string {
  const { hour12, minute, period } = parse24to12(time24);
  const hPad = String(hour12).padStart(2, "0");
  const mPad = String(minute).padStart(2, "0");
  return `${hPad}:${mPad} ${period}`;
}

// Popular quick preset times
const QUICK_PRESETS = [
  { label: "11:30 AM", val: "11:30" },
  { label: "02:30 PM", val: "14:30" },
  { label: "07:30 PM", val: "19:30" },
  { label: "11:45 PM", val: "23:45" },
];

export default function TimeField({
  label,
  value = "11:30",
  onChange,
  error,
  hint,
  required,
  className,
  id,
}: TimeFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"HOUR" | "MINUTE">("HOUR");
  const containerRef = useRef<HTMLDivElement>(null);

  const { hour12, minute, period } = parse24to12(value);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateTime = (h12: number, min: number, p: "AM" | "PM") => {
    const val24 = format12to24(h12, min, p);
    if (onChange) {
      onChange({ target: { value: val24 } });
    }
  };

  // Clock Dial Geometry (Center: 100, Radius: 72)
  const CENTER = 100;
  const RADIUS = 72;

  // Hour Positions (1 to 12)
  const hourPositions = useMemo(() => {
    return [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => {
      const angleDeg = (h % 12) * 30 - 90;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = CENTER + RADIUS * Math.cos(angleRad);
      const y = CENTER + RADIUS * Math.sin(angleRad);
      return { val: h, x, y };
    });
  }, []);

  // Minute Positions (0 to 55 in steps of 5)
  const minutePositions = useMemo(() => {
    return [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map((m) => {
      const angleDeg = (m / 60) * 360 - 90;
      const angleRad = (angleDeg * Math.PI) / 180;
      const x = CENTER + RADIUS * Math.cos(angleRad);
      const y = CENTER + RADIUS * Math.sin(angleRad);
      return { val: m, x, y };
    });
  }, []);

  // Selected pointer position
  const selectedPos = useMemo(() => {
    if (mode === "HOUR") {
      return hourPositions.find((p) => p.val === hour12) ?? hourPositions[0];
    } else {
      const roundedMin = Math.round(minute / 5) * 5 % 60;
      return minutePositions.find((p) => p.val === roundedMin) ?? minutePositions[0];
    }
  }, [mode, hour12, minute, hourPositions, minutePositions]);

  return (
    <div ref={containerRef} className="flex flex-col gap-1.5 relative">
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-gray-700 uppercase tracking-wider">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Input Field Display Button */}
      <button
        type="button"
        id={id}
        onClick={() => {
          setIsOpen((v) => !v);
          setMode("HOUR");
        }}
        className={cn(
          "w-full flex items-center justify-between px-3.5 py-2.5 text-sm border border-gray-200 bg-white rounded-xl shadow-sm hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 transition-all cursor-pointer font-bold text-gray-900",
          isOpen && "border-orange-500 ring-2 ring-orange-500/30",
          error && "border-red-400 focus:ring-red-500/20",
          className
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
            <Clock size={15} />
          </div>
          <span className="font-mono text-sm tracking-wide text-gray-900 font-extrabold">{format12Display(value)}</span>
        </div>
        <ChevronDown size={15} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
      {hint && !error && <p className="text-xs text-gray-400 font-medium">{hint}</p>}

      {/* LIGHT-MODE ELEGANT CIRCULAR CLOCK DIAL POPOVER */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 z-50 w-[290px] bg-white border border-slate-200 rounded-3xl p-4 shadow-2xl space-y-3 animate-in fade-in zoom-in-95">
          {/* Header Bar */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              {mode === "HOUR" ? "SELECT HOUR" : "SELECT MINUTE"}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Digital Time Header + AM/PM Toggle */}
          <div className="flex items-center justify-between gap-2">
            {/* Digital Display Box */}
            <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 flex items-center justify-center gap-1 text-xl font-mono font-black">
              <button
                type="button"
                onClick={() => setMode("HOUR")}
                className={cn(
                  "px-2 py-0.5 rounded-lg transition-colors cursor-pointer",
                  mode === "HOUR"
                    ? "text-orange-600 bg-orange-100/80 ring-1 ring-orange-400 font-bold"
                    : "text-slate-700 hover:text-slate-900"
                )}
              >
                {String(hour12).padStart(2, "0")}
              </button>
              <span className="text-slate-400 font-bold">:</span>
              <button
                type="button"
                onClick={() => setMode("MINUTE")}
                className={cn(
                  "px-2 py-0.5 rounded-lg transition-colors cursor-pointer",
                  mode === "MINUTE"
                    ? "text-orange-600 bg-orange-100/80 ring-1 ring-orange-400 font-bold"
                    : "text-slate-700 hover:text-slate-900"
                )}
              >
                {String(minute).padStart(2, "0")}
              </button>
            </div>

            {/* AM / PM Segmented Pills */}
            <div className="flex flex-col gap-0.5 bg-slate-100 border border-slate-200 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => updateTime(hour12, minute, "AM")}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer",
                  period === "AM"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => updateTime(hour12, minute, "PM")}
                className={cn(
                  "px-2.5 py-0.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer",
                  period === "PM"
                    ? "bg-orange-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                PM
              </button>
            </div>
          </div>

          {/* Quick Presets Row */}
          <div className="flex items-center gap-1 justify-center">
            {QUICK_PRESETS.map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => {
                  if (onChange) onChange({ target: { value: p.val } });
                }}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-all cursor-pointer",
                  value === p.val
                    ? "bg-orange-500 border-orange-500 text-white"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-orange-50 hover:text-orange-600"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* LIGHT-MODE CIRCULAR ANALOG CLOCK DIAL */}
          <div className="relative w-[200px] h-[200px] mx-auto bg-slate-50 rounded-full border border-slate-200/90 shadow-inner flex items-center justify-center select-none">
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {/* Center Dot */}
              <circle cx={CENTER} cy={CENTER} r={4} fill="#F97316" />
              {/* Clock Hand Line */}
              <line
                x1={CENTER}
                y1={CENTER}
                x2={selectedPos.x}
                y2={selectedPos.y}
                stroke="#F97316"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              {/* Pointer Circle at selected node */}
              <circle cx={selectedPos.x} cy={selectedPos.y} r={16} fill="#F97316" className="shadow-md" />
            </svg>

            {/* Dial Numbers */}
            {(mode === "HOUR" ? hourPositions : minutePositions).map((pos) => {
              const isSelected = selectedPos.val === pos.val;
              const displayLabel = mode === "HOUR" ? String(pos.val) : String(pos.val).padStart(2, "0");

              return (
                <button
                  key={pos.val}
                  type="button"
                  onClick={() => {
                    if (mode === "HOUR") {
                      updateTime(pos.val, minute, period);
                      setMode("MINUTE"); // Auto transition to minute picker
                    } else {
                      updateTime(hour12, pos.val, period);
                    }
                  }}
                  style={{
                    left: `${pos.x - 14}px`,
                    top: `${pos.y - 14}px`,
                  }}
                  className={cn(
                    "absolute w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold transition-all cursor-pointer z-10",
                    isSelected
                      ? "text-white font-black scale-110"
                      : "text-slate-600 hover:text-orange-600 hover:bg-orange-50"
                  )}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>

          {/* Confirm Button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-extrabold rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 transition-all cursor-pointer"
          >
            <Check size={15} />
            <span>Confirm {format12Display(value)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
