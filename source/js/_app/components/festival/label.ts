// Keep this tiny normalizer aligned with scripts/utils/festival-label.ts.
export function normalizeFestivalLabel(value: unknown, fallback = ''): string {
  return Array.from((typeof value === 'string' ? value : fallback).trim()).slice(0, 2).join('')
}
