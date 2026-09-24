type LoaderOptions = { start: boolean; switch: boolean; scope?: 'content' | 'viewport' }

// The loader never gates navigation or waits for animation/network completion.
export function createPageLoader(root: HTMLElement, options: LoaderOptions) {
  let revision = 0
  let shownAt = 0
  let exitTimer: ReturnType<typeof setTimeout> | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  const clear = () => { clearTimeout(exitTimer); clearTimeout(deadline) }
  const cancel = () => {
    ++revision
    clear()
    root.hidden = true
    document.body.classList.add('loaded')
  }
  const show = (mode: 'initial' | 'navigation' = 'initial') => {
    const token = ++revision
    clear()
    if (!(mode === 'initial' ? options.start : options.switch)) { root.hidden = true; return token }
    root.removeAttribute('style')
    root.dataset.mode = mode
    root.dataset.state = 'loading'
    root.dataset.scope = options.scope || 'content'
    if (mode === 'navigation' && options.scope !== 'viewport') {
      const page = document.getElementById('main')?.getBoundingClientRect()
      if (page) {
        const left = Math.max(0, page.left)
        const top = Math.min(Math.max(50, page.top), innerHeight * .2)
        root.style.left = `${left}px`
        root.style.width = `${Math.max(0, Math.min(page.width, innerWidth - left))}px`
        root.style.top = `${top}px`
        root.style.right = 'auto'
      }
    }
    shownAt = performance.now()
    root.hidden = false
    // Independent escape hatch: even a failed initializer cannot strand the UI.
    deadline = setTimeout(() => { if (token === revision) cancel() }, 15000)
    return token
  }
  const hide = (token = revision, reveal?: () => void) => {
    if (token !== revision) return
    document.body.classList.add('loaded')
    clear()
    if (root.hidden) { reveal?.(); return }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    // Hold only the visual layer briefly; the new page is already usable below.
    exitTimer = setTimeout(() => {
      if (token !== revision) return
      root.dataset.state = 'leaving'
      reveal?.()
      exitTimer = setTimeout(() => { if (token === revision) root.hidden = true }, reduced ? 100 : 240)
    }, reduced ? 0 : Math.max(0, 180 - (performance.now() - shownAt)))
  }
  window.addEventListener('pagehide', cancel)
  const dismissOnInput = () => { if (!root.hidden) cancel() }
  window.addEventListener('wheel', dismissOnInput, { passive: true })
  window.addEventListener('touchstart', dismissOnInput, { passive: true })
  document.addEventListener('visibilitychange', () => { root.dataset.paused = String(document.hidden) })
  // Initial markup is present before the main bundle; resume its lifecycle once.
  if (!root.hidden) show()
  return { show, hide, vanish: cancel }
}
