import { getReducedMotionQuery } from './motion'

let cleanup: (() => void) | undefined

export const refreshCategoryDirectory = () => {
  cleanup?.()
  cleanup = undefined
  const root = document.querySelector<HTMLElement>('.category-directory')
  if (!root) return
  const switchable = root.dataset.switchable !== 'false'
  const controls = root.querySelector<HTMLElement>('.category-controls')!
  const cards = root.querySelector<HTMLElement>('.category-cards')!
  const classic = root.querySelector<HTMLElement>('.category-classic')!
  const buttons = Array.from(controls.querySelectorAll<HTMLButtonElement>('button'))
  const events = new AbortController()
  const animations = new Set<Animation>()
  const reduced = getReducedMotionQuery()
  const setMode = (mode: string) => {
    root.dataset.categoryMode = mode
    cards.hidden = mode !== 'cards'
    classic.hidden = mode !== 'classic'
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.categoryView === mode)))
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    if (!switchable) return
    setMode(button.dataset.categoryView!)
    try { localStorage.setItem('category-view', button.dataset.categoryView!) } catch { /* Storage may be disabled. */ }
  }, { signal: events.signal }))
  const closing = new Map<HTMLDetailsElement, Animation>()
  const track = (animation: Animation) => {
    animations.add(animation)
    void animation.finished.catch(() => {}).then(() => animations.delete(animation))
    return animation
  }
  root.querySelectorAll<HTMLDetailsElement>('details').forEach(details => {
    const content = details.querySelector<HTMLElement>(':scope > .category-children')!
    const summary = details.querySelector<HTMLElement>(':scope > summary')!
    summary.addEventListener('click', event => {
      if ((event.target as Element).closest('a')) return
      const running = closing.get(details)
      if (running) {
        event.preventDefault()
        running.cancel()
        return
      }
      if (!details.open || reduced.matches) return
      event.preventDefault()
      const animation = track(content.animate(
        [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-6px)' }],
        { duration: 160, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' }
      ))
      closing.set(details, animation)
      animation.oncancel = () => closing.delete(details)
      animation.onfinish = () => {
        closing.delete(details)
        details.open = false
        animation.cancel()
      }
    }, { signal: events.signal })
    details.addEventListener('toggle', () => {
      if (!details.open || reduced.matches) return
      track(content.animate(
        [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)' }
      ))
    }, { signal: events.signal })
  })
  let mode = root.dataset.defaultMode === 'classic' ? 'classic' : 'cards'
  if (switchable) {
    try {
      const saved = localStorage.getItem('category-view')
      if (saved === 'cards' || saved === 'classic') mode = saved
    } catch { /* Use the server-rendered default. */ }
  }
  setMode(mode)
  controls.hidden = !switchable
  cleanup = () => {
    events.abort()
    animations.forEach(animation => animation.cancel())
  }
}
