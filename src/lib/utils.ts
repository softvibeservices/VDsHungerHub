import { type ClassValue, clsx } from "clsx";

/**
 * Format a 10-digit mobile number into "+91 XXXXX XXXXX" format
 */
export function formatMobileNumber(num: string): string {
  const clean = num.replace(/\D/g, "").slice(-10);
  if (clean.length !== 10) return num;
  return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
}

/**
 * Clean a mobile number — strip spaces, +91 prefix, leading 0
 * Returns a 10-digit string
 */
export function cleanMobileNumber(num: string): string {
  return num
    .replace(/\s+/g, "")
    .replace(/^\+91/, "")
    .replace(/^0/, "")
    .trim();
}

/**
 * Format a number as Indian Rupee
 */
export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Format a date as "26 Jun 2024"
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format date as YYYY-MM-DD for API calls
 */
export function formatDateForAPI(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getTodayString(): string {
  return formatDateForAPI(new Date());
}

/**
 * Get today's date in IST (UTC+5:30) as YYYY-MM-DD
 */
export function getTodayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}


/**
 * Meal type to display label
 */
export function getMealTypeLabel(type: string): string {
  return type === "LUNCH" ? "Lunch" : "Dinner";
}

/**
 * Merge Tailwind classes (simple clsx wrapper)
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "…";
}

/**
 * Extract human-readable message from API error response
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}
