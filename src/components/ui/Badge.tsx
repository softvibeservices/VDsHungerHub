import { cn } from "@/lib/utils";

type BadgeVariant = "active" | "inactive" | "lunch" | "dinner";

const variantClasses: Record<BadgeVariant, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
  lunch: "bg-amber-50 text-amber-700 border-amber-200",
  dinner: "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const variantLabels: Record<BadgeVariant, string> = {
  active: "Active",
  inactive: "Inactive",
  lunch: "Lunch",
  dinner: "Dinner",
};

interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  className?: string;
}

export default function Badge({ variant, label, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        variantClasses[variant],
        className
      )}
    >
      {label ?? variantLabels[variant]}
    </span>
  );
}

// Convenience components
export function ActiveBadge({ isActive }: { isActive: boolean }) {
  return <Badge variant={isActive ? "active" : "inactive"} />;
}
