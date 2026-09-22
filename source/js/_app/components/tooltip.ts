import { pointerTooltipPosition } from './tooltip-position'

let cleanup: (() => void) | undefined

export function refreshTooltips() {
  cleanup?.()
  const events = new AbortController()
  const saved = new Map<HTMLElement, string>()
  const named = new Set<HTMLElement>()
  const tip = document.createElement('div')
  tip.id = 'theme-hover-tooltip'
  tip.className = 'theme-tooltip'
  tip.setAttribute('role', 'tooltip')
  tip.hidden = true
  document.body.append(tip)
  let active: HTMLElement | undefined
  let timer = 0
  let pointer: { x: number; y: number } | undefined
  const position = () => {
    if (!active || tip.hidden) return
    if (pointer) {
      const point = pointerTooltipPosition(pointer, { width: tip.offsetWidth, height: tip.offsetHeight }, { width: window.innerWidth, height: window.innerHeight })
      tip.style.left = `${point.x}px`
      tip.style.top = `${point.y}px`
    } else {
      const box = active.getBoundingClientRect()
      const x = box.left + (box.width - tip.offsetWidth) / 2
      const below = box.bottom + 8
      const y = below + tip.offsetHeight < window.innerHeight - 12 ? below : box.top - tip.offsetHeight - 8
      tip.style.left = `${Math.max(12, Math.min(x, window.innerWidth - tip.offsetWidth - 12))}px`
      tip.style.top = `${Math.max(12, Math.min(y, window.innerHeight - tip.offsetHeight - 12))}px`
    }
    // Filtered/transformed dialogs establish a containing block for fixed children.
    // Convert viewport coordinates to that block instead of adding the dialog offset.
    const rect = tip.getBoundingClientRect()
    const left = Number.parseFloat(tip.style.left)
    const top = Number.parseFloat(tip.style.top)
    tip.style.left = `${left + left - rect.left}px`
    tip.style.top = `${top + top - rect.top}px`
  }
  const hide = () => {
    clearTimeout(timer)
    if (active) {
      const ids = (active.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== tip.id)
      if (ids.length) active.setAttribute('aria-describedby', ids.join(' '))
      else active.removeAttribute('aria-describedby')
    }
    active = undefined
    pointer = undefined
    tip.hidden = true
  }
  const adopt = (element: HTMLElement) => {
    const title = element.getAttribute('title')
    if (title === null || element.closest('.contents.panel, [data-native-tooltip], .wl-panel, .twikoo')) return
    saved.set(element, title)
    if (named.has(element) || (!element.hasAttribute('aria-label') && !element.hasAttribute('aria-labelledby') && !element.textContent?.trim() && !element.querySelector('img[alt]'))) {
      element.setAttribute('aria-label', title)
      named.add(element)
    }
    element.dataset.themeTooltip = title
    element.removeAttribute('title')
  }
  const scan = (node: Node) => {
    if (!(node instanceof HTMLElement)) return
    adopt(node)
    node.querySelectorAll<HTMLElement>('[title]').forEach(adopt)
  }
  scan(document.body)
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') adopt(record.target as HTMLElement)
      else record.addedNodes.forEach(scan)
    }
    if (active && !active.isConnected) hide()
    if (active && tip.textContent !== active.dataset.themeTooltip) {
      tip.textContent = active.dataset.themeTooltip || ''
      position()
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title'] })
  const show = (element: HTMLElement, immediate: boolean, point?: { x: number; y: number }) => {
    if (active === element) { pointer = point; position(); return }
    hide()
    if (!element.dataset.themeTooltip?.trim()) return
    active = element
    pointer = point
    const requestedDelay = Number(element.dataset.tooltipDelay ?? 180)
    const delay = Number.isFinite(requestedDelay) ? Math.max(0, Math.min(1500, requestedDelay)) : 180
    timer = window.setTimeout(() => {
      if (active !== element || !element.isConnected) return
      // A tooltip for a modal must render inside that dialog's top layer.
      const host = element.closest('dialog[open]') || document.body
      if (tip.parentElement !== host) host.append(tip)
      tip.textContent = element.dataset.themeTooltip || ''
      tip.hidden = false
      const ids = (element.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean)
      element.setAttribute('aria-describedby', [...new Set([...ids, tip.id])].join(' '))
      position()
    }, immediate ? 0 : delay)
  }
  const target = (event: Event) => event.target instanceof Element ? event.target.closest<HTMLElement>('[data-theme-tooltip]') : null
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return
    const element = target(event)
    if (element) show(element, false, { x: event.clientX, y: event.clientY })
  }, { signal: events.signal })
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !active || target(event) !== active) return
    pointer = { x: event.clientX, y: event.clientY }
    position()
  }, { signal: events.signal })
  document.addEventListener('focusin', event => { const element = target(event); if (element) show(element, true) }, { signal: events.signal })
  document.addEventListener('pointerout', event => {
    if (active && !(event.relatedTarget instanceof Node && active.contains(event.relatedTarget))) hide()
  }, { signal: events.signal })
  document.addEventListener('focusout', hide, { signal: events.signal })
  document.addEventListener('close', event => {
    if (active?.closest('dialog') === event.target) hide()
  }, { capture: true, signal: events.signal })
  document.addEventListener('pointerdown', hide, { signal: events.signal })
  document.addEventListener('keydown', event => { if (event.key === 'Escape') hide() }, { signal: events.signal })
  window.addEventListener('scroll', hide, { capture: true, passive: true, signal: events.signal })
  window.addEventListener('resize', hide, { signal: events.signal })
  cleanup = () => {
    events.abort()
    observer.disconnect()
    hide()
    tip.remove()
    saved.forEach((title, element) => {
      if (!element.hasAttribute('title')) element.setAttribute('title', title)
      if (named.has(element) && element.getAttribute('aria-label') === title) element.removeAttribute('aria-label')
      delete element.dataset.themeTooltip
    })
  }
}
