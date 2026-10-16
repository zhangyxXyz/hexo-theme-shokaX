import { getReadingPreferences, subscribeReadingPreferences } from './reading-preferences'
import { normalizeReadingColor } from './reading-preferences/palette'

const originalSources = new WeakMap<HTMLImageElement, string>()
let cleanup: (() => void) | undefined

function contributionURL(source: string) {
  try {
    const url = new URL(source, location.href)
    if (url.protocol !== 'https:' || url.hostname !== 'ghchart.rshah.org' || url.port || url.username || url.password) return
    const match = url.pathname.match(/^\/(?:[\da-f]{6}\/)?([a-z\d-]{1,39})\/?$/i)
    return match ? { url, account: match[1] } : undefined
  } catch { return }
}

export function contributionColorURL(source: string, color: string | null): string | undefined {
  const chart = contributionURL(source)
  if (!chart) return
  if (!color) return source
  // The existing endpoint accepts an opaque hex seed. The default dark theme
  // supplies rgba; its RGB channels retain the same hue without an alpha URL.
  const rgb = color.match(/^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*[\d.]+\s*\)$/i)
  const seed = normalizeReadingColor(rgb ? `rgb(${rgb[1]},${rgb[2]},${rgb[3]})` : color)
  if (!seed) return source
  chart.url.pathname = `/${seed.slice(1).toLowerCase()}/${chart.account}`
  return chart.url.href
}

export function refreshProjectActivity() {
  cleanup?.()
  cleanup = undefined
  const charts = [...document.querySelectorAll<HTMLImageElement>('.projects-activity-content img')].filter(image => {
    const source = originalSources.get(image) ?? image.getAttribute('src')
    if (!source || !contributionURL(source)) return false
    originalSources.set(image, source)
    return true
  })
  if (!charts.length) return
  const controller = new AbortController()
  const pending = new Map<HTMLImageElement, { image: HTMLImageElement; url: string }>()
  let frame: number | undefined
  let previous = getReadingPreferences()
  const custom = (state: typeof previous) => Boolean(state.primaryColor || state.secondaryColor)
  const cancel = (target: HTMLImageElement) => {
    const request = pending.get(target)
    if (!request) return
    pending.delete(target)
    request.image.onload = request.image.onerror = null
    request.image.removeAttribute('src')
  }
  const update = () => {
    const root = document.documentElement
    const color = root.hasAttribute('data-reading-palette') ? getComputedStyle(root).getPropertyValue('--primary-color').trim() : null
    for (const target of charts) {
      if (!target.isConnected) continue
      const url = contributionColorURL(originalSources.get(target)!, color)!
      if (pending.get(target)?.url === url) continue
      cancel(target)
      if (target.src === url || target.getAttribute('src') === url) continue
      const image = new Image()
      pending.set(target, { image, url })
      image.onload = () => {
        if (controller.signal.aborted || !target.isConnected || pending.get(target)?.image !== image) return
        target.src = url
        cancel(target)
      }
      image.onerror = () => { if (pending.get(target)?.image === image) cancel(target) }
      image.src = url
    }
  }
  const schedule = () => {
    if (controller.signal.aborted || frame !== undefined) return
    frame = requestAnimationFrame(() => { frame = undefined; if (!controller.signal.aborted) update() })
  }
  subscribeReadingPreferences(state => {
    if (state.primaryColor !== previous.primaryColor || custom(state) !== custom(previous)) schedule()
    previous = state
  }, { signal: controller.signal })
  const observer = new MutationObserver(schedule)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  cleanup = () => {
    controller.abort()
    observer.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
    charts.forEach(cancel)
  }
  update()
}
