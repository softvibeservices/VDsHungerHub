"use client";

import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderWindowTimelineProps {
  menuVisibleFrom: string; // HH:MM
  cutoffTime: string; // HH:MM
  mealType: "LUNCH" | "DINNER";
}

function timeToMinutes(tStr: string): number {
  if (!tStr || !tStr.includes(":")) return 0;
  const [h, m] = tStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToTimeString(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function OrderWindowTimeline({
  menuVisibleFrom,
  cutoffTime,
  mealType,
}: OrderWindowTimelineProps) {
  const [nowMinutes, setNowMinutes] = useState<number>(0);

  // Update current time in IST every minute
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      // Adjust to IST (UTC+5:30)
      const ist = new Date(d.getTime() + 330 * 60 * 1000);
      setNowMinutes(ist.getUTCHours() * 60 + ist.getUTCMinutes());
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const visibleMins = useMemo(() => timeToMinutes(menuVisibleFrom), [menuVisibleFrom]);
  const cutoffMins = useMemo(() => timeToMinutes(cutoffTime), [cutoffTime]);

  // Determine active segments
  const isWraparound = visibleMins > cutoffMins;
  const totalDurationMins = isWraparound
    ? 1440 - visibleMins + cutoffMins
    : cutoffMins - visibleMins;

  // Validation warnings
  const warning = useMemo(() => {
    if (visibleMins === cutoffMins) {
      return "Visible time and Cutoff time cannot be identical.";
    }
    if (totalDurationMins < 60) {
      return "The ordering window is very short (less than 1 hour). Customers might not have enough time to order.";
    }
    if (totalDurationMins > 1380) {
      // 23 hours
      return "The ordering window covers almost the entire day. Ensure this is intentional.";
    }
    return null;
  }, [visibleMins, cutoffMins, totalDurationMins]);

  // Calculate percentage positions on a 24-hour timeline (0 to 1440 mins)
  const visiblePct = (visibleMins / 1440) * 100;
  const cutoffPct = (cutoffMins / 1440) * 100;
  const nowPct = (nowMinutes / 1440) * 100;

  // Determine if ordering is active "right now" based on default times
  const isOrderingActiveNow = useMemo(() => {
    if (isWraparound) {
      return nowMinutes >= visibleMins || nowMinutes < cutoffMins;
    }
    return nowMinutes >= visibleMins && nowMinutes < cutoffMins;
  }, [nowMinutes, visibleMins, cutoffMins, isWraparound]);

  return (
    <div className="space-y-3 bg-gray-50 border border-gray-150 p-4 rounded-xl">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={12} /> Live Scheduling Timeline (IST)
        </p>
        <span
          className={cn(
            "text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded",
            isOrderingActiveNow
              ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
              : "bg-gray-150 text-gray-400 border border-gray-250"
          )}
        >
          {isOrderingActiveNow ? "Ordering Active" : "Ordering Closed"}
        </span>
      </div>

      {/* Visual Timeline Bar */}
      <div className="relative pt-6 pb-2 px-1">
        {/* Main 24h Bar */}
        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden relative">
          {/* Highlighted active window */}
          {isWraparound ? (
            <>
              {/* Segment 1: Midnight to Cutoff */}
              <div
                className="absolute top-0 bottom-0 bg-orange-500/25"
                style={{ left: 0, width: `${cutoffPct}%` }}
              />
              {/* Segment 2: VisibleFrom to Midnight */}
              <div
                className="absolute top-0 bottom-0 bg-orange-500/25"
                style={{ left: `${visiblePct}%`, right: 0 }}
              />
            </>
          ) : (
            /* Scoped segment in the middle */
            <div
              className="absolute top-0 bottom-0 bg-orange-500/25"
              style={{ left: `${visiblePct}%`, width: `${cutoffPct - visiblePct}%` }}
            />
          )}
        </div>

        {/* Position Markers */}
        {/* Menu Visible Point */}
        <div
          className="absolute -top-1.5 flex flex-col items-center transform -translate-x-1/2"
          style={{ left: `${visiblePct}%` }}
        >
          <span className="text-[9px] font-black text-gray-600 leading-none">Visible</span>
          <span className="text-[10px] font-mono text-gray-500 font-semibold mt-0.5">
            {menuVisibleFrom}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-gray-400 mt-0.5 border border-white" />
        </div>

        {/* Cutoff Time Point */}
        <div
          className="absolute -top-1.5 flex flex-col items-center transform -translate-x-1/2"
          style={{ left: `${cutoffPct}%` }}
        >
          <span className="text-[9px] font-black text-red-600 leading-none">Cutoff</span>
          <span className="text-[10px] font-mono text-red-500 font-semibold mt-0.5">
            {cutoffTime}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-0.5 border border-white" />
        </div>

        {/* Live "Now" Indicator (Pulsing) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center transform -translate-x-1/2 z-10"
          style={{ left: `${nowPct}%` }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white shadow animate-ping" />
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500 border border-white shadow absolute top-0" />
          <span className="absolute top-3 text-[9px] font-black text-orange-600 whitespace-nowrap bg-orange-50 border border-orange-100 px-1 rounded shadow-sm">
            You ({minutesToTimeString(nowMinutes)})
          </span>
        </div>
      </div>

      {/* Warning Notice */}
      {warning && (
        <div className="flex gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-800 leading-relaxed">
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <p>{warning}</p>
        </div>
      )}
    </div>
  );
}
