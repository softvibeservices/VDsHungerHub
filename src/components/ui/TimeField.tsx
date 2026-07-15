import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TimeFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  error?: string;
  hint?: string;
}

const TimeField = forwardRef<HTMLInputElement, TimeFieldProps>(
  ({ label, error, hint, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-gray-700"
          >
            {label}
            {props.required && (
              <span className="text-red-500 ml-0.5">*</span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          type="time"
          className={cn(
            "w-full px-3 py-2 text-sm border border-gray-200 text-gray-900 placeholder-gray-400 bg-white transition-colors duration-150 rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500",
            "disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed",
            error && "border-red-400 focus:border-red-400 focus:ring-red-500/30",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);
TimeField.displayName = "TimeField";

export default TimeField;
