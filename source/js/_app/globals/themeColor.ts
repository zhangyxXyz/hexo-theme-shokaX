import { CONFIG, HTML } from './globalVars'
import { resolveThemeEffect } from '../components/theme-transition'
import { createThemeTransitionRunner } from '../components/theme-transition/runner'
import type { ThemeMode } from '../components/theme-transition/types'
import { effectiveReducedMotion, initReadingPreferences, setReadingPreferences, subscribeReadingPreferences, subscribeReducedMotion } from '../components/reading-preferences'

let committing = false
const themeTransition = createThemeTransitionRunner(mode => {
  committing = true
  try { setReadingPreferences({ theme: mode }) } finally { committing = false }
})

const syncThemeIcon = () => {
  const btn = document.querySelector('.theme .ic')
  if (HTML.getAttribute('data-theme') === 'dark') {
    btn?.classList.remove('i-sun')
    btn?.classList.add('i-moon')
  } else {
    btn?.classList.remove('i-moon')
    btn?.classList.add('i-sun')
  }
}

let toggleInitialized = false
export function initThemeToggle() {
  if (toggleInitialized) return
  const button = document.querySelector<HTMLElement>('#rightNav .theme')
  if (!button) return
  toggleInitialized = true
  const toggle = () => {
    const rect = button.getBoundingClientRect()
    const from: ThemeMode = HTML.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    themeTransition.run(resolveThemeEffect(CONFIG.theme_transition), from, from === 'dark' ? 'light' : 'dark', {
      x: Math.max(0, Math.min(window.innerWidth, rect.left + rect.width / 2)),
      y: Math.max(0, Math.min(window.innerHeight, rect.top + rect.height / 2))
    }, effectiveReducedMotion())
  }
  button.addEventListener('click', toggle)
  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!event.repeat) toggle()
    }
  })
  subscribeReducedMotion(reduced => { if (reduced) themeTransition.cancel() })
  document.addEventListener('pjax:send', () => themeTransition.cancel())
  window.addEventListener('pagehide', () => themeTransition.cancel())
}

/**
 * 更改主题的meta
 */
export const changeMetaTheme = (color: string): void => {
  if (HTML.getAttribute('data-theme') === 'dark') {
    color = '#222'
  }

  document.querySelector('meta[name="theme-color"]').setAttribute('content', color)
}

let listenerInitialized = false
// Preference state owns the theme policy; this module keeps the existing toggle animation.
export const themeColorListener = () => {
  if (listenerInitialized) return
  listenerInitialized = true
  initReadingPreferences()
  syncThemeIcon()
  subscribeReadingPreferences(() => {
    if (!committing) themeTransition.cancel(false)
    syncThemeIcon()
  })
}
