import { Loader2 } from "lucide-react";

interface LoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
}

const sizeMap = { sm: 16, md: 20, lg: 28 };

export default function Loader({ size = "md", text }: LoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Loader2
        size={sizeMap[size]}
        className="animate-spin text-orange-500"
      />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  );
}

// Row skeleton for tables
export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <tr key={i} className="animate-pulse">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-100 rounded-md w-full max-w-[180px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
