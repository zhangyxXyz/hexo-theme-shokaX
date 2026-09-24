let cleanup: (() => void) | undefined

export const refreshBookmarks = () => {
  cleanup?.()
  cleanup = undefined
  const root = document.querySelector<HTMLElement>('.bookmark-directory')
  if (!root) return
  const content = root.querySelector<HTMLElement>('.bookmark-content')!
  const toolbar = root.querySelector<HTMLElement>('.bookmark-toolbar')!
  const status = root.querySelector<HTMLElement>('.bookmark-status')!
  const events = new AbortController()
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let animation: Animation | undefined
  let frame = 0

  // Enhance the existing Markdown once: one set of links and heading IDs serves both views.
  if (!root.dataset.ready) {
    let group: HTMLElement | undefined
    let groupBody: HTMLElement | undefined
    let subgroup: HTMLElement | undefined
    Array.from(content.children).forEach(node => {
      const element = node as HTMLElement
      if (element.matches('h1')) {
        group = document.createElement('section')
        group.className = 'bookmark-group'
        element.classList.add('bookmark-group-heading')
        content.insertBefore(group, element)
        group.append(element)
        groupBody = document.createElement('div')
        groupBody.className = 'bookmark-group-body'
        group.append(groupBody)
        subgroup = groupBody
      } else if (group && groupBody && element.matches('h2')) {
        subgroup = document.createElement('div')
        subgroup.className = 'bookmark-subgroup'
        element.classList.add('bookmark-subgroup-heading')
        subgroup.append(element)
        groupBody.append(subgroup)
      } else if (group && subgroup && element.matches('.links')) {
        let grid = subgroup.querySelector<HTMLElement>(':scope > .bookmark-grid')
        if (!grid) {
          grid = document.createElement('div')
          grid.className = 'bookmark-grid links'
          subgroup.append(grid)
        }
        element.querySelectorAll<HTMLElement>(':scope > .item').forEach(item => {
          const title = item.querySelector<HTMLAnchorElement>('a.title')
          if (!title) return
          // Move the original links card intact, including its --block-color and hover styles.
          item.classList.add('bookmark-card')
          item.removeAttribute('title')
          item.removeAttribute('data-theme-tooltip')
          item.querySelector('.image')?.setAttribute('aria-label', title.textContent?.trim() || '')
          grid!.append(item)
        })
        element.remove()
      } else if (subgroup) {
        subgroup.append(element)
      }
    })
    content.querySelectorAll<HTMLElement>('.bookmark-group').forEach(section => {
      const headingCount = document.createElement('span')
      headingCount.className = 'bookmark-group-count'
      headingCount.textContent = String(section.querySelectorAll('.bookmark-card').length)
      section.querySelector('.bookmark-group-heading')?.append(headingCount)
    })
    root.dataset.ready = 'true'
  }

  const viewButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-bookmark-view]'))
  status.textContent = (root.dataset.countLabel || '%s').replace('%s', String(content.querySelectorAll('.bookmark-card').length))
  const setMode = (mode: string) => {
    root.dataset.mode = mode === 'axis' ? 'axis' : 'cards'
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.bookmarkView === root.dataset.mode)))
  }
  const transition = () => {
    animation?.cancel()
    if (reduced.matches) return
    animation = content.animate([{ opacity: .55, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 200, easing: 'cubic-bezier(.16, 1, .3, 1)' })
  }
  viewButtons.forEach(button => button.addEventListener('click', () => {
    if (root.dataset.mode === button.dataset.bookmarkView) return
    setMode(button.dataset.bookmarkView!)
    transition()
    try { localStorage.setItem('bookmark-view', root.dataset.mode!) } catch { /* Use the default when storage is unavailable. */ }
  }, { signal: events.signal }))
  const revealAnchor = (hash: string) => {
    let id: string
    try { id = decodeURIComponent(hash.replace(/^#/, '')) } catch { return }
    const target = id ? document.getElementById(id) : null
    if (!target || !content.contains(target)) return
    const section = target.closest<HTMLElement>('.bookmark-group')
    if (!section) return
    animation?.cancel()
    return target
  }
  document.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element).closest<HTMLAnchorElement>('#sidebar .toc-link, .bookmark-content .anchor')
    const target = link?.hash ? revealAnchor(link.hash) : undefined
    if (!target) return
    event.preventDefault()
    event.stopImmediatePropagation()
    target.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'instant' : 'smooth' })
  }, { capture: true, signal: events.signal })
  const followHash = () => {
    const target = revealAnchor(location.hash)
    if (target) {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
    }
  }
  window.addEventListener('hashchange', followHash, { signal: events.signal })
  let mode = 'cards'
  try { mode = localStorage.getItem('bookmark-view') || mode } catch { /* Keep the default. */ }
  setMode(mode)
  toolbar.hidden = false
  followHash()
  cleanup = () => {
    events.abort()
    animation?.cancel()
    cancelAnimationFrame(frame)
  }
}
