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
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
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
  root.querySelectorAll<HTMLDetailsElement>('details').forEach(details => {
    details.addEventListener('toggle', () => {
      if (!details.open || reduced.matches) return
      const content = details.querySelector<HTMLElement>(':scope > .category-children')!
      const animation = content.animate([{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' })
      animations.add(animation)
      void animation.finished.catch(() => {}).then(() => animations.delete(animation))
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
