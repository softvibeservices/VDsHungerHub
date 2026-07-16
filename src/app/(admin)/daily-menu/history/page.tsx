// src/app/(admin)/daily-menu/history/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { History, Copy, Check, ExternalLink, Pencil, ChevronLeft, ChevronRight, Sun, Moon } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface HistoryRow {
  id: string;
  date: string;
  mealType: "LUNCH" | "DINNER";
  publicSlug: string | null;
  thaliCount: number;
  thaliNames: string[];
  dishCount: number;
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

export default function MenuHistoryPage() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [filter, setFilter] = useState<"ALL" | "LUNCH" | "DINNER">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async (targetPage: number, mealFilter: "ALL" | "LUNCH" | "DINNER") => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(targetPage) });
      if (mealFilter !== "ALL") params.set("mealType", mealFilter);
      const res = await fetch(`/api/menu/history?${params.toString()}`);
      const json = await res.json();
      setRows(json.menus ?? []);
      setTotalPages(json.totalPages ?? 1);
    } catch {
      toast.error("Failed to load menu history");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page, filter);
  }, [page, filter, load]);

  const copyLink = (row: HistoryRow) => {
    if (!row.publicSlug) return;
    navigator.clipboard.writeText(`${window.location.origin}/menu/${row.publicSlug}`);
    setCopiedId(row.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Link copied!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-xl font-extrabold text-gray-900 leading-tight flex items-center gap-2">
          <History size={20} className="text-orange-500" /> Past Menus &amp; Links
        </h2>
        <p className="text-xs text-gray-400 font-medium mt-0.5">
          Every menu you have ever published, with its dishes and shareable link.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["ALL", "LUNCH", "DINNER"] as const).map((f) => (
          <button
            key={f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer",
              filter === f ? "bg-orange-500 border-orange-500 text-white" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
            )}
          >
            {f === "ALL" ? "All Meals" : f === "LUNCH" ? "🌞 Lunch" : "🌙 Dinner"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-2 border border-dashed border-gray-200 rounded-2xl bg-white">
          <p className="text-sm font-semibold text-gray-500">No menus found yet</p>
          <p className="text-xs text-gray-400">Published menus will show up here automatically.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    row.mealType === "LUNCH" ? "bg-orange-50 text-orange-500" : "bg-indigo-50 text-indigo-500"
                  )}
                >
                  {row.mealType === "LUNCH" ? <Sun size={18} /> : <Moon size={18} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-gray-800">
                    {formatDisplayDate(row.date)} <span className="text-[10px] font-bold text-gray-400 uppercase ml-1">{row.mealType}</span>
                  </p>
                  <p className="text-[11px] text-gray-450 truncate mt-0.5">
                    {row.thaliCount} thali{row.thaliCount === 1 ? "" : "s"} · {row.dishCount} dish{row.dishCount === 1 ? "" : "es"} · {row.thaliNames.join(", ")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href={`/daily-menu?date=${row.date}`}
                  className="flex items-center gap-1.5 text-xs font-bold text-gray-600 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <Pencil size={13} /> View / Edit
                </Link>
                {row.publicSlug && (
                  <>
                    <button
                      onClick={() => copyLink(row)}
                      className="flex items-center gap-1.5 text-xs font-bold text-orange-600 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl hover:bg-orange-100 transition-colors cursor-pointer"
                    >
                      {copiedId === row.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === row.id ? "Copied" : "Copy Link"}
                    </button>
                    <a
                      href={`/menu/${row.publicSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-gray-400 hover:text-orange-500 rounded-xl hover:bg-orange-50 transition-colors"
                      title="Open public link"
                    >
                      <ExternalLink size={15} />
                    </a>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-bold text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="p-2 rounded-lg bg-white border border-gray-200 text-gray-500 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
