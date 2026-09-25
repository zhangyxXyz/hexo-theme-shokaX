import { sunrise } from './sunrise'
import { moonStars } from './moon-stars'
import type { ThemeEffect } from './types'

// Add new strategies here; callers and the lifecycle runner stay unchanged.
const effects: Record<string, ThemeEffect> = { sunrise, 'moon-stars': moonStars }

export function resolveThemeEffect(name?: string): ThemeEffect {
  return Object.prototype.hasOwnProperty.call(effects, name) ? effects[name] : sunrise
}
