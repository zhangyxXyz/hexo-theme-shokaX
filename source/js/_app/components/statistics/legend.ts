import type { Labels, Point } from './types'
import type { Panel } from './panel'
import { scrollArrows } from './scroll-arrows'

// Native touch scrolling plus mouse dragging; buttons retain keyboard and click filtering.
export function createLegend(panel: Panel, data: Point[], chart: any, labels: Labels, signal: AbortSignal) {
  const frame = document.createElement('div')
  frame.className = 'statistics-legend-frame'
  const legend = document.createElement('div')
  legend.className = 'statistics-legend'
  const selected: Record<string, boolean> = {}
  let drag: { x: number; scroll: number; moved: boolean } | undefined
  let suppressClick = false
  legend.onpointerdown = event => {
    suppressClick = false
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    drag = { x: event.clientX, scroll: legend.scrollLeft, moved: false }
  }
  legend.onpointermove = event => {
    if (!drag) return
    const distance = event.clientX - drag.x
    if (!drag.moved && Math.abs(distance) < 5) return
    drag.moved = true
    suppressClick = true
    legend.setPointerCapture(event.pointerId)
    legend.classList.add('is-dragging')
    legend.scrollLeft = drag.scroll - distance
    event.preventDefault()
  }
  const stop = () => { drag = undefined; legend.classList.remove('is-dragging') }
  legend.onpointerup = legend.onpointercancel = legend.onlostpointercapture = stop
  legend.onpointerleave = () => { if (!drag?.moved) stop() }
  const buttons = data.map(item => {
    const button = document.createElement('button')
    button.type = 'button'
    button.setAttribute('aria-pressed', 'true')
    const swatch = document.createElement('span')
    swatch.className = 'statistics-legend-swatch'
    swatch.setAttribute('aria-hidden', 'true')
    const name = document.createElement('span')
    name.textContent = item.name
    button.append(swatch, name)
    button.onclick = event => {
      if (suppressClick && event.detail !== 0) { suppressClick = false; return }
      selected[item.name] = selected[item.name] === false
      button.setAttribute('aria-pressed', String(selected[item.name]))
      chart.dispatchAction({ type: 'legendToggleSelect', name: item.name })
    }
    legend.append(button)
    return swatch
  })
  frame.append(legend)
  panel.element.append(frame)
  const update = scrollArrows(frame, legend, legend, labels, signal)
  signal.addEventListener('abort', stop, { once: true })
  return (option: any) => {
    option.legend = { show: false, selected }
    buttons.forEach((swatch, index) => { swatch.style.backgroundColor = option.color[index % option.color.length] })
    update()
  }
}
