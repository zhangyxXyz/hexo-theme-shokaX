let dispose: (() => void) | undefined

export function cancelPageEntry() { dispose?.() }

export function playPageEntry(rise: boolean) {
  dispose?.()
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const animations: Animation[] = []
  const events = new AbortController()
  const page = document.getElementById('main')
  if (rise && !reduced && page) page.dataset.entering = 'true'
  const add = (selector: string, frames: Keyframe[], duration: number) => {
    const target = document.querySelector<HTMLElement>(selector)
    if (target?.animate) animations.push(target.animate(frames, { duration: reduced ? 120 : duration, easing: 'ease' }))
  }
  // Position restoration skips transient transforms until this entrance ends.
  // Explicit hashes/history use opacity only, including native fragment loads.
  add('#main .wrap', reduced || !rise
    ? [{ opacity: .35 }, { opacity: 1 }]
    : [{ opacity: 0, transform: 'translateY(80px)' }, { opacity: 1, transform: 'none' }], 500)
  add('#brand > .pjax', reduced ? [{ opacity: .4 }, { opacity: 1 }]
    : [{ opacity: 0, transform: 'translateY(-18px)' }, { opacity: 1, transform: 'none' }], 300)
  add('#sidebar .panel.active', reduced ? [{ opacity: .4 }, { opacity: 1 }]
    : [{ opacity: 0, transform: 'translateY(80px)' }, { opacity: 1, transform: 'none' }], 500)
  const cancel = () => {
    events.abort()
    clearTimeout(timer)
    animations.forEach(animation => animation.cancel())
    if (page?.dataset.entering === 'true') {
      delete page.dataset.entering
      page.dispatchEvent(new Event('shokax:page-entered'))
    }
    if (dispose === cancel) dispose = undefined
  }
  const timer = setTimeout(cancel, 600)
  dispose = cancel
  // Input cancels before a TOC click measures its target or a user scrolls.
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'pagehide']) {
    window.addEventListener(type, cancel, { passive: true, capture: true, signal: events.signal })
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel() }, { signal: events.signal })
}
