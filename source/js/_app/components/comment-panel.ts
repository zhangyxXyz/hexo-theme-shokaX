import { openedByPointer, restoreModalFocus } from './input-modality'
import { waitCommentImage } from './comment-media'
import { createCommentPagination } from './comment-pagination'

let cleanup: (() => void) | undefined

// A single lifecycle for lazy loading, deep links and the optional modal drawer.
export function refreshCommentPanel(mount: () => Promise<void>) {
  cleanup?.()
  const shell = document.querySelector<HTMLElement>('[data-comment-layout]')
  const comments = shell?.querySelector<HTMLElement>('#comments')
  if (!shell || !comments) return
  const events = new AbortController()
  const options = { signal: events.signal }
  let mounted: Promise<void> | undefined
  let pending = ''
  let lastCount = -1
  let frame = 0
  let overflow: string | undefined
  let returnFocus: HTMLElement | null = null
  let pointerOpened = false
  let clearTargetEffect: (() => void) | undefined
  let targetLoading: AbortController | undefined
  const dialog = shell.dataset.commentLayout === 'slide' ? document.createElement('dialog') : null
  const pagination = createCommentPagination(comments, dialog, () => Boolean(pending))
  const status = document.createElement('p')
  status.className = 'comment-target-status'
  status.setAttribute('role', 'status')
  const close = () => {
    pagination.reset()
    pending = ''
    targetLoading?.abort()
    cancelAnimationFrame(frame)
    clearTargetEffect?.()
    dialog?.close()
    if (overflow !== undefined) document.body.style.overflow = overflow
    overflow = undefined
    restoreModalFocus(returnFocus, pointerOpened)
  }
  if (dialog) {
    dialog.className = 'comment-dialog'
    dialog.dataset.side = shell.dataset.side
    dialog.setAttribute('aria-label', shell.dataset.title || '')
    dialog.tabIndex = -1
    const header = document.createElement('header')
    header.className = 'comment-dialog-header'
    const title = document.createElement('h2')
    title.textContent = shell.dataset.title || ''
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'comment-dialog-close'
    const icon = document.createElement('i')
    icon.className = 'ic i-times'
    icon.setAttribute('aria-hidden', 'true')
    button.append(icon)
    button.setAttribute('aria-label', shell.dataset.close || '')
    button.addEventListener('click', close, options)
    header.append(title, button)
    dialog.append(header, status, comments)
    document.body.append(dialog)
    dialog.addEventListener('cancel', event => { event.preventDefault(); close() }, options)
    let backdrop = false
    const outside = (event: MouseEvent) => {
      const rect = dialog.getBoundingClientRect()
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
    }
    dialog.addEventListener('pointerdown', event => { backdrop = outside(event) }, options)
    dialog.addEventListener('click', event => { if (backdrop && outside(event)) close(); backdrop = false }, options)
  } else shell.prepend(status)
  const load = () => mounted ??= mount()
  const locate = () => {
    if (!pending || events.signal.aborted) return
    const target = document.getElementById(pending)
    if (target && comments.contains(target)) {
      pending = ''
      targetLoading?.abort()
      const loading = new AbortController()
      targetLoading = loading
      frame = requestAnimationFrame(async () => {
        // The root card also contains every reply; locate only its own header.
        const heading = target.querySelector<HTMLElement>(':scope > .wl-card > .wl-head') || target
        heading.scrollIntoView({ block: 'center', behavior: 'instant' })
        clearTargetEffect?.()
        // Only this comment's media, never descendants belonging to replies.
        const images = Array.from(target.querySelectorAll<HTMLImageElement>('.wl-user img, .wl-content img'))
          .filter(image => image.closest('.wl-card-item') === target)
        images.forEach(image => { image.loading = 'eager' })
        await Promise.all(images.map(image => waitCommentImage(image, loading.signal)))
        if (loading.signal.aborted || !target.isConnected) return
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
        if (loading.signal.aborted || !target.isConnected) return
        // Reveal only the target's images before drawing attention to its avatar.
        await Promise.all(images.flatMap(image => image.getAnimations())
          .filter(animation => animation instanceof CSSAnimation && animation.animationName === 'comment-media-reveal')
          .map(animation => animation.finished.catch(() => {})))
        if (loading.signal.aborted || !target.isConnected) return
        heading.scrollIntoView({ block: 'center', behavior: 'instant' })
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
        const host = target.querySelector<HTMLElement>(':scope > .wl-user')
        const avatar = host?.querySelector<HTMLElement>('.wl-user-avatar')
        if (!host || !avatar) return
        const bounds = avatar.getBoundingClientRect()
        const parent = host.getBoundingClientRect()
        const effect = document.createElement('span')
        effect.className = 'comment-locate-burst'
        effect.setAttribute('aria-hidden', 'true')
        effect.style.left = `${bounds.left - parent.left + bounds.width / 2}px`
        effect.style.top = `${bounds.top - parent.top + bounds.height / 2}px`
        const animations: Animation[] = []
        const ring = document.createElement('span')
        ring.className = 'comment-locate-ring'
        ring.style.width = ring.style.height = `${bounds.width + 6}px`
        effect.append(ring)
        host.append(effect)
        animations.push(ring.animate([
          { transform: 'translate(-50%, -50%) scale(.85)', opacity: .85 },
          { transform: 'translate(-50%, -50%) scale(1.65)', opacity: 0 }
        ], { duration: 950, easing: 'ease-out', fill: 'forwards' }))
        for (let index = 0; index < 8; index++) {
          const dot = document.createElement('span')
          dot.className = 'comment-locate-dot'
          effect.append(dot)
          const angle = index * Math.PI / 4
          const start = bounds.width / 2 + 3
          const end = start + 20
          animations.push(dot.animate([
            { transform: `translate(${Math.cos(angle) * start}px, ${Math.sin(angle) * start}px) scale(1)`, opacity: .8 },
            { transform: `translate(${Math.cos(angle) * end}px, ${Math.sin(angle) * end}px) scale(.25)`, opacity: 0 }
          ], { duration: 700 + index * 25, easing: 'ease-out', fill: 'forwards' }))
        }
        const clear = () => { animations.forEach(animation => animation.cancel()); effect.remove() }
        clearTargetEffect = clear
        void Promise.all(animations.map(animation => animation.finished)).then(clear).catch(() => {})
      })
      return
    }
    if (comments.querySelector('.wl-cards + .wl-loading')) return
    const count = comments.querySelectorAll('.wl-card-item').length
    const more = comments.querySelector<HTMLButtonElement>('.wl-operation > button')
    // Advance only when a page added comments. A failed request cannot loop.
    if (more && count > 0 && count > lastCount) {
      lastCount = count
      more.click()
    } else if (comments.querySelector('.wl-meta-foot')) {
      status.textContent = shell.dataset.missing || ''
      pending = ''
    }
  }
  const syncEntryCount = () => {
    const label = document.querySelector('.comment-entry-count')
    const count = comments.querySelector('.wl-count .wl-num')?.textContent?.trim()
    const text = count && /^\d+$/.test(count) ? ` · ${count}` : ''
    if (label && label.textContent !== text) label.textContent = text
  }
  const observer = new MutationObserver(() => { syncEntryCount(); locate() })
  observer.observe(comments, { childList: true, subtree: true })
  const open = (id = '') => {
    pagination.reset()
    targetLoading?.abort()
    cancelAnimationFrame(frame)
    clearTargetEffect?.()
    if (dialog && !dialog.open) {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
      pointerOpened = openedByPointer()
      overflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      dialog.showModal()
      dialog.focus({ preventScroll: true })
    }
    status.textContent = ''
    pending = id === 'comments' ? '' : id
    lastCount = -1
    void load().then(() => {
      if (events.signal.aborted) return
      if (pending) locate()
      else if (!dialog) comments.scrollIntoView({ block: 'start' })
    }).catch(console.error)
  }
  const readHash = () => {
    try { return decodeURIComponent(location.hash.slice(1)) } catch { return '' }
  }
  const isComment = (id: string) => /^(?:comments|\d+|[a-f\d]{24})$/i.test(id) || Boolean(document.getElementById(id)?.closest('.wl-card-item'))
  const followHash = () => { const id = readHash(); if (isComment(id)) open(id) }
  window.addEventListener('hashchange', followHash, options)
  document.addEventListener('shokax:open-comments', () => open(), options)
  document.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]')
    if (!link || link.target === '_blank') return
    const url = new URL(link.href)
    if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search) return
    let id: string
    try { id = decodeURIComponent(url.hash.slice(1)) } catch { return }
    if (!isComment(id)) return
    event.preventDefault()
    event.stopImmediatePropagation()
    if (url.hash !== location.hash) history.pushState(null, '', url.hash)
    open(id)
  }, { ...options, capture: true })
  const intersection = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) { void load().catch(console.error); intersection.disconnect() }
  })
  if (!dialog) intersection.observe(shell)
  followHash()
  cleanup = () => {
    pagination.destroy()
    events.abort()
    observer.disconnect()
    intersection.disconnect()
    cancelAnimationFrame(frame)
    returnFocus = null
    close()
    if (dialog) { shell.append(comments); dialog.remove() }
    status.remove()
    cleanup = undefined
  }
}

document.addEventListener('pjax:send', () => cleanup?.())
