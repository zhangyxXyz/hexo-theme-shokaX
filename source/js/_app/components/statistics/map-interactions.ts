import { mapHitBounds } from './assets'
import type { Labels, MapMode } from './types'
import type { Panel } from './panel'

export function mapInteractions(chart: any, panel: Panel, labels: Labels, mode: () => MapMode, signal: AbortSignal) {
  const hit = document.createElement('button')
  let pinned = false
  hit.type = 'button'
  hit.className = 'statistics-map-hit'
  hit.hidden = true
  hit.setAttribute('aria-label', labels.south_sea)
  hit.setAttribute('aria-pressed', 'false')
  const showTooltip = () => {
    const target = mapHitBounds.get(mode())
    if (target) chart.dispatchAction({ type: 'showTip', seriesIndex: 0, name: target.name })
  }
  const highlight = (active: boolean) => {
    hit.classList.toggle('is-active', active)
    const target = mapHitBounds.get(mode())
    if (target) chart.dispatchAction({ type: active ? 'highlight' : 'downplay', seriesIndex: 0, name: target.name })
    if (active) showTooltip()
    else chart.dispatchAction({ type: 'hideTip' })
  }
  const reset = () => {
    pinned = false
    hit.setAttribute('aria-pressed', 'false')
    highlight(false)
  }
  hit.onmouseenter = hit.onfocus = () => highlight(true)
  hit.onmousemove = showTooltip
  hit.onmouseleave = hit.onblur = () => highlight(pinned)
  hit.onclick = () => {
    pinned = !pinned
    hit.setAttribute('aria-pressed', String(pinned))
    highlight(pinned)
  }
  document.addEventListener('pointerdown', event => {
    if (!hit.contains(event.target as Node)) reset()
  }, { signal })
  hit.onkeydown = event => {
    if (event.key === 'Escape') { reset(); hit.blur() }
  }
  panel.body.append(hit)
  return {
    reset,
    update() {
      const target = mapHitBounds.get(mode())
      hit.hidden = !target
      if (!target) return
      const topLeft = chart.convertToPixel({ geoIndex: 0 }, [target.west, target.north])
      const bottomRight = chart.convertToPixel({ geoIndex: 0 }, [target.east, target.south])
      hit.style.left = `${topLeft[0] - 8}px`
      hit.style.top = `${topLeft[1] - 8}px`
      hit.style.width = `${Math.max(44, bottomRight[0] - topLeft[0] + 16)}px`
      hit.style.height = `${Math.max(44, bottomRight[1] - topLeft[1] + 16)}px`
      if (pinned) highlight(true)
    },
  }
}
