import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type BadgeVariant =
  | "active" | "inactive"
  | "lunch" | "dinner"
  | "success" | "warning" | "danger" | "info" | "neutral";

const variantClasses: Record<BadgeVariant, string> = {
  active:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
  lunch:    "bg-amber-50 text-amber-700 border-amber-200",
  dinner:   "bg-indigo-50 text-indigo-700 border-indigo-200",
  success:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning:  "bg-amber-50 text-amber-700 border-amber-200",
  danger:   "bg-red-50 text-red-700 border-red-200",
  info:     "bg-blue-50 text-blue-700 border-blue-200",
  neutral:  "bg-gray-100 text-gray-600 border-gray-200",
};

const variantLabels: Partial<Record<BadgeVariant, string>> = {
  active: "Active",
  inactive: "Inactive",
  lunch: "Lunch",
  dinner: "Dinner",
};

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  icon?: LucideIcon;
  className?: string;
}

export default function Badge({ variant, label, icon: Icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border",
        variantClasses[variant],
        className
      )}
    >
      {Icon && <Icon size={11} />}
      {label ?? variantLabels[variant]}
    </span>
  );
}

export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? "active" : "inactive"} />;
}
