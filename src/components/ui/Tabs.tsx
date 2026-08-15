// src\components\ui\Tabs.tsx

"use client";

import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: string;
  icon?: React.ElementType;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  variant?: "pill" | "underline";
  className?: string;
}

export default function Tabs({
  items,
  value,
  onChange,
  variant = "underline",
  className,
}: TabsProps) {
  if (variant === "pill") {
    return (
      <div
        className={cn(
          "flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto no-scrollbar",
          className
        )}
      >
        {items.map(({ value: v, label, icon: Icon }) => {
          const isActive = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap shrink-0",
                isActive
                  ? "bg-white text-gray-900 shadow-sm font-bold"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {Icon && <Icon size={15} />}
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("border-b border-gray-200 overflow-x-auto no-scrollbar max-w-full", className)}>
      <nav className="flex gap-4 min-w-max" aria-label="Tabs">
        {items.map(({ value: v, label }) => {
          const isActive = v === value;
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className={cn(
                "py-3 px-1 border-b-2 font-medium text-xs sm:text-sm transition-all focus:outline-none capitalize whitespace-nowrap",
                isActive
                  ? "border-orange-500 text-orange-600 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
