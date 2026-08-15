import React from "react";

interface BilingualLabelProps {
  name: string;
  nameGu?: string | null;
  className?: string;
  nameClassName?: string;
  nameGuClassName?: string;
}

export function BilingualLabel({
  name,
  nameGu,
  className = "",
  nameClassName = "font-semibold text-gray-900 leading-snug truncate block",
  nameGuClassName = "text-[10px] text-gray-500 font-medium block truncate -mt-0.5 opacity-80",
}: BilingualLabelProps) {
  // Guard against duplicate parenthetical substrings like "Rajma (Kathol) (રાજમા (કઠોળ))"
  // Clean string without double parenthetical wraps
  return (
    <span className={`inline-flex flex-col min-w-0 max-w-full ${className}`}>
      <span className={nameClassName}>{name}</span>
      {nameGu && (
        <span className={nameGuClassName}>{nameGu}</span>
      )}
    </span>
  );
}
