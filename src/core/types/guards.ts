/**
 * Narrowing helpers for values that cross a trust boundary: parsed JSON from a
 * remote API, values read back from extension storage, and incoming messages.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** An array whose every item passes `isItem`, which an empty array does. */
export function isArrayOf<TItem>(
  value: unknown,
  isItem: (item: unknown) => item is TItem,
): value is TItem[] {
  return Array.isArray(value) && value.every(isItem);
}

export function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
