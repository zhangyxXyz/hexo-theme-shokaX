import { deriveReadingColor, normalizeReadingColor } from './palette'

export const preferenceKey = 'shokax.reading.preferences'
export const preferenceVersion = 2

export interface ReadingPreferences {
  fontScale: 1 | 1.125 | 1.25
  lineHeight: 'default' | 'compact' | 'relaxed'
  theme: 'default' | 'system' | 'light' | 'dark'
  motion: 'system' | 'reduce'
  primaryColor: string | null
  secondaryColor: string | null
  background: 'banner' | 'gradient'
  texture: 'none' | 'stars' | 'dots' | 'contours' | 'origami' | 'sakura'
  textureIntensity: number
  homeLayout: 'list' | 'grid'
}

export interface ReadingDefaults {
  enabled: boolean
  palette?: { primary?: string | null; secondary?: string | null }
  darkmode?: boolean
  auto_dark?: { enable?: boolean; start?: number; end?: number }
}

export const defaultPreferences: Readonly<ReadingPreferences> = Object.freeze({
  fontScale: 1, lineHeight: 'default', theme: 'default', motion: 'system',
  primaryColor: null, secondaryColor: null, background: 'banner', texture: 'none', textureIntensity: 12, homeLayout: 'list'
})

const choices = {
  fontScale: [1, 1.125, 1.25],
  lineHeight: ['default', 'compact', 'relaxed'],
  theme: ['default', 'system', 'light', 'dark'],
  motion: ['system', 'reduce'],
  background: ['banner', 'gradient'],
  texture: ['none', 'stars', 'dots', 'contours', 'origami', 'sakura'],
  homeLayout: ['list', 'grid']
} as const

export function mergePreferences(current: Readonly<ReadingPreferences>, patch: unknown): ReadingPreferences {
  const next = { ...current }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return next
  for (const key of Object.keys(choices) as (keyof ReadingPreferences)[]) {
    const value = (patch as Record<string, unknown>)[key]
    if ((choices[key] as readonly unknown[]).includes(value)) (next as Record<string, unknown>)[key] = value
  }
  const values = patch as Record<string, unknown>
  for (const key of ['primaryColor', 'secondaryColor'] as const) {
    if (values[key] === null) next[key] = null
    else if (typeof values[key] === 'string') {
      const color = normalizeReadingColor(values[key])
      if (color) next[key] = color
    }
  }
  if (Number.isInteger(values.textureIntensity) && (values.textureIntensity as number) >= 5 && (values.textureIntensity as number) <= 25) {
    next.textureIntensity = values.textureIntensity as number
  }
  return next
}

/** The head bootstrap and application share this parser, including old theme keys. */
export function parsePreferences(raw: string | null, legacyTheme: string | null, enabled: boolean): ReadingPreferences {
  if (enabled && raw) {
    try {
      const saved = JSON.parse(raw)
      if (saved && !Array.isArray(saved)) {
        if (saved.version === preferenceVersion) return mergePreferences(defaultPreferences, saved)
        if (saved.version === 1) {
          const { fontScale, lineHeight, theme, motion } = saved
          return mergePreferences(defaultPreferences, { fontScale, lineHeight, theme, motion })
        }
      }
    } catch { /* A damaged preference must not prevent a page from opening. */ }
  }
  return { ...defaultPreferences, theme: legacyTheme === 'light' || legacyTheme === 'dark' ? legacyTheme : 'default' }
}

export function readPreferences(defaults: ReadingDefaults): ReadingPreferences {
  let raw: string | null = null, legacy: string | null = null
  try { raw = localStorage.getItem(preferenceKey); legacy = localStorage.getItem('theme') } catch { /* Optional storage. */ }
  return parsePreferences(raw, legacy, defaults.enabled)
}

export function resolveReadingTheme(preferences: Readonly<ReadingPreferences>, defaults: ReadingDefaults, systemDark: boolean, hour: number): 'light' | 'dark' {
  if (preferences.theme === 'light' || preferences.theme === 'dark') return preferences.theme
  if (preferences.theme === 'system') return systemDark ? 'dark' : 'light'
  if (defaults.auto_dark?.enable) {
    // Keep the theme's existing overnight schedule, including its inclusive end hour.
    const { start = 21, end = 8 } = defaults.auto_dark
    return hour >= start || hour <= end ? 'dark' : 'light'
  }
  return defaults.darkmode ? 'dark' : 'light'
}

export function applyPreferenceAttributes(root: HTMLElement, preferences: Readonly<ReadingPreferences>, theme: 'light' | 'dark', reduced: boolean, defaults: ReadingDefaults['palette'] = {}) {
  const attribute = (name: string, value?: string) => value ? root.setAttribute(name, value) : root.removeAttribute(name)
  attribute('data-theme', theme === 'dark' ? 'dark' : undefined)
  attribute('data-reading-font', preferences.fontScale === 1.125 ? 'large' : preferences.fontScale === 1.25 ? 'larger' : undefined)
  if (preferences.fontScale === 1) root.style.removeProperty('--reading-font-scale')
  else root.style.setProperty('--reading-font-scale', String(preferences.fontScale))
  attribute('data-reading-line-height', preferences.lineHeight === 'default' ? undefined : preferences.lineHeight)
  attribute('data-motion', reduced ? 'reduce' : undefined)
  attribute('data-reading-background', preferences.background === 'banner' ? undefined : preferences.background)
  attribute('data-reading-texture', preferences.texture === 'none' ? undefined : preferences.texture)
  if (preferences.texture === 'none') root.style.removeProperty('--reading-texture-opacity')
  else root.style.setProperty('--reading-texture-opacity', String(preferences.textureIntensity / 100))
  attribute('data-reading-home-layout', preferences.homeLayout === 'list' ? undefined : preferences.homeLayout)
  const sitePalette = {
    primary: normalizeReadingColor(defaults.primary || ''),
    secondary: normalizeReadingColor(defaults.secondary || '')
  }
  attribute('data-reading-palette', preferences.primaryColor || preferences.secondaryColor ? 'custom' :
    sitePalette.primary || sitePalette.secondary ? 'theme' : undefined)
  for (const name of ['primary', 'secondary'] as const) {
    // Site defaults and visitor overrides share the same readable color roles.
    // Keep inherited colors out of persisted preferences so reset follows the site.
    const seedProperty = `--theme-${name}-seed`
    if (sitePalette[name]) root.style.setProperty(seedProperty, sitePalette[name])
    else root.style.removeProperty(seedProperty)
    const color = preferences[name === 'primary' ? 'primaryColor' : 'secondaryColor'] ?? sitePalette[name]
    const palette = color ? deriveReadingColor(color) : undefined
    const properties = { seed: 'seed', inkLight: 'ink-light', inkDark: 'ink-dark', fill: 'fill' } as const
    for (const [key, suffix] of Object.entries(properties)) {
      const property = `--reading-${name}-${suffix}`
      if (palette) root.style.setProperty(property, palette[key as keyof typeof palette])
      else root.style.removeProperty(property)
    }
  }
}
