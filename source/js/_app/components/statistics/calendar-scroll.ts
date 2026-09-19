import type { Labels } from './types'
import { scrollArrows } from './scroll-arrows'

export function calendarScroll(body: HTMLElement, labels: Labels, signal: AbortSignal) {
  const frame = document.createElement('div'), scroll = document.createElement('div')
  frame.className = 'statistics-calendar-frame'
  scroll.className = 'statistics-calendar-scroll'
  scroll.tabIndex = 0
  scroll.setAttribute('aria-label', labels.calendar)
  body.before(frame)
  frame.append(scroll)
  scroll.append(body)
  scrollArrows(frame, scroll, body, labels, signal)
  let drag: { x: number; left: number; moved: boolean } | undefined
  scroll.onpointerdown = event => {
    if (event.pointerType === 'mouse' && event.button === 0) drag = { x: event.clientX, left: scroll.scrollLeft, moved: false }
  }
  scroll.onpointermove = event => {
    if (!drag) return
    const distance = event.clientX - drag.x
    if (!drag.moved && Math.abs(distance) < 5) return
    drag.moved = true
    scroll.setPointerCapture(event.pointerId)
    scroll.classList.add('is-dragging')
    scroll.scrollLeft = drag.left - distance
    event.preventDefault()
  }
  const stop = () => { drag = undefined; scroll.classList.remove('is-dragging') }
  scroll.onpointerup = scroll.onpointercancel = scroll.onlostpointercapture = stop
  scroll.onpointerleave = () => { if (!drag?.moved) stop() }
  signal.addEventListener('abort', stop, { once: true })
}
