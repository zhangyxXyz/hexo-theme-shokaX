import { bookmarkSearchIndex, matchesBookmark } from './bookmark-search'

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
  let revision = 0
  let timer: ReturnType<typeof setTimeout>
  let engine: Promise<any> | undefined
  const loadSearch = () => engine ??= import(/* @vite-ignore */ root.dataset.searchBundle!).catch(error => {
    engine = undefined
    throw error
  })

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
  const input = root.querySelector<HTMLInputElement>('.bookmark-search-input')!
  const clear = root.querySelector<HTMLButtonElement>('.bookmark-search-clear')!
  const empty = root.querySelector<HTMLElement>('.bookmark-empty')!
  const headingText = (heading: Element | null) => {
    const copy = heading?.cloneNode(true) as HTMLElement | undefined
    copy?.querySelectorAll('.bookmark-group-count, .anchor').forEach(node => node.remove())
    return copy?.textContent || ''
  }
  const cards = Array.from(content.querySelectorAll<HTMLElement>('.bookmark-card')).map(card => ({
    card,
    url: card.querySelector<HTMLAnchorElement>('a.title')?.href || '',
    index: bookmarkSearchIndex([
      card.querySelector('.title')?.textContent || '',
      card.querySelector('.desc')?.textContent || '',
      card.querySelector<HTMLAnchorElement>('a.title')?.href || '',
      card.dataset.searchKeywords || '',
      headingText(card.closest('.bookmark-group')?.querySelector('.bookmark-group-heading') || null),
      headingText(card.closest('.bookmark-subgroup')?.querySelector('.bookmark-subgroup-heading') || null)
    ])
  }))
  const groups = Array.from(content.querySelectorAll<HTMLElement>('.bookmark-group, .bookmark-subgroup'))
  const renderResults = (query: string, urls?: Set<string>, fallback = false) => {
    root.dataset.searchState = !query ? 'idle' : urls ? 'indexed' : fallback ? 'fallback' : 'fuzzy'
    let count = 0
    cards.forEach(({ card, index, url }) => {
      card.hidden = urls ? !urls.has(url) : !matchesBookmark(index, query)
      if (!card.hidden) count++
    })
    groups.forEach(group => {
      const visible = group.querySelectorAll('.bookmark-card:not([hidden])').length
      group.hidden = visible === 0
      const badge = group.querySelector('.bookmark-group-count')
      if (badge) badge.textContent = String(visible)
    })
    status.textContent = (query ? root.dataset.resultsLabel || '%s / %s' : root.dataset.countLabel || '%s')
      .replace('%s', String(count)).replace('%s', String(cards.length))
    if (fallback) status.textContent += ` · ${root.dataset.fallbackLabel || ''}`
    content.setAttribute('aria-busy', 'false')
    clear.hidden = !input.value
    empty.hidden = count !== 0
  }
  const filter = () => {
    clearTimeout(timer)
    const token = ++revision
    const query = input.value.normalize('NFKC').trim()
    clear.hidden = !input.value
    if (!query) { renderResults(''); return }
    root.dataset.searchState = 'loading'
    content.setAttribute('aria-busy', 'true')
    status.textContent = root.dataset.loadingLabel || ''
    empty.hidden = true
    timer = setTimeout(async () => {
      try {
        const api = await loadSearch()
        const found = await api.search(query, { filters: { page: root.dataset.searchPage } })
        if (token !== revision) return
        const data = await Promise.all(found.results.map((result: { data: () => Promise<any> }) => result.data()))
        if (token !== revision) return
        const urls = new Set<string>(data.map(item => new URL(item.meta.bookmarkUrl, location.href).href))
        // Supplement zero-result queries with spelling tolerance, never replace indexed hits.
        renderResults(query, urls.size ? urls : undefined)
      } catch {
        if (token === revision) renderResults(query, undefined, true)
      }
    }, 180)
  }
  const resetSearch = () => {
    input.value = ''
    filter()
  }
  input.addEventListener('input', event => {
    if (!(event as InputEvent).isComposing) filter()
  }, { signal: events.signal })
  input.addEventListener('compositionstart', () => {
    clearTimeout(timer)
    revision++
  }, { signal: events.signal })
  input.addEventListener('compositionend', filter, { signal: events.signal })
  input.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.isComposing || !input.value) return
    event.preventDefault()
    event.stopPropagation()
    resetSearch()
  }, { signal: events.signal })
  clear.addEventListener('click', () => { resetSearch(); input.focus() }, { signal: events.signal })
  root.querySelector('.bookmark-search')?.addEventListener('submit', event => event.preventDefault(), { signal: events.signal })
  filter()
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
  }, { signal: events.signal }))
  const revealAnchor = (hash: string) => {
    let id: string
    try { id = decodeURIComponent(hash.replace(/^#/, '')) } catch { return }
    const target = id ? document.getElementById(id) : null
    if (!target || !content.contains(target)) return
    const section = target.closest<HTMLElement>('.bookmark-group')
    if (!section) return
    if (target.closest('[hidden]')) resetSearch()
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
  setMode('axis')
  toolbar.hidden = false
  followHash()
  cleanup = () => {
    revision++
    clearTimeout(timer)
    events.abort()
    animation?.cancel()
    cancelAnimationFrame(frame)
  }
}
