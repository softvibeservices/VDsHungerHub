import { cn } from "@/lib/utils";

interface PageToolbarProps {
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export default function PageToolbar({
  filters,
  actions,
  children,
  className,
}: PageToolbarProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {filters && (
          <div className="flex flex-wrap items-center gap-3">{filters}</div>
        )}
        {actions && (
          <div className="flex flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
