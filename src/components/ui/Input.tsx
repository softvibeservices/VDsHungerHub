import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftAddon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftAddon, className, id, ...props }, ref) => {
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
        <div className="relative flex">
          {leftAddon && (
            <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-gray-200 bg-gray-50 text-gray-500 text-sm">
              {leftAddon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full px-3 py-2 text-sm border border-gray-200 text-gray-900 placeholder-gray-400 bg-white transition-colors duration-150",
              "focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500",
              "disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed",
              error && "border-red-400 focus:border-red-400 focus:ring-red-500/30",
              leftAddon ? "rounded-r-lg" : "rounded-lg",
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export default Input;
