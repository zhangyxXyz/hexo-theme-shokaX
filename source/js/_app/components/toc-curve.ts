let cleanup: (() => void) | undefined
let instance = 0

// Keep native TOC navigation, but highlight visible headings rather than read progress.
export function refreshTocCurve() {
  cleanup?.()
  cleanup = undefined
  const panel = document.querySelector<HTMLElement>('.contents.toc-curve')
  const list = panel?.querySelector<HTMLElement>(':scope > .toc')
  if (!panel || !list) return
  const links = Array.from(list.querySelectorAll<HTMLAnchorElement>('.toc-link'))
  if (!links.length) return
  const headings = links.map(link => {
    try {
      return document.getElementById(decodeURIComponent(link.hash.slice(1)))
    } catch { return null }
  })
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.classList.add('toc-curve-rail')
  svg.setAttribute('aria-hidden', 'true')
  const rail = document.createElementNS(ns, 'path')
  const progress = document.createElementNS(ns, 'path')
  progress.classList.add('toc-curve-progress')
  const defs = document.createElementNS(ns, 'defs')
  const clip = document.createElementNS(ns, 'clipPath')
  clip.id = `toc-curve-window-${++instance}`
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse')
  const windowRect = document.createElementNS(ns, 'rect')
  windowRect.classList.add('toc-curve-window')
  clip.append(windowRect)
  defs.append(clip)
  progress.setAttribute('clip-path', `url(#${clip.id})`)
  const dot = document.createElementNS(ns, 'circle')
  dot.setAttribute('r', '2.5')
  svg.append(defs, rail, progress, dot)
  list.prepend(svg)
  let frame = 0
  const branches = Array.from(list.querySelectorAll<HTMLElement>('.toc-child'))
  const expanded = new Map<HTMLElement, boolean>()
  const animations = new Map<HTMLElement, Animation>()

  const syncBranches = (visible: number[]) => {
    const owners = new Set<Element>()
    for (const index of visible) {
      let item = links[index].closest('.toc-item')
      while (item) {
        owners.add(item)
        item = item.parentElement?.closest('.toc-item') || null
      }
    }
    const changes: { branch: HTMLElement, from: number, initial: boolean }[] = []
    for (const branch of branches) {
      const open = owners.has(branch.parentElement)
      if (expanded.get(branch) === open) continue
      const initial = !expanded.has(branch)
      const from = branch.getBoundingClientRect().height
      const previous = animations.get(branch)
      if (previous) { previous.onfinish = null; previous.cancel() }
      animations.delete(branch)
      expanded.set(branch, open)
      branch.inert = !open
      branch.style.height = open ? 'auto' : '0px'
      changes.push({ branch, from, initial })
    }
    // Measure all final heights before animating any nested branch.
    const measured = changes.map(change => ({ ...change, to: change.branch.getBoundingClientRect().height }))
    for (const { branch, from, initial, to } of measured) {
      if (!initial && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const animation = branch.animate([{ height: `${from}px` }, { height: `${to}px` }], {
          duration: 220, easing: 'cubic-bezier(.22,.68,0,1)'
        })
        animations.set(branch, animation)
        animation.onfinish = () => {
          animations.delete(branch)
          schedule()
        }
      }
    }
  }

  const draw = () => {
    frame = 0
    if (!list.offsetWidth) return
    const visible: number[] = []
    let nearest = -1
    let distance = Infinity
    headings.forEach((heading, index) => {
      if (!heading || !heading.getClientRects().length) return
      const rect = heading.getBoundingClientRect()
      if (rect.bottom > 0 && rect.top < window.innerHeight) visible.push(index)
      if (Math.abs(rect.top) < distance) {
        nearest = index
        distance = Math.abs(rect.top)
      }
    })
    if (!visible.length && nearest >= 0) visible.push(nearest)
    syncBranches(visible)
    const root = list.getBoundingClientRect()
    const points = links.map((link, index) => {
      const rect = link.getBoundingClientRect()
      let top = rect.top
      let bottom = rect.bottom
      let parent = link.parentElement?.parentElement
      while (parent && parent !== list) {
        if (parent.classList.contains('toc-child')) {
          const clipRect = parent.getBoundingClientRect()
          top = Math.max(top, clipRect.top)
          bottom = Math.min(bottom, clipRect.bottom)
        }
        parent = parent.parentElement
      }
      return { index, x: rect.left - root.left + 9, top: top - root.top, bottom: bottom - root.top }
    }).filter(point => point.bottom - point.top > 16)
    if (!points.length) return
    svg.setAttribute('width', String(root.width))
    svg.setAttribute('height', String(root.height))
    let d = `M ${points[0].x} ${points[0].top + 8}`
    points.forEach((point, index) => {
      if (index) {
        const prev = points[index - 1]
        if (prev.x !== point.x) {
          const middle = (prev.bottom + point.top) / 2
          d += ` C ${prev.x} ${middle}, ${point.x} ${middle}, ${point.x} ${point.top + 8}`
        } else d += ` L ${point.x} ${point.top + 8}`
      }
      d += ` L ${point.x} ${point.bottom - 8}`
    })
    rail.setAttribute('d', d)
    progress.setAttribute('d', d)
    // During expansion, map a clipped heading to its currently visible parent.
    const displayed = new Set(points.map(point => point.index))
    const highlighted = new Set<number>()
    for (const index of visible) {
      let link: Element | null = links[index]
      while (link) {
        const mapped = links.indexOf(link as HTMLAnchorElement)
        if (displayed.has(mapped)) {
          highlighted.add(mapped)
          break
        }
        link = link.parentElement?.parentElement?.closest('.toc-item')?.querySelector(':scope > .toc-link') || null
      }
    }
    const activePoints = points.filter(point => highlighted.has(point.index))
    links.forEach((link, index) => {
      link.dataset.tocVisible = String(highlighted.has(index))
      if (index === activePoints[0]?.index) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
    })
    const first = activePoints[0]
    const last = activePoints[activePoints.length - 1]
    progress.style.display = dot.style.display = first ? '' : 'none'
    if (first) {
      windowRect.setAttribute('width', String(root.width))
      windowRect.style.y = `${first.top + 8}px`
      windowRect.style.height = `${Math.max(0, last.bottom - first.top - 16)}px`
      dot.style.cx = `${first.x}px`
      dot.style.cy = `${first.top + 8}px`
    }
    // Keep the rail attached to the animated layout, not its final geometry.
    if (animations.size) schedule()
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(draw) }
  const mutation = new MutationObserver(schedule)
  mutation.observe(panel, { attributes: true, attributeFilter: ['class'], subtree: true })
  const resize = new ResizeObserver(schedule)
  resize.observe(list)
  const article = document.querySelector('.post.block')
  if (article) resize.observe(article)
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  schedule()
  cleanup = () => {
    mutation.disconnect()
    resize.disconnect()
    window.removeEventListener('scroll', schedule)
    window.removeEventListener('resize', schedule)
    cancelAnimationFrame(frame)
    animations.forEach(animation => { animation.onfinish = null; animation.cancel() })
    branches.forEach(branch => { branch.style.height = ''; branch.inert = false })
    links.forEach(link => {
      link.removeAttribute('aria-current')
      delete link.dataset.tocVisible
    })
    svg.remove()
  }
}
