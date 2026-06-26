const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30 in milliseconds

/**
 * Convert a UTC Date object to the equivalent IST Date object.
 * Use only for display — do not store the returned Date in DB.
 */
export function toIST(utcDate: Date): Date {
  return new Date(utcDate.getTime() + IST_OFFSET_MS);
}

/**
 * Get today's date string (YYYY-MM-DD) in IST.
 */
export function getTodayIST(): string {
  const ist = toIST(new Date());
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const d = String(ist.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Format a UTC Date for display in IST.
 * e.g. "26 Jun 2026, 11:30 AM"
 */
export function formatDateTimeIST(utcDate: Date | string): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format only the time part of a UTC Date in IST.
 * e.g. "11:30 AM"
 */
export function formatTimeIST(utcDate: Date | string): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format only the date part of a UTC Date in IST.
 * e.g. "26 Jun 2026"
 */
export function formatDateIST(utcDate: Date | string): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Convert a "HH:MM" IST time string + a date string (YYYY-MM-DD IST)
 * into a UTC DateTime object for DB storage.
 *
 * Example: cutoffTime = "11:30", date = "2026-06-26" (IST)
 * → stores as 2026-06-26T06:00:00.000Z in DB
 */
export function istTimeToUTC(istTimeHHMM: string, istDateYYYYMMDD: string): Date {
  const [h, m] = istTimeHHMM.split(":").map(Number);
  const [y, mo, d] = istDateYYYYMMDD.split("-").map(Number);
  // Build an IST moment as a UTC timestamp
  const utcMs = Date.UTC(y, mo - 1, d, h, m, 0, 0) - IST_OFFSET_MS;
  return new Date(utcMs);
}

/**
 * Convert a UTC DateTime back to a "HH:MM" IST string for display/input fields.
 */
export function utcToISTTimeString(utcDate: Date | string): string {
  const d = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  const ist = toIST(d);
  const h = String(ist.getUTCHours()).padStart(2, "0");
  const m = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Parse a YYYY-MM-DD IST date string and return a UTC Date
 * that represents midnight IST on that day (for DailyMenu.date field).
 */
export function istDateToUTC(istDateYYYYMMDD: string): Date {
  const [y, mo, d] = istDateYYYYMMDD.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - IST_OFFSET_MS);
}
