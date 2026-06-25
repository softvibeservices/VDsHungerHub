"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  debounceMs?: number;
}

export default function SearchInput({
  value: externalValue = "",
  onChange,
  placeholder = "Search...",
  className,
  debounceMs = 300,
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(externalValue);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setLocalValue(externalValue);
  }, [externalValue]);

  const debouncedChange = useCallback(
    (val: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        onChange(val);
      }, debounceMs);
    },
    [onChange, debounceMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleChange = (val: string) => {
    setLocalValue(val);
    debouncedChange(val);
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        size={15}
        className="absolute left-3 text-gray-400 pointer-events-none"
      />
      <input
        type="text"
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-colors"
      />
      {localValue && (
        <button
          type="button"
          onClick={() => handleChange("")}
          className="absolute right-2.5 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
