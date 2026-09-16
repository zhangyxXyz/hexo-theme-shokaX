let cleanup: (() => void) | undefined

export function refreshTocTooltip() {
  cleanup?.()
  cleanup = undefined
  const panel = document.querySelector<HTMLElement>('.contents.panel')
  if (!panel) return
  const events = new AbortController()
  let tip: HTMLDivElement | undefined
  let active: HTMLAnchorElement | undefined
  let hideTimer = 0
  const hide = () => {
    window.clearTimeout(hideTimer)
    tip?.remove()
    tip = undefined
    active = undefined
  }
  const deferHide = () => {
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(hide, 120)
  }
  const show = (link: HTMLAnchorElement) => {
    window.clearTimeout(hideTimer)
    if (active === link) return
    hide()
    if (link.scrollWidth <= link.clientWidth + 1) return
    active = link
    tip = document.createElement('div')
    tip.className = 'toc-title-tooltip'
    // The anchor already exposes its full text to assistive technology.
    tip.setAttribute('aria-hidden', 'true')
    tip.textContent = link.textContent || ''
    document.body.appendChild(tip)
    const rect = link.getBoundingClientRect()
    const width = tip.offsetWidth
    const height = tip.offsetHeight
    const x = rect.left >= width + 20 ? rect.left - width - 8 : rect.left
    tip.style.left = `${Math.max(12, Math.min(x, window.innerWidth - width - 12))}px`
    tip.style.top = `${Math.max(12, Math.min(rect.top, window.innerHeight - height - 12))}px`
    tip.addEventListener('pointerenter', () => window.clearTimeout(hideTimer))
    tip.addEventListener('pointerleave', deferHide)
  }
  panel.querySelectorAll<HTMLAnchorElement>('.toc-link').forEach(link => {
    const options = { signal: events.signal }
    link.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') show(link)
    }, options)
    link.addEventListener('pointerleave', deferHide, options)
    link.addEventListener('focus', () => show(link), options)
    link.addEventListener('blur', hide, options)
    link.addEventListener('click', hide, options)
  })
  window.addEventListener('scroll', hide, { capture: true, passive: true, signal: events.signal })
  window.addEventListener('resize', hide, { signal: events.signal })
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide() }, { signal: events.signal })
  cleanup = () => { events.abort(); hide() }
}
