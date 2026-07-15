"use client";

import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}

export default function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: ToggleSwitchProps) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 select-none border border-gray-100 rounded-xl p-3 bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed hover:bg-gray-50/50"
      )}
    >
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <div
          className={cn(
            "w-11 h-6 rounded-full transition-colors duration-200 ease-in-out",
            checked ? "bg-orange-500" : "bg-gray-200"
          )}
        />
        <div
          className={cn(
            "absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full shadow-sm transform transition-transform duration-200 ease-in-out",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </div>
      {(label || description) && (
        <div className="flex-1">
          {label && <span className="text-sm font-bold text-gray-700 block">{label}</span>}
          {description && <span className="text-xs text-gray-400 block mt-0.5">{description}</span>}
        </div>
      )}
    </label>
  );
}
