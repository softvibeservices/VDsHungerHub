// src/lib/menu-validation.ts

export interface ValidationThali {
  id: string;
  name: string;
  categoryId: string | null;
  category?: { name: string } | null;
  sabjiCount: number;
}

export interface ValidationThaliConfig {
  thaliId: string;
  minSabjiRequired: number;
}

export interface ValidationSabjiGroup {
  categoryId: string;
  productIds: string[];
}

export interface MenuValidationIssue {
  key: string; // categoryId, or "uncategorized:<thaliId>"
  categoryId: string | null;
  label: string;
  required: number;
  configured: number;
  thaliNames: string[];
  reason: "MISSING_CATEGORY" | "NOT_ENOUGH_DISHES";
}

export interface MenuValidationResult {
  isValid: boolean;
  issues: MenuValidationIssue[];
}

/**
 * Confirms every selected thali that requires a sabji choice actually has
 * enough approved dishes configured for its category on this daily menu.
 *
 * Used on BOTH the client (to block the Save button with a friendly,
 * specific message) and the server (as a safety net against direct API
 * calls, bugs, or future UI changes that might forget to check this).
 */
export function validateSabjiCoverage(
  allThalis: ValidationThali[],
  thaliConfig: ValidationThaliConfig[],
  sabjiOptions: ValidationSabjiGroup[]
): MenuValidationResult {
  const issues: MenuValidationIssue[] = [];
  const byCategory = new Map<string, { thalis: ValidationThali[]; maxMin: number }>();

  for (const cfg of thaliConfig) {
    const thali = allThalis.find((t) => t.id === cfg.thaliId);
    if (!thali) continue;
    if (thali.sabjiCount <= 0) continue; // this thali has no dish choice at all — nothing to check

    if (!thali.categoryId) {
      // Should never happen via the UI (the thali selector blocks this),
      // but the API can be called directly, so we still check it here.
      issues.push({
        key: `uncategorized:${thali.id}`,
        categoryId: null,
        label: thali.name,
        required: cfg.minSabjiRequired ?? thali.sabjiCount,
        configured: 0,
        thaliNames: [thali.name],
        reason: "MISSING_CATEGORY",
      });
      continue;
    }

    const key = thali.categoryId;
    if (!byCategory.has(key)) byCategory.set(key, { thalis: [], maxMin: 0 });
    const entry = byCategory.get(key)!;
    entry.thalis.push(thali);
    entry.maxMin = Math.max(entry.maxMin, cfg.minSabjiRequired ?? thali.sabjiCount);
  }

  for (const [categoryId, { thalis, maxMin }] of byCategory) {
    const configured =
      sabjiOptions.find((s) => s.categoryId === categoryId)?.productIds.length ?? 0;
    const required = Math.max(maxMin, 1); // at least 1 dish must exist if sabjiCount > 0
    if (configured < required) {
      issues.push({
        key: categoryId,
        categoryId,
        label: thalis[0].category?.name ?? thalis[0].name,
        required,
        configured,
        thaliNames: thalis.map((t) => t.name),
        reason: "NOT_ENOUGH_DISHES",
      });
    }
  }

  return { isValid: issues.length === 0, issues };
}
