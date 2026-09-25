import { CONFIG, HTML } from './globalVars'
import { resolveThemeEffect } from '../components/theme-transition'
import { createThemeTransitionRunner } from '../components/theme-transition/runner'
import type { ThemeMode } from '../components/theme-transition/types'

const themeTransition = createThemeTransitionRunner(mode => {
  applyTheme(mode)
  try { localStorage.setItem('theme', mode) } catch { /* Storage may be disabled. */ }
})

/**
 * 更改日夜模式
 */
const applyTheme = (type?: string) => {
  const btn = document.querySelector('.theme .ic')
  if (type === 'dark') {
    HTML.setAttribute('data-theme', type)
    btn?.classList.remove('i-sun')
    btn?.classList.add('i-moon')
  } else {
    HTML.removeAttribute('data-theme')
    btn?.classList.remove('i-moon')
    btn?.classList.add('i-sun')
  }
}

export const changeTheme = (type?: string) => {
  themeTransition.cancel(false)
  applyTheme(type)
}

let toggleInitialized = false
export function initThemeToggle() {
  if (toggleInitialized) return
  const button = document.querySelector<HTMLElement>('#rightNav .theme')
  if (!button) return
  toggleInitialized = true
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const toggle = () => {
    const rect = button.getBoundingClientRect()
    const from: ThemeMode = HTML.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    themeTransition.run(resolveThemeEffect(CONFIG.theme_transition), from, from === 'dark' ? 'light' : 'dark', {
      x: Math.max(0, Math.min(window.innerWidth, rect.left + rect.width / 2)),
      y: Math.max(0, Math.min(window.innerHeight, rect.top + rect.height / 2))
    }, motion.matches)
  }
  button.addEventListener('click', toggle)
  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!event.repeat) toggle()
    }
  })
  motion.addEventListener('change', event => { if (event.matches) themeTransition.cancel() })
  document.addEventListener('pjax:send', () => themeTransition.cancel())
  window.addEventListener('pagehide', () => themeTransition.cancel())
}

/**
 * 自动调整黑夜白天
 * 优先级: 手动选择>时间>跟随系统
 */
export const autoDarkmode = () => {
  if (CONFIG.auto_dark.enable) {
    if (new Date().getHours() >= CONFIG.auto_dark.start || new Date().getHours() <= CONFIG.auto_dark.end) {
      changeTheme('dark')
    } else {
      changeTheme()
    }
  }
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

// 记忆日夜模式切换和系统亮暗模式监听
export const themeColorListener = () => {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (mediaQueryList) => {
    if (mediaQueryList.matches) {
      changeTheme('dark')
    } else {
      changeTheme()
    }
  })

  let t: string | null = null
  try { t = localStorage.getItem('theme') } catch { /* Use the configured default. */ }
  if (t) {
    changeTheme(t)
  } else {
    if (CONFIG.darkmode) {
      changeTheme('dark')
    }
  }
}
