// Reuse Waline's button so its pagination, errors and request state stay native.
export function createCommentPagination(comments: HTMLElement, dialog: HTMLDialogElement | null, blocked: () => boolean, scrollBody: HTMLElement | null = null) {
  return createScrollPagination({
    content: comments, viewport: scrollBody || dialog, blocked: () => blocked() || Boolean(dialog && !dialog.open),
    button: () => comments.querySelector<HTMLButtonElement>('.wl-operation > button'),
    loading: () => Boolean(comments.querySelector('.wl-cards + .wl-loading')),
    signature: () => Array.from(comments.querySelectorAll('.wl-card-item')).map(item => item.id).join('|'),
    buttonSelector: '.wl-operation > button'
  })
}

export function createScrollPagination(config: {
  content: HTMLElement; viewport: HTMLElement | null; blocked: () => boolean;
  button: () => HTMLButtonElement | null; loading: () => boolean;
  signature: () => string; buttonSelector: string;
}) {
  const { content: comments, viewport: dialog, blocked, signature } = config
  const events = new AbortController()
  const options = { signal: events.signal, passive: true }
  const scroller = dialog || window
  let frame = 0
  let intentUntil = 0
  let attempted = ''
  let touchY = 0
  const check = () => {
    frame = 0
    if (performance.now() > intentUntil || blocked()) return
    const button = config.button()
    if (!button || button.hidden || button.disabled || config.loading()) { intentUntil = 0; return }
    const bounds = button.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const viewport = dialog?.getBoundingClientRect()
    const top = viewport?.top ?? 0
    const bottom = viewport?.bottom ?? window.innerHeight
    const threshold = Math.min(240, Math.max(120, (bottom - top) * .2))
    if (bounds.top > bottom + threshold || bounds.bottom < top) return
    const current = signature()
    if (!current || current === attempted) { intentUntil = 0; return }
    attempted = current
    intentUntil = 0 // A completed request alone must never fetch another page.
    button.click()
  }
  const queue = () => { if (!frame) frame = requestAnimationFrame(check) }
  const down = () => { intentUntil = performance.now() + 700; queue() }
  scroller.addEventListener('wheel', ((event: WheelEvent) => {
    if (event.deltaY > 0) down()
    else intentUntil = 0
  }) as EventListener, options)
  scroller.addEventListener('touchstart', ((event: TouchEvent) => {
    touchY = event.touches[0]?.clientY ?? 0
  }) as EventListener, options)
  scroller.addEventListener('touchmove', ((event: TouchEvent) => {
    const next = event.touches[0]?.clientY ?? touchY
    if (touchY - next > 4) down()
    else if (next > touchY) intentUntil = 0
    touchY = next
  }) as EventListener, options)
  scroller.addEventListener('scroll', queue, options)
  document.addEventListener('keydown', event => {
    if ((event.target as Element)?.closest('input, textarea, [contenteditable="true"]')) return
    if (['ArrowDown', 'PageDown', 'End'].includes(event.key) || (event.key === ' ' && !event.shiftKey)) down()
    else intentUntil = 0
  }, options)
  comments.addEventListener('click', event => {
    if ((event.target as Element)?.closest(config.buttonSelector)) {
      attempted = signature()
      intentUntil = 0
    }
  }, { ...options, capture: true })
  return {
    reset() { intentUntil = 0; cancelAnimationFrame(frame); frame = 0 },
    destroy() { events.abort(); cancelAnimationFrame(frame) }
  }
}
