// HTML retains every reference as the no-JavaScript fallback.
export function paginateGraphReferences(root: HTMLElement, signal: AbortSignal) {
  const cleanups: (() => void)[] = []
  root.querySelectorAll<HTMLElement>('[data-graph-reference-group]').forEach(group => {
    const footer = group.querySelector<HTMLElement>('[data-graph-reference-footer]')
    if (!footer) return
    const list = group.querySelector<HTMLElement>(':scope > ul')!
    const rows = Array.from(list.children) as HTMLElement[]
    const pager = footer.querySelector<HTMLElement>('[data-graph-pages]')!
    const previous = footer.querySelector<HTMLButtonElement>('[data-graph-page="previous"]')!
    const next = footer.querySelector<HTMLButtonElement>('[data-graph-page="next"]')!
    const label = footer.querySelector<HTMLElement>('[data-graph-page-label]')!
    const all = footer.querySelector<HTMLButtonElement>('[data-graph-all]')!
    const pageSize = 5, total = Math.ceil(rows.length / pageSize)
    let page = 0, expanded = false
    let animation: Animation | undefined
    const motion = (direction: number) => {
      animation?.cancel()
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animation = list.animate([{ opacity: .35, transform: `translateX(${direction * 8}px)` },
          { opacity: 1, transform: 'translateX(0)' }], { duration: 180, easing: 'ease-out' })
      }
    }
    const render = () => {
      rows.forEach((row, i) => { row.hidden = !expanded && (i < page * pageSize || i >= (page + 1) * pageSize) })
      label.textContent = `${page + 1} / ${total}`
      previous.disabled = page === 0
      next.disabled = page === total - 1
      pager.hidden = expanded
      all.setAttribute('aria-expanded', String(expanded))
      all.textContent = (expanded ? all.dataset.collapseLabel : all.dataset.expandLabel) || ''
    }
    const turn = (direction: number) => {
      // Keep the pager in place on a short final page.
      list.style.minHeight = `${list.getBoundingClientRect().height}px`
      page = Math.max(0, Math.min(total - 1, page + direction))
      render()
      motion(direction)
    }
    previous.addEventListener('click', () => turn(-1), { signal })
    next.addEventListener('click', () => turn(1), { signal })
    all.addEventListener('click', () => {
      expanded = !expanded
      list.style.removeProperty('min-height')
      render()
      motion(expanded ? 1 : -1)
      if (!expanded) {
        const box = group.getBoundingClientRect()
        if (box.top < 0 || box.top > innerHeight) group.scrollIntoView({ block: 'start', behavior: 'instant' })
        all.focus({ preventScroll: true })
      }
    }, { signal })
    window.addEventListener('resize', () => list.style.removeProperty('min-height'), { signal })
    footer.hidden = false
    render()
    cleanups.push(() => {
      animation?.cancel()
      list.style.removeProperty('min-height')
      rows.forEach(row => { row.hidden = false })
      footer.hidden = true
    })
  })
  return () => cleanups.forEach(cleanup => cleanup())
}
