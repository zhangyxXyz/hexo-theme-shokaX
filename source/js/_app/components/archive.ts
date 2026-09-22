import { setLocalHash, siteNavHeight } from '../globals/globalVars'

type ArchiveMode = 'tree' | 'classic'
type DisclosureMotion = {
  open: boolean
  finish: (restoreFocus?: boolean) => void
  cancel: () => void
}

const storageKey = 'shokax.archive.mode'
let cleanup: (() => void) | undefined

/** Keep both archive views navigable while enhancing the server-rendered tree. */
export const refreshArchive = () => {
  cleanup?.()
  cleanup = undefined
  const root = document.querySelector<HTMLElement>('.archive-page')
  if (!root) return

  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-archive-panel]'))
  const available = (value: string | undefined): value is ArchiveMode =>
    (value === 'tree' || value === 'classic') && panels.some(panel => panel.dataset.archivePanel === value)
  const defaultMode = available(root.dataset.defaultMode) ? root.dataset.defaultMode : available('tree') ? 'tree' : 'classic'
  if (!available(defaultMode)) return

  const switchable = root.dataset.switchable !== 'false'
  const controls = root.querySelector<HTMLElement>('.archive-view-controls')
  const toolbar = controls || root.querySelector<HTMLElement>('.archive-heading')
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-archive-mode]'))
  const tree = root.querySelector<HTMLElement>('.archive-tree-panel')
  const tools = root.querySelector<HTMLElement>('[data-archive-tree-tools]')
  const expand = root.querySelector<HTMLButtonElement>('[data-archive-expand]')
  const years = Array.from(root.querySelectorAll<HTMLDetailsElement>('details.archive-year'))
  const disclosures = Array.from(root.querySelectorAll<HTMLDetailsElement>('details.archive-year, details.archive-month-more'))
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('.archive-year-nav [data-archive-year]'))
  const nav = root.querySelector<HTMLElement>('.archive-year-nav')
  const rail = nav?.closest<HTMLElement>('.archive-year-rail')
  const railToggle = root.querySelector<HTMLButtonElement>('[data-archive-rail-toggle]')
  const currentYear = root.querySelector<HTMLElement>('[data-archive-current-year]')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const events = new AbortController()
  const options = { signal: events.signal }
  const motions = new Map<HTMLDetailsElement, DisclosureMotion>()
  const resetMonthPages: (() => void)[] = []
  const resizeMonthPages: (() => void)[] = []
  let mode: ArchiveMode = defaultMode
  let frame = 0
  let anchorFrame = 0
  let activeYear = ''
  let railExpanded = false
  let railMotion: { finish: () => void, cancel: () => void } | undefined
  let pickerRight = ''
  let pickerOffset = 0
  let pickerNavMaxHeight = ''

  const currentHashYear = () => {
    try {
      const id = decodeURIComponent(location.hash.slice(1))
      return years.find(year => year.id === id)
    } catch { return undefined }
  }

  const scrollOffset = () => Math.max(70, siteNavHeight || 0) + 12

  const positionPicker = () => {
    if (!toolbar || !rail || mode !== 'tree' || events.signal.aborted || !root.isConnected) return
    const rootStyle = getComputedStyle(root)
    // The entrance transform temporarily makes the archive the fixed-position
    // containing block. Reveal the picker only after viewport positioning is valid.
    if (!document.body.classList.contains('loaded') || rootStyle.transform !== 'none') {
      rail.dataset.positioned = 'false'
      return
    }
    const minimumInset = window.innerWidth <= 767 ? 48 : 0
    const inset = Math.max(minimumInset, document.documentElement.clientWidth - toolbar.getBoundingClientRect().right)
    const next = `${inset}px`
    if (pickerRight !== next) {
      pickerRight = next
      root.style.setProperty('--archive-picker-right', next)
    }

    const bounds = root.getBoundingClientRect()
    const initialRect = rail.getBoundingClientRect()
    if (!bounds.height || !initialRect.height) return
    const topInset = Math.max(12, parseFloat(rootStyle.paddingTop) || 0)
    const bottomInset = Math.max(12, parseFloat(rootStyle.paddingBottom) || 0)
    const contentTop = bounds.top + topInset
    const contentBottom = bounds.bottom - bottomInset
    // Keep an expanded index inside even a short archive. The remaining shell
    // consists of the toggle, padding and borders outside the scrollable nav.
    const shellHeight = initialRect.height - (nav?.getBoundingClientRect().height || 0)
    const availableNavHeight = contentBottom - contentTop - shellHeight
    const maxHeight = `${Math.max(0, Math.floor(availableNavHeight * 1000) / 1000)}px`
    if (pickerNavMaxHeight !== maxHeight) {
      pickerNavMaxHeight = maxHeight
      root.style.setProperty('--archive-picker-nav-max-height', maxHeight)
    }
    const rect = rail.getBoundingClientRect()
    // CSS owns the viewport bottom/safe-area gap. Subtract our previous offset
    // to recover that default position before clamping it to the archive box.
    const baselineTop = rect.top - pickerOffset
    const top = Math.max(contentTop, Math.min(baselineTop, contentBottom - rect.height))
    const offset = Math.round((top - baselineTop) * 1000) / 1000
    if (pickerOffset !== offset) {
      pickerOffset = offset
      root.style.setProperty('--archive-picker-offset-y', `${offset}px`)
    }
    rail.dataset.positioned = 'true'
  }

  const revealActiveLink = () => {
    const link = links.find(item => item.dataset.archiveYear === activeYear)
    if (!nav || !link || !railExpanded) return
    const box = link.getBoundingClientRect()
    const viewport = nav.getBoundingClientRect()
    let left = nav.scrollLeft
    let top = nav.scrollTop
    if (box.left < viewport.left || box.right > viewport.right) left += box.left - viewport.left - (viewport.width - box.width) / 2
    if (box.top < viewport.top || box.bottom > viewport.bottom) top += box.top - viewport.top - (viewport.height - box.height) / 2
    nav.scrollTo({ left, top, behavior: 'instant' })
  }

  const setRailExpanded = (expanded: boolean, animate = true) => {
    const next = Boolean(expanded && railToggle)
    const unchanged = next === railExpanded
    const visible = rail?.dataset.expanded === 'true'
    const startHeight = nav?.getBoundingClientRect().height || 0
    const style = nav && getComputedStyle(nav)
    const start = {
      height: `${startHeight}px`,
      paddingTop: visible ? style?.paddingTop || '0px' : '0px',
      paddingBottom: visible ? style?.paddingBottom || '0px' : '0px',
      opacity: visible ? style?.opacity || '1' : '0',
      transform: visible ? style?.transform || 'translateY(0)' : 'translateY(8px)'
    }
    railExpanded = next
    if (!railExpanded && nav?.contains(document.activeElement)) railToggle?.focus({ preventScroll: true })
    railToggle?.setAttribute('aria-expanded', String(railExpanded))
    if (nav) {
      nav.inert = !railExpanded
      if (!railExpanded) nav.setAttribute('aria-hidden', 'true')
      else nav.removeAttribute('aria-hidden')
    }
    if (unchanged && animate) return
    railMotion?.cancel()
    if (!rail || !nav) return
    if (!animate || reduced.matches || mode !== 'tree') {
      rail.dataset.expanded = String(next)
      if (next) revealActiveLink()
      return
    }
    // Hold the popup open while it folds down into the bottom-mounted toggle.
    rail.dataset.expanded = 'true'
    const naturalHeight = nav.getBoundingClientRect().height
    const naturalStyle = getComputedStyle(nav)
    const end = {
      height: next ? `${naturalHeight}px` : '0px',
      paddingTop: next ? naturalStyle.paddingTop : '0px',
      paddingBottom: next ? naturalStyle.paddingBottom : '0px',
      opacity: next ? '1' : '0',
      transform: next ? 'translateY(0)' : 'translateY(8px)'
    }
    if (next) revealActiveLink()
    const originalOverflow = nav.style.getPropertyValue('overflow')
    const originalOverflowPriority = nav.style.getPropertyPriority('overflow')
    nav.style.setProperty('overflow', 'hidden')
    const animation = nav.animate([start, end], { duration: 220, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' })
    const cancel = () => {
      animation.onfinish = null
      animation.cancel()
      if (originalOverflow) nav.style.setProperty('overflow', originalOverflow, originalOverflowPriority)
      else nav.style.removeProperty('overflow')
      railMotion = undefined
    }
    const finish = () => {
      rail.dataset.expanded = String(next)
      cancel()
      if (next) revealActiveLink()
    }
    railMotion = { finish, cancel }
    animation.onfinish = finish
  }

  const setActiveYear = (id: string) => {
    if (activeYear === id) return
    activeYear = id
    links.forEach(link => {
      const active = link.dataset.archiveYear === id
      link.classList.toggle('is-active', active)
      if (active) link.setAttribute('aria-current', 'location')
      else link.removeAttribute('aria-current')
      if (active && currentYear) currentYear.textContent = link.querySelector('span')?.textContent || id.replace('archive-year-', '')
    })
    revealActiveLink()
  }

  const updateActiveYear = () => {
    frame = 0
    if (mode !== 'tree' || !root.isConnected || !years.length) return
    positionPicker()
    // Include the heading's reading area so rounding or font settling after a jump
    // cannot immediately select the preceding year again.
    const threshold = scrollOffset() + 32
    let current = years[0]
    for (const year of years) {
      if (year.getBoundingClientRect().top > threshold) break
      current = year
    }
    setActiveYear(current.id)
  }

  const scheduleActiveYear = () => {
    if (!events.signal.aborted && root.isConnected && mode === 'tree' && !frame) frame = requestAnimationFrame(updateActiveYear)
  }

  const syncExpand = () => {
    if (!expand) return
    const allOpen = years.length > 0 && years.every(year => motions.get(year)?.open ?? year.open)
    const label = allOpen ? expand.dataset.collapseLabel : expand.dataset.expandLabel
    const text = expand.querySelector<HTMLElement>('[data-archive-expand-label]')
    if (text && label) text.textContent = label
    expand.setAttribute('aria-expanded', String(allOpen))
    expand.dataset.expanded = String(allOpen)
    expand.querySelector('i')?.classList.toggle('is-expanded', allOpen)
  }

  const finishMotions = (restoreFocus = true) => {
    Array.from(motions.values()).forEach(motion => motion.finish(restoreFocus))
  }

  const setDisclosure = (details: HTMLDetailsElement, open: boolean, animate = true) => {
    const running = motions.get(details)
    if ((running?.open ?? details.open) === open) {
      if (!animate) running?.finish(false)
      return
    }
    // Nested height animations must not leave a parent clipping a changed child.
    Array.from(motions.entries()).forEach(([other, motion]) => {
      if (other !== details && (details.contains(other) || other.contains(details))) motion.finish(false)
    })
    const summary = details.querySelector<HTMLElement>(':scope > summary')
    const month = details.classList.contains('archive-month-more')
    const content = details.querySelector<HTMLElement>(month ? ':scope > .archive-month-extra' : ':scope > .archive-year-body')
    const focused = document.activeElement
    const focusInside = Boolean(content?.contains(focused))
    const startHeight = details.getBoundingClientRect().height
    const contentStyle = content && getComputedStyle(content)
    const opacity = running ? contentStyle?.opacity : details.open ? '1' : '0'
    const transform = running ? contentStyle?.transform : details.open ? 'translateY(0)' : 'translateY(-10px)'
    running?.cancel()

    const focusAfterChange = () => {
      if (!root.isConnected || !summary) return
      if (!open && focusInside && (document.activeElement === document.body || content?.contains(document.activeElement))) {
        summary.focus({ preventScroll: true })
      } else if (open && month && focused === summary) {
        content?.querySelector<HTMLElement>('a[href], button:not([disabled])')?.focus({ preventScroll: true })
      }
    }

    if (!animate || reduced.matches || mode !== 'tree' || !content || !summary || !details.getClientRects().length) {
      details.open = open
      summary?.setAttribute('aria-expanded', String(open))
      focusAfterChange()
      syncExpand()
      scheduleActiveYear()
      return
    }

    const originalOverflow = details.style.getPropertyValue('overflow')
    const originalOverflowPriority = details.style.getPropertyPriority('overflow')
    const originalInert = content.inert
    details.style.setProperty('overflow', 'clip')
    details.open = open
    const endHeight = details.getBoundingClientRect().height
    // Keep content rendered until the upward collapse has completed.
    details.open = true
    details.dataset.archiveMotion = open ? 'opening' : 'closing'
    summary.setAttribute('aria-expanded', String(open))
    if (!open && focusInside && !month) summary.focus({ preventScroll: true })
    content.inert = originalInert || !open
    const duration = Math.min(400, Math.max(220, Math.abs(endHeight - startHeight) * .2 + 180))
    const timing = { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' as FillMode }
    const height = details.animate([{ height: `${startHeight}px` }, { height: `${endHeight}px` }], timing)
    const body = content.animate([
      { opacity: opacity || '0', transform: transform === 'none' ? 'translateY(0)' : transform || 'translateY(-10px)' },
      { opacity: open ? 1 : 0, transform: open ? 'translateY(0)' : 'translateY(-10px)' }
    ], timing)
    const cancel = () => {
      height.onfinish = null
      height.cancel()
      body.cancel()
      if (originalOverflow) details.style.setProperty('overflow', originalOverflow, originalOverflowPriority)
      else details.style.removeProperty('overflow')
      content.inert = originalInert
      delete details.dataset.archiveMotion
      motions.delete(details)
    }
    const finish = (restoreFocus = true) => {
      details.open = open
      cancel()
      if (restoreFocus) focusAfterChange()
      syncExpand()
      scheduleActiveYear()
    }
    motions.set(details, { open, finish, cancel })
    height.onfinish = () => finish()
    if (open) focusAfterChange()
    syncExpand()
    scheduleActiveYear()
  }

  const setMode = (next: ArchiveMode, remember = false) => {
    if (!available(next)) return
    finishMotions(false)
    setRailExpanded(false, false)
    mode = next
    root.dataset.mode = mode
    panels.forEach(panel => { panel.hidden = panel.dataset.archivePanel !== mode })
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.archiveMode === mode)))
    if (tools) tools.hidden = mode !== 'tree' || !years.length
    if (remember && switchable) {
      try { localStorage.setItem(storageKey, mode) } catch { /* Storage can be disabled. */ }
      // A previous year jump must not override a newly selected classic view on reload.
      if (mode === 'classic' && currentHashYear()) {
        const url = new URL(location.href)
        url.hash = ''
        history.replaceState(history.state, '', url)
      }
    }
    scheduleActiveYear()
  }

  const jumpToYear = (year: HTMLDetailsElement, updateHash: boolean) => {
    if (mode !== 'tree') {
      if (!switchable) return
      setMode('tree')
    }
    setDisclosure(year, true, updateHash)
    if (updateHash) {
      const url = new URL(location.href)
      url.hash = year.id
      history.replaceState(history.state, '', url)
    }
    // The shared delayed position restoration must not scroll this anchor again.
    setLocalHash(1)
    cancelAnimationFrame(anchorFrame)
    anchorFrame = requestAnimationFrame(() => {
      anchorFrame = 0
      if (!root.isConnected || mode !== 'tree') return
      const top = year.getBoundingClientRect().top + window.scrollY - scrollOffset()
      window.scrollTo({ top: Math.max(0, top), behavior: reduced.matches ? 'instant' : 'smooth' })
      setActiveYear(year.id)
    })
  }

  const followHash = () => {
    const year = currentHashYear()
    if (year) jumpToYear(year, false)
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    if (switchable && available(button.dataset.archiveMode)) setMode(button.dataset.archiveMode, true)
  }, options))

  expand?.addEventListener('click', () => {
    const open = !years.every(year => motions.get(year)?.open ?? year.open)
    years.forEach(year => setDisclosure(year, open))
    syncExpand()
    scheduleActiveYear()
  }, options)

  disclosures.forEach(details => {
    const summary = details.querySelector<HTMLElement>(':scope > summary')
    summary?.setAttribute('aria-expanded', String(details.open))
    summary?.addEventListener('click', event => {
      if (event.target instanceof Element && event.target.closest('a[href]')) return
      event.preventDefault()
      setDisclosure(details, !(motions.get(details)?.open ?? details.open))
    }, options)
    details.querySelector<HTMLButtonElement>(':scope > .archive-month-extra > [data-archive-month-collapse]')?.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      setDisclosure(details, false)
    }, options)
    details.addEventListener('toggle', () => {
      if (!motions.has(details)) summary?.setAttribute('aria-expanded', String(details.open))
      syncExpand()
      scheduleActiveYear()
    }, options)
  })

  links.forEach(link => link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const year = years.find(item => item.id === link.dataset.archiveYear)
    if (!year) return
    event.preventDefault()
    event.stopPropagation()
    setRailExpanded(false)
    jumpToYear(year, true)
  }, options))

  railToggle?.addEventListener('click', () => setRailExpanded(!railExpanded), options)
  document.addEventListener('click', event => {
    if (railExpanded && event.target instanceof Node && !rail?.contains(event.target)) setRailExpanded(false)
  }, options)
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !railExpanded) return
    event.preventDefault()
    setRailExpanded(false)
  }, options)
  reduced.addEventListener('change', () => {
    if (reduced.matches) { finishMotions(); railMotion?.finish() }
  }, options)

  root.querySelectorAll<HTMLElement>('[data-archive-month-pages]').forEach(pager => {
    const list = pager.parentElement?.querySelector<HTMLOListElement>(':scope > .archive-post-list')
    const previous = pager.querySelector<HTMLButtonElement>('[data-archive-month-prev]')
    const next = pager.querySelector<HTMLButtonElement>('[data-archive-month-next]')
    const label = pager.querySelector<HTMLElement>('[data-archive-month-page]')
    const showAll = pager.parentElement?.querySelector<HTMLButtonElement>('[data-archive-month-all]')
    if (!list || !previous || !next || !label) return
    const rows = Array.from(list.children) as HTMLElement[]
    const pageSize = 5
    const total = Math.ceil(rows.length / pageSize)
    let page = 0
    let expanded = false
    let animation: Animation | undefined
    const renderPage = (target: number, animate = true) => {
      const direction = target > page ? 1 : -1
      animation?.cancel()
      if (animate) list.style.minHeight = `${list.getBoundingClientRect().height}px`
      page = Math.max(0, Math.min(total - 1, target))
      rows.forEach((row, index) => { row.hidden = index < page * pageSize || index >= (page + 1) * pageSize })
      label.textContent = `${page + 1} / ${total}`
      previous.disabled = page === 0
      next.disabled = page === total - 1
      if (animate && !reduced.matches) {
        animation = list.animate([
          { opacity: .3, transform: `translateX(${direction * 10}px)` },
          { opacity: 1, transform: 'translateX(0)' }
        ], { duration: 200, easing: 'ease-out' })
      }
      scheduleActiveYear()
    }
    previous.addEventListener('click', () => renderPage(page - 1), options)
    next.addEventListener('click', () => renderPage(page + 1), options)
    showAll?.addEventListener('click', () => {
      expanded = !expanded
      animation?.cancel()
      list.style.removeProperty('min-height')
      pager.hidden = expanded
      showAll.setAttribute('aria-expanded', String(expanded))
      showAll.textContent = (expanded ? showAll.dataset.collapseLabel : showAll.dataset.expandLabel) || ''
      if (expanded) rows.forEach(row => { row.hidden = false })
      else {
        renderPage(page, false)
        pager.parentElement?.scrollIntoView({ block: 'start', behavior: reduced.matches ? 'instant' : 'smooth' })
      }
      if (!reduced.matches) animation = list.animate([
        { opacity: .3, transform: `translateY(${expanded ? -8 : 8}px)` },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 200, easing: 'ease-out' })
      scheduleActiveYear()
    }, options)
    pager.hidden = total <= 1
    if (showAll) showAll.hidden = total <= 1
    renderPage(0, false)
    resizeMonthPages.push(() => { animation?.cancel(); list.style.removeProperty('min-height') })
    resetMonthPages.push(() => {
      animation?.cancel()
      list.style.removeProperty('min-height')
      rows.forEach(row => { row.hidden = false })
      pager.hidden = true
      if (showAll) showAll.hidden = true
    })
  })

  window.addEventListener('scroll', scheduleActiveYear, { ...options, passive: true })
  window.addEventListener('resize', () => { finishMotions(); railMotion?.finish(); resizeMonthPages.forEach(reset => reset()); scheduleActiveYear() }, { ...options, passive: true })
  window.addEventListener('hashchange', followHash, options)
  window.addEventListener('load', scheduleActiveYear, options)
  window.addEventListener('pageshow', scheduleActiveYear, options)
  // The page entrance translates the whole archive without a resize or scroll.
  root.addEventListener('animationstart', event => {
    if (event.target === root && rail) rail.dataset.positioned = 'false'
  }, options)
  root.addEventListener('animationend', event => {
    if (event.target === root) scheduleActiveYear()
  }, options)
  root.addEventListener('animationcancel', event => {
    if (event.target === root) scheduleActiveYear()
  }, options)
  document.fonts.addEventListener('loadingdone', scheduleActiveYear, options)
  const loading = new MutationObserver(scheduleActiveYear)
  loading.observe(document.body, { attributes: true, attributeFilter: ['class'] })
  void document.fonts.ready.then(scheduleActiveYear)
  const resize = new ResizeObserver(() => {
    // ResizeObserver runs during the nav's height animation, so the fixed
    // picker remains inside the archive at every expanded or collapsed size.
    positionPicker()
    scheduleActiveYear()
  })
  resize.observe(root)
  if (tree) resize.observe(tree)
  if (rail) resize.observe(rail)
  // Fonts and header media can move every year without resizing the tree itself.
  const header = document.getElementById('header')
  if (header) resize.observe(header)

  let initialMode = defaultMode
  if (switchable) {
    try {
      const saved = localStorage.getItem(storageKey)
      if (available(saved)) initialMode = saved
    } catch { /* Fall back to the configured view when storage is unavailable. */ }
  }
  root.dataset.archiveEnhanced = 'true'
  if (controls) controls.hidden = !switchable
  syncExpand()
  setMode(initialMode)
  followHash()

  cleanup = () => {
    events.abort()
    resize.disconnect()
    loading.disconnect()
    resetMonthPages.forEach(reset => reset())
    finishMotions(false)
    railMotion?.cancel()
    cancelAnimationFrame(frame)
    cancelAnimationFrame(anchorFrame)
    delete root.dataset.archiveEnhanced
    root.style.removeProperty('--archive-picker-right')
    root.style.removeProperty('--archive-picker-offset-y')
    root.style.removeProperty('--archive-picker-nav-max-height')
    if (rail) { delete rail.dataset.expanded; delete rail.dataset.positioned }
    if (nav) { nav.inert = false; nav.removeAttribute('aria-hidden') }
    if (controls) controls.hidden = true
    if (tools) tools.hidden = true
  }
}
