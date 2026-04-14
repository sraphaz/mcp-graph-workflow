/**
 * Runtime safety helpers for dashboard rendering paths where API payloads can be partial.
 */

export function safePercentage(value: number | null | undefined): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value as number);
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

export function safeEntries<T>(value: Record<string, T> | null | undefined): [string, T][] {
  return value ? Object.entries(value) : [];
}
