export type ScrollDestination = { left: number; top: number } | { anchor: string }

// A short, event-driven settling window. No polling and no smooth-scroll tug of war.
export function createScrollRestoration(options: {
  page: HTMLElement
  destination: ScrollDestination
  isCurrent: () => boolean
  offset: () => number
  onScroll: () => void
}) {
  const { page, destination, isCurrent, offset, onScroll } = options
  const events = new AbortController()
  let stopped = false
  let started = false
  let frame = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let observer: ResizeObserver | undefined
  let corrections = 0
  let reference: { element: Element; top: number } | undefined
  const cancel = () => {
    if (stopped) return
    stopped = true
    events.abort()
    observer?.disconnect()
    cancelAnimationFrame(frame)
    clearTimeout(timer)
  }
  const current = () => !stopped && page.isConnected && isCurrent()
  const rememberVisibleContent = () => {
    const box = page.getBoundingClientRect()
    const x = Math.max(0, Math.min(innerWidth - 1, box.left + box.width / 2))
    const y = Math.min(innerHeight - 1, Math.max(offset() + 24, 0))
    const hit = document.elementFromPoint(x, y)
    const element = hit?.closest('.line, p, h1, h2, h3, h4, h5, h6, li, img, pre, table, figure, article')
    if (element && page.contains(element)) reference = { element, top: element.getBoundingClientRect().top }
  }
  const apply = (notify = true) => {
    frame = 0
    if (!current() || document.querySelector('dialog[open]')) { cancel(); return }
    // Animated entry changes viewport rects, not actual layout coordinates.
    if (page.dataset.entering === 'true') return
    let left = scrollX
    let top: number
    if ('anchor' in destination) {
      const target = document.getElementById(destination.anchor)
      if (!target || !target.getClientRects().length) return
      if (target.closest('.comment-dialog, .comment-shell')) { cancel(); return }
      const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0
      top = scrollY + target.getBoundingClientRect().top - (margin || offset())
    } else {
      left = destination.left
      if (reference && !reference.element.isConnected) reference = undefined
      top = reference ? scrollY + reference.element.getBoundingClientRect().top - reference.top : destination.top
    }
    top = Math.max(0, top)
    if (Math.abs(scrollY - top) > 1 || Math.abs(scrollX - left) > 1) {
      window.scrollTo({ top, left, behavior: 'instant' })
      // The caller synchronizes the initial viewport once after page setup.
      if (notify) {
        onScroll()
        if (++corrections >= 8) { cancel(); return }
      }
    }
    // Don't pin the wrong paragraph while the document is too short to reach
    // the saved coordinate. Retry that coordinate when delayed content arrives.
    if (!('anchor' in destination) && !reference && Math.abs(scrollY - destination.top) <= 1) rememberVisibleContent()
  }
  const schedule = () => {
    if (!current()) { cancel(); return }
    if (started && !frame) frame = requestAnimationFrame(() => apply())
  }
  const listenerOptions = { signal: events.signal, passive: true, capture: true }
  // Register before asynchronous page setup, so early user input wins too.
  for (const type of ['wheel', 'touchstart', 'pointerdown']) window.addEventListener(type, cancel, listenerOptions)
  window.addEventListener('keydown', event => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar', 'Tab', 'Enter', 'Escape'].includes(event.key)) cancel()
  }, listenerOptions)
  for (const type of ['pagehide', 'popstate', 'hashchange']) window.addEventListener(type, cancel, listenerOptions)
  document.addEventListener('pjax:send', cancel, listenerOptions)
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel() }, listenerOptions)

  return {
    cancel,
    restore() {
      if (!current()) { cancel(); return }
      if (started) return
      started = true
      apply(false)
      if (stopped) return
      // The page top doesn't need anchoring to content below it.
      if (!('anchor' in destination) && destination.top === 0) { cancel(); return }
      timer = setTimeout(cancel, 2500)
      observer = new ResizeObserver(schedule)
      observer.observe(page)
      const header = document.getElementById('header')
      if (header) observer.observe(header)
      page.addEventListener('load', schedule, listenerOptions)
      page.addEventListener('error', schedule, listenerOptions)
      page.addEventListener('shokax:page-entered', schedule, listenerOptions)
      // A full load may perform native fragment positioning after DOM setup.
      window.addEventListener('load', schedule, listenerOptions)
      window.addEventListener('pageshow', schedule, listenerOptions)
      // Initial scrollbar/viewport settling can emit resize without user input.
      window.addEventListener('resize', schedule, listenerOptions)
      window.addEventListener('hexo-blog-decrypt', schedule, listenerOptions)
      document.fonts?.addEventListener('loadingdone', schedule, listenerOptions)
      // Covers parser-time scripts inserted immediately after siteRefresh.
      schedule()
    }
  }
}

export function scrollDestination(hash: string, restored?: [number, number], savedTop = 0): ScrollDestination | null {
  // Comment deep links have their own asynchronous drawer/list positioning.
  if (/^#(?:comments|\d+|[a-f\d]{24})$/i.test(hash)) return null
  if (restored) return { left: Number.isFinite(restored[0]) ? restored[0] : 0, top: Math.max(0, Number.isFinite(restored[1]) ? restored[1] : 0) }
  if (hash) {
    try { return { anchor: decodeURIComponent(hash.slice(1)) } } catch { /* Malformed hash: start at the top. */ }
  }
  return { left: 0, top: Math.max(0, Number.isFinite(savedTop) ? savedTop : 0) }
}
