import { closeSelectPicker } from './select-picker'
import { articlePreviewTarget, loadArticlePreview } from './article-preview-links'
import { refreshSummarySwitch } from './summary-switch'

let cleanup: (() => void) | undefined

export function isPreviewTitleTruncated(link?: Element | null): boolean {
  if (!link) return false
  const graphLabel = link.querySelector('[data-graph-label]')
  if (graphLabel) return graphLabel.textContent !== graphLabel.getAttribute('data-graph-label')
  // HTML titles may be clipped on the anchor or on a nested title span.
  return [link, ...link.querySelectorAll('*')].some(element => {
    if (!element.textContent?.trim() || !element.clientWidth) return false
    const style = getComputedStyle(element)
    return (element.scrollWidth > element.clientWidth + 1 && ['hidden', 'clip'].includes(style.overflowX)) ||
      (element.scrollHeight > element.clientHeight + 1 && ['hidden', 'clip'].includes(style.overflowY))
  })
}

export function refreshArticlePreviews() {
  cleanup?.()
  cleanup = undefined
  const root = document.body
  const portal = document.createElement('div')
  portal.className = 'article-link-previews'
  root.append(portal)
  let activeLink: Element | undefined
  let previousDescription: string | null = null
  let pointer: { x: number; y: number } | undefined
  let requestedLink: Element | undefined
  let requestId = 0
  const events = new AbortController()
  const options = { signal: events.signal }
  const desktop = matchMedia('(min-width: 768px) and (hover: hover) and (pointer: fine)')
  let active: HTMLDetailsElement | undefined
  let pinned = false
  let timer = 0
  let leaveTimer = 0
  let warmUntil = 0
  let positionFrame = 0
  const pickerTrigger = () => active?.querySelector<HTMLElement>('.select-picker-trigger[aria-expanded="true"]')
  const ownsMenu = (node: Node | null) => {
    const id = pickerTrigger()?.getAttribute('aria-controls')
    return Boolean(id && node && document.getElementById(id)?.contains(node))
  }
  const ownsActive = (node: Node | null) => Boolean(node && (active?.closest('.article-preview-row')?.contains(node) || active?.contains(node) || activeLink?.contains(node)))
  const hide = () => {
    warmUntil = 0
    requestId++
    requestedLink = undefined
    if (activeLink) {
      if (previousDescription) activeLink.setAttribute('aria-describedby', previousDescription)
      else activeLink.removeAttribute('aria-describedby')
    }
    activeLink = undefined
    pointer = undefined
    clearTimeout(timer)
    clearTimeout(leaveTimer)
    cancelAnimationFrame(positionFrame)
    positionFrame = 0
    timer = leaveTimer = 0
    if (pickerTrigger()) closeSelectPicker()
    if (active) {
      active.classList.remove('is-leaving', 'is-entering')
      active.open = false
      active.closest('.article-preview-row')?.classList.remove('is-previewing')
      active = undefined
    }
    pinned = false
  }
  const dismissHover = () => {
    if (!active) return
    hide()
    // Crossing whitespace between lists is still one preview interaction.
    warmUntil = Date.now() + 500
  }
  const resumeHover = () => {
    clearTimeout(leaveTimer)
    leaveTimer = 0
    active?.classList.remove('is-leaving')
    active?.closest('.article-preview-row')?.classList.add('is-previewing')
  }
  const leavePreview = (event: PointerEvent) => {
    if (!active || pinned) return
    const next = event.type === 'pointermove' ? event.target : event.relatedTarget
    if (ownsActive(next as Node | null) || ownsMenu(next as Node | null)) {
      resumeHover()
      return
    }
    if (leaveTimer) return
    cancelAnimationFrame(positionFrame)
    positionFrame = 0
    active.classList.add('is-leaving')
    active.closest('.article-preview-row')?.classList.remove('is-previewing')
    // Fade now; do not hold the old card opaque before abruptly hiding it.
    leaveTimer = window.setTimeout(dismissHover, 160)
  }
  const position = () => {
    if (!active) return
    active.classList.remove('is-above')
    const content = active.querySelector<HTMLElement>('.article-preview-content')!
    content.style.removeProperty('translate')
    if (!desktop.matches) return
    const anchor = (activeLink || active.closest('.article-preview-row') || active).getBoundingClientRect()
    const textLength = content.querySelector('p:not([hidden])')?.textContent?.length || 0
    // Give longer summaries more room on desktop, while keeping short ones compact.
    const maxWidth = Math.min(760, Math.max(440, innerWidth * .55), innerWidth - 24)
    const width = Math.min(maxWidth, Math.max(360, Math.sqrt(textLength || 80) * 38))
    content.style.width = `${width}px`
    content.style.maxHeight = `${Math.max(120, innerHeight - 84)}px`
    const height = content.offsetHeight
    const origin = pointer || { x: anchor.left + Math.min(anchor.width / 2, 100), y: anchor.bottom }
    const left = Math.max(12, Math.min(origin.x - Math.min(80, width / 4), innerWidth - width - 12))
    const below = anchor.bottom + 12
    const top = Math.max(60, Math.min(below + height <= innerHeight - 12 ? below : anchor.top - height - 12, innerHeight - height - 12))
    content.style.left = `${left}px`
    content.style.top = `${top}px`
    // Transformed article cards and dialogs can establish a fixed-position block.
    const rect = content.getBoundingClientRect()
    content.style.left = `${left + left - rect.left}px`
    content.style.top = `${top + top - rect.top}px`
  }

  const show = (preview: HTMLDetailsElement, pin = false, link?: Element, point?: { x: number; y: number }) => {
    hide()
    active = preview
    activeLink = link
    pointer = point
    if (link) {
      previousDescription = link.getAttribute('aria-describedby')
      link.setAttribute('aria-describedby', [previousDescription, preview.querySelector('.article-preview-content')!.id].filter(Boolean).join(' '))
    }
    pinned = pin
    const title = preview.querySelector<HTMLElement>('.article-preview-title')
    if (title) title.hidden = !isPreviewTitleTruncated(link || preview.closest('.article-preview-row')?.querySelector('a'))
    preview.classList.add('is-entering')
    preview.open = true
    preview.closest('.article-preview-row')?.classList.add('is-previewing')
    position()
    // Establish the initial opacity once. Subsequent leave/re-entry reverses
    // the CSS transition from its current opacity instead of restarting an animation.
    getComputedStyle(preview.querySelector('.article-preview-content')!).opacity
    preview.classList.remove('is-entering')
  }
  const bindPreview = (preview: HTMLDetailsElement) => {
    const row = preview.closest<HTMLElement>('.article-preview-row') || preview
    const toggle = preview.querySelector<HTMLElement>('summary')!
    row.addEventListener('pointerenter', event => {
      clearTimeout(timer)
      clearTimeout(leaveTimer)
      timer = leaveTimer = 0
      if (!desktop.matches || event.pointerType === 'touch') return
      if (active === preview) { resumeHover(); return }
      const point = { x: event.clientX, y: event.clientY }
      // Only the first preview needs an intent delay; switching must retire the old row now.
      if (active || Date.now() < warmUntil) show(preview, false, undefined, point)
      else timer = window.setTimeout(() => { timer = 0; show(preview, false, undefined, point) }, 250)
    }, options)
    row.addEventListener('pointerleave', event => {
      clearTimeout(timer)
      timer = 0
      if (active === preview) leavePreview(event)
    }, options)
    row.querySelector('a')?.addEventListener('focus', () => { if (desktop.matches) show(preview) }, options)
    row.querySelector('a')?.addEventListener('click', hide, options)
    row.addEventListener('focusout', event => {
      // Closing the previous card can blur its picker after the next card opens.
      if (active === preview && !row.contains(event.relatedTarget as Node | null) && !ownsMenu(event.relatedTarget as Node | null)) hide()
    }, options)
    toggle.addEventListener('click', event => {
      event.preventDefault()
      if (active === preview && pinned) hide()
      else show(preview, true)
    }, options)
    preview.addEventListener('change', () => {
      const select = preview.querySelector<HTMLSelectElement>('[data-summary-select]')
      const content = preview.querySelector<HTMLElement>('.article-preview-content')!
      const original = select?.value === 'original'
      content.querySelector<HTMLElement>('[data-preview-label]')!.textContent = (original ? content.dataset.originalLabel : content.dataset.aiLabel) || ''
      const symbol = content.querySelector<HTMLElement>('.article-preview-symbol')!
      symbol.className = 'article-preview-symbol' + (original ? ' ic i-align-left' : '')
      symbol.textContent = original ? '' : '✦'
      position()
    }, options)
  }
  root.querySelectorAll<HTMLDetailsElement>('.article-preview-row .article-preview').forEach(bindPreview)
  const requestPreview = (link: Element, path: string, point?: { x: number; y: number }) => {
    if (activeLink === link) { resumeHover(); return }
    if (requestedLink === link) return
    const switching = Boolean(active) || Date.now() < warmUntil
    hide()
    requestedLink = link
    const current = ++requestId
    timer = window.setTimeout(async () => {
      timer = 0
      try {
        const preview = await loadArticlePreview(path)
        if (!preview || events.signal.aborted || current !== requestId || !link.isConnected) return
        portal.replaceChildren(preview)
        const dialog = link.closest('dialog[open]')
        ;(dialog || document.body).append(portal)
        bindPreview(preview)
        refreshSummarySwitch()
        show(preview, false, link, point)
      } catch { /* Keep the article link usable if the preview cannot load. */ }
      finally { if (current === requestId) requestedLink = undefined }
    }, switching ? 0 : 250)
  }
  document.addEventListener('pointerover', event => {
    if (!desktop.matches || event.pointerType === 'touch' || !(event.target instanceof Element)) return
    const link = event.target.closest('a[href]')
    const path = link && articlePreviewTarget(link)
    if (link && path) requestPreview(link, path, { x: event.clientX, y: event.clientY })
  }, options)
  document.addEventListener('pointerout', event => {
    const link = requestedLink || activeLink
    if (!link || !(event.target instanceof Node) || !link.contains(event.target)) return
    const next = event.relatedTarget as Node | null
    if (link.contains(next) || ownsActive(next) || ownsMenu(next)) return
    clearTimeout(timer)
    timer = 0
    requestId++
    requestedLink = undefined
    leavePreview(event)
  }, options)
  document.addEventListener('focusin', event => {
    if (!desktop.matches || !(event.target instanceof Element)) return
    const link = event.target.closest('a[href]')
    const path = link && articlePreviewTarget(link)
    if (link && path) requestPreview(link, path)
  }, options)
  document.addEventListener('focusout', () => {
    // A picker removes its focused menu before restoring focus to the trigger.
    window.setTimeout(() => {
      if (!events.signal.aborted && activeLink && !ownsActive(document.activeElement) && !ownsMenu(document.activeElement)) hide()
    }, 0)
  }, options)
  root.addEventListener('click', event => {
    if ((event.target as Element).closest('[data-archive-mode], [data-archive-expand], [data-archive-month-prev], [data-archive-month-next], [data-archive-month-all], .archive-year-title, [data-graph-page], [data-graph-all]')) hide()
  }, { ...options, capture: true })
  root.addEventListener('toggle', event => {
    const fold = event.target
    if (fold instanceof HTMLDetailsElement && !fold.open && active && fold !== active && fold.contains(active)) hide()
  }, { ...options, capture: true })
  document.addEventListener('pointerdown', event => {
    // The portalled model menu owns its own lifetime; opening it must not
    // permanently pin the preview after choosing a model or dismissing it.
    if (active?.contains(event.target as Node) && (event.target as Element).closest('.select-picker-trigger')) pinned = false
    else if (active && !ownsActive(event.target as Node) && !ownsMenu(event.target as Node)) hide()
  }, options)
  document.addEventListener('pointermove', event => {
    if (!desktop.matches || event.pointerType === 'touch' || !active || pinned) return
    if (ownsActive(event.target as Node) || ownsMenu(event.target as Node)) {
      resumeHover()
      if (!active.contains(event.target as Node) && !ownsMenu(event.target as Node)) {
        pointer = { x: event.clientX, y: event.clientY }
        // Coalesce high-frequency mouse events into one placement per paint.
        if (!positionFrame) positionFrame = requestAnimationFrame(() => { positionFrame = 0; position() })
      }
    } else leavePreview(event)
  }, { ...options, passive: true })
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !pickerTrigger()) hide() }, options)
  document.addEventListener('close', event => { if (activeLink?.closest('dialog') === event.target) hide() }, { ...options, capture: true })
  window.addEventListener('scroll', () => { if (desktop.matches && !pickerTrigger()) hide() }, { ...options, passive: true })
  window.addEventListener('resize', hide, options)
  document.addEventListener('pjax:send', hide, options)
  window.addEventListener('pagehide', hide, options)
  cleanup = () => { events.abort(); hide(); portal.remove() }
}
