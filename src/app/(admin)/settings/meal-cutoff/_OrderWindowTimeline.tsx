"use client";

import { useEffect, useState, useMemo } from "react";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderWindowTimelineProps {
  menuVisibleFrom: string; // HH:MM (24h)
  cutoffTime: string; // HH:MM (24h)
  mealType: "LUNCH" | "DINNER";
}

function timeToMinutes(tStr: string): number {
  if (!tStr || !tStr.includes(":")) return 0;
  const [h, m] = tStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function format12h(tStr: string = "12:00"): string {
  if (!tStr || !tStr.includes(":")) return tStr;
  const [hStr, mStr] = tStr.split(":");
  let h = parseInt(hStr || "12", 10);
  const m = parseInt(mStr || "00", 10);
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
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
      return "The ordering window covers almost the entire day. Ensure this is intentional.";
    }
    return null;
  }, [visibleMins, cutoffMins, totalDurationMins]);

  // Calculate percentage positions on a 24-hour timeline (0 to 1440 mins)
  const visiblePct = Math.min(Math.max((visibleMins / 1440) * 100, 2), 98);
  const cutoffPct = Math.min(Math.max((cutoffMins / 1440) * 100, 2), 98);
  const nowPct = Math.min(Math.max((nowMinutes / 1440) * 100, 2), 98);

  const isOrderingActiveNow = useMemo(() => {
    if (isWraparound) {
      return nowMinutes >= visibleMins || nowMinutes < cutoffMins;
    }
    return nowMinutes >= visibleMins && nowMinutes < cutoffMins;
  }, [nowMinutes, visibleMins, cutoffMins, isWraparound]);

  return (
    <div className="space-y-4 bg-slate-50 border border-slate-200/80 p-4 rounded-2xl shadow-inner">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Clock size={14} className="text-slate-400" /> Live Ordering Timeline (IST)
        </p>
        <span
          className={cn(
            "text-xs font-extrabold px-2.5 py-0.5 rounded-full border shadow-sm",
            isOrderingActiveNow
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          )}
        >
          {isOrderingActiveNow ? "✓ ORDERING ACTIVE" : "✕ ORDERING CLOSED"}
        </span>
      </div>

      {/* Visual Timeline Bar */}
      <div className="space-y-2 pt-2 pb-1">
        {/* Key Information Badges */}
        <div className="flex items-center justify-between text-xs font-bold px-1">
          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
            <span>Visible From: <strong className="text-slate-900">{format12h(menuVisibleFrom)}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
            <span>Cutoff Time: <strong className="text-slate-900">{format12h(cutoffTime)}</strong></span>
          </div>
        </div>

        {/* 24h Progress Track */}
        <div className="relative h-3 w-full bg-slate-200/80 rounded-full overflow-hidden shadow-inner">
          {/* Active Ordering Segment */}
          {isWraparound ? (
            <>
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-orange-400 to-orange-500 opacity-90"
                style={{ left: 0, width: `${cutoffPct}%` }}
              />
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-orange-400 to-orange-500 opacity-90"
                style={{ left: `${visiblePct}%`, right: 0 }}
              />
            </>
          ) : (
            <div
              className="absolute top-0 bottom-0 bg-gradient-to-r from-orange-400 to-orange-500 opacity-90"
              style={{ left: `${visiblePct}%`, width: `${cutoffPct - visiblePct}%` }}
            />
          )}

          {/* Current Time Point Marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-slate-900 z-10"
            style={{ left: `${nowPct}%` }}
          />
        </div>

        {/* 24h Hour Scale */}
        <div className="flex justify-between text-[10px] font-bold text-slate-400 px-0.5 pt-0.5 font-mono">
          <span>12 AM</span>
          <span>06 AM</span>
          <span>12 PM</span>
          <span>06 PM</span>
          <span>12 AM</span>
        </div>
      </div>

      {/* Warning Notice */}
      {warning && (
        <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium leading-relaxed">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <p>{warning}</p>
        </div>
      )}
    </div>
  );
}
