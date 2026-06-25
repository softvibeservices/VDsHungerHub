import { forwardRef, ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses = {
  primary:
    "bg-orange-500 hover:bg-orange-600 text-white border-transparent shadow-sm disabled:bg-orange-300",
  secondary:
    "bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm disabled:bg-gray-50 disabled:text-gray-400",
  danger:
    "bg-red-500 hover:bg-red-600 text-white border-transparent shadow-sm disabled:bg-red-300",
  ghost:
    "bg-transparent hover:bg-gray-100 text-gray-600 border-transparent disabled:text-gray-300",
};

const sizeClasses = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-4 py-2 text-sm rounded-lg gap-2",
  lg: "px-5 py-2.5 text-sm rounded-xl gap-2",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-medium border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:ring-offset-1 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          leftIcon && <span className="flex-shrink-0">{leftIcon}</span>
        )}
        {children}
        {!isLoading && rightIcon && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export default Button;
