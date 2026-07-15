import { useMemo } from "react";

/**
 * Returns true if the `current` state object diverges from the `snapshot` object.
 * Performs a deep-equal comparison using JSON.stringify for nested structures.
 * You can optionally scope the dirty check to specific keys.
 */
export function useDirtyState<T>(
  current: T,
  snapshot: T | null,
  keys?: (keyof T)[]
): boolean {
  return useMemo(() => {
    if (!snapshot) return false;

    const targetKeys = keys || (Object.keys(current as any) as (keyof T)[]);

    for (const key of targetKeys) {
      const val1 = current[key];
      const val2 = snapshot[key];

      if (JSON.stringify(val1) !== JSON.stringify(val2)) {
        return true;
      }
    }
    return false;
  }, [current, snapshot, keys]);
}
export default useDirtyState;
