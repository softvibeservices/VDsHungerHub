import { cn } from "@/lib/utils";
import { TableRowSkeleton } from "./Loader";
import { Inbox } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  emptySubMessage?: string;
  className?: string;
}

export default function Table<T extends { id: string }>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "No data found",
  emptySubMessage,
  className,
}: TableProps<T>) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-200 overflow-hidden",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider",
                    col.width
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              <TableRowSkeleton cols={columns.length} />
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="flex flex-col items-center gap-2 py-14 text-gray-400">
                    <Inbox size={36} strokeWidth={1.2} />
                    <p className="text-sm font-medium">{emptyMessage}</p>
                    {emptySubMessage && (
                      <p className="text-xs text-gray-400">{emptySubMessage}</p>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-orange-50/30 transition-colors duration-100"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-sm text-gray-700"
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
