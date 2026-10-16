import { applyPreferenceAttributes, readPreferences, resolveReadingTheme, type ReadingDefaults } from './model'

declare const shokax_READING_DEFAULTS: ReadingDefaults

// Small synchronous head entry: no body nodes, application imports or separate parser.
const preferences = readPreferences(shokax_READING_DEFAULTS)
const dark = matchMedia('(prefers-color-scheme: dark)').matches
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || preferences.motion === 'reduce'
applyPreferenceAttributes(document.documentElement, preferences,
  resolveReadingTheme(preferences, shokax_READING_DEFAULTS, dark, new Date().getHours()), reduced, shokax_READING_DEFAULTS.palette)
