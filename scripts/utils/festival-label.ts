// Keep this normalization in sync with the small browser-side implementation.
export function normalizeFestivalLabel(value: unknown, fallback = ''): string {
  const text = typeof value === 'string' ? value : fallback
  return Array.from(text.trim()).slice(0, 2).join('')
}
