import {
  applyPreferenceAttributes, defaultPreferences, mergePreferences, preferenceKey, preferenceVersion,
  readPreferences, resolveReadingTheme, type ReadingDefaults, type ReadingPreferences
} from './reading-preferences/model'
import { normalizeReadingColor } from './reading-preferences/palette'

export type { ReadingPreferences } from './reading-preferences/model'
export { normalizeReadingColor } from './reading-preferences/palette'
type SubscriptionOptions = { signal?: AbortSignal }
const listeners = new Set<(preferences: Readonly<ReadingPreferences>) => void>()
const motionListeners = new Set<(reduced: boolean) => void>()
let preferences: Readonly<ReadingPreferences> | undefined
let motionQuery: MediaQueryList | undefined, colorQuery: MediaQueryList | undefined
let listening = false, initialized = false, previousReduced: boolean | undefined

// Keep imports inert: several page modules are also exercised outside a full DOM.
const defaults = (): ReadingDefaults => {
  const config = typeof shokax_CONFIG === 'undefined' ? undefined : shokax_CONFIG
  return { enabled: config?.reading_settings?.enable === true, darkmode: config?.darkmode, auto_dark: config?.auto_dark, palette: config?.palette }
}
const query = (media: string) => typeof matchMedia === 'function' ? matchMedia(media) :
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(media) : undefined
const systemMotion = () => (motionQuery ??= query('(prefers-reduced-motion: reduce)'))?.matches === true
const systemDark = () => (colorQuery ??= query('(prefers-color-scheme: dark)'))?.matches === true

export function getReadingPreferences(): Readonly<ReadingPreferences> {
  return preferences ??= Object.freeze(readPreferences(defaults()))
}

/** Site defaults precede the original color sheet; inherited sides are never persisted. */
export function getReadingPalette(): { primary: string | null; secondary: string | null } {
  const state = getReadingPreferences()
  const root = typeof document === 'undefined' ? undefined : document.documentElement
  const style = root && typeof getComputedStyle === 'function' ? getComputedStyle(root) : undefined
  return {
    primary: state.primaryColor ?? normalizeReadingColor(defaults().palette?.primary || '') ?? normalizeReadingColor(style?.getPropertyValue('--theme-primary-seed') || ''),
    secondary: state.secondaryColor ?? normalizeReadingColor(defaults().palette?.secondary || '') ?? normalizeReadingColor(style?.getPropertyValue('--theme-secondary-seed') || '')
  }
}

export function effectiveReducedMotion(): boolean {
  return systemMotion() || getReadingPreferences().motion === 'reduce'
}

function apply(notify = true) {
  const state = getReadingPreferences()
  const reduced = effectiveReducedMotion()
  const root = typeof document === 'undefined' ? undefined : document.documentElement
  if (root) applyPreferenceAttributes(root, state, resolveReadingTheme(state, defaults(), systemDark(), new Date().getHours()), reduced, defaults().palette)
  const motionChanged = previousReduced !== undefined && reduced !== previousReduced
  previousReduced = reduced
  if (notify) listeners.forEach(listener => listener(state))
  if (motionChanged) motionListeners.forEach(listener => listener(reduced))
}

function observe() {
  if (listening) return
  listening = true
  previousReduced = effectiveReducedMotion()
  systemDark()
  motionQuery?.addEventListener('change', () => apply(false))
  colorQuery?.addEventListener('change', () => { if (getReadingPreferences().theme === 'system') apply() })
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', event => {
      if (event.key !== null && event.key !== preferenceKey && event.key !== 'theme') return
      preferences = Object.freeze(readPreferences(defaults()))
      apply()
    })
    // Re-evaluate the site's default schedule when a tab returns or bfcache restores it.
    window.addEventListener('pageshow', () => apply())
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
    if (!document.hidden && getReadingPreferences().theme === 'default') apply()
  })
}

export function initReadingPreferences() {
  if (initialized) return
  initialized = true
  observe()
  apply(false)
}

function subscribe<T>(set: Set<(value: T) => void>, listener: (value: T) => void, options: SubscriptionOptions = {}) {
  if (options.signal?.aborted) return () => {}
  observe()
  set.add(listener)
  const remove = () => { set.delete(listener); options.signal?.removeEventListener('abort', remove) }
  options.signal?.addEventListener('abort', remove, { once: true })
  return remove
}

export function subscribeReadingPreferences(listener: (preferences: Readonly<ReadingPreferences>) => void, options?: SubscriptionOptions) {
  return subscribe(listeners, listener, options)
}

export function subscribeReducedMotion(listener: (reduced: boolean) => void, options?: SubscriptionOptions) {
  return subscribe(motionListeners, listener, options)
}

/** State applies even when persistence is unavailable; callers can report that distinction. */
export function setReadingPreferences(patch: Partial<ReadingPreferences>): boolean {
  observe()
  const enabled = defaults().enabled
  preferences = Object.freeze(mergePreferences(getReadingPreferences(), enabled ? patch : { theme: patch.theme }))
  let saved = true
  try {
    if (enabled) localStorage.setItem(preferenceKey, JSON.stringify({ version: preferenceVersion, ...preferences }))
    if (preferences.theme === 'light' || preferences.theme === 'dark') localStorage.setItem('theme', preferences.theme)
    else localStorage.removeItem('theme')
  } catch { saved = false }
  apply()
  return saved
}

export function resetReadingPreferences(): boolean {
  observe()
  preferences = defaultPreferences
  let saved = true
  try { localStorage.removeItem(preferenceKey); localStorage.removeItem('theme') } catch { saved = false }
  apply()
  return saved
}
