import type { Labels } from './types'

export function scrollArrows(frame: HTMLElement, scroll: HTMLElement, content: HTMLElement, labels: Labels, signal: AbortSignal) {
  const buttons = [-1, 1].map(direction => {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = `statistics-calendar-arrow is-${direction < 0 ? 'left' : 'right'}`
    button.setAttribute('aria-label', labels[direction < 0 ? 'scroll_left' : 'scroll_right'])
    const icon = document.createElement('i')
    icon.className = `ic i-chevrons-${direction < 0 ? 'left' : 'right'}`
    icon.setAttribute('aria-hidden', 'true')
    button.append(icon)
    button.onclick = () => scroll.scrollBy({ left: direction * scroll.clientWidth * .75, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    frame.append(button)
    return button
  })
  const update = () => {
    const max = scroll.scrollWidth - scroll.clientWidth
    buttons[0].hidden = max <= 1 || scroll.scrollLeft <= 1
    buttons[1].hidden = max <= 1 || scroll.scrollLeft >= max - 1
  }
  scroll.addEventListener('scroll', update, { passive: true, signal })
  const observer = new ResizeObserver(update)
  observer.observe(scroll)
  observer.observe(content)
  signal.addEventListener('abort', () => observer.disconnect(), { once: true })
  update()
  return update
}
