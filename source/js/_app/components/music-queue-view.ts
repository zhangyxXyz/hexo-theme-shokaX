import { requestMusicRow, releaseMusicRow } from './music-queue'

let cancelFocus = () => {}
// Called only when opening the panel or changing the selected song. Wait for
// Vue/tab transitions, scroll only the list, and let a user's gesture cancel.
export function focusMusicRow(key?: string) {
  cancelFocus()
  const panel = document.getElementById('MusicPlayerRoot')
  if (!panel || !key) return
  let frame = 0
  const deadline = performance.now() + 1000
  const events = ['wheel', 'pointerdown', 'touchstart', 'keydown']
  const cancel = () => {
    cancelAnimationFrame(frame)
    events.forEach(event => panel.removeEventListener(event, cancel))
    if (cancelFocus === cancel) cancelFocus = () => {}
  }
  cancelFocus = cancel
  events.forEach(event => panel.addEventListener(event, cancel, { passive: true }))
  const locate = () => {
    const row = [...panel.querySelectorAll<HTMLElement>('li[data-music-key]')].find(row => row.dataset.musicKey === key)
    const root = row?.closest<HTMLElement>('ol, ul')
    const bounds = root?.getBoundingClientRect(), rect = row?.getBoundingClientRect()
    if (root && bounds?.height && rect?.height) {
      if (rect.top < bounds.top || rect.bottom > bounds.bottom) {
        root.scrollTop += rect.top - bounds.top - (root.clientHeight - rect.height) / 2
      }
      cancel()
    } else if (performance.now() < deadline) frame = requestAnimationFrame(locate)
    else cancel()
  }
  frame = requestAnimationFrame(locate)
}

let initialized = false
export function initMusicQueueViewport() {
  const panel = document.getElementById('MusicPlayerRoot')
  if (!panel || initialized) return
  initialized = true
  const show = document.getElementById('showBtn')
  let root: HTMLElement | undefined, observer: IntersectionObserver | undefined, margin = 0
  const observed = new Set<HTMLElement>()
  let demanded = new Map<string, { playlist: string; source: string }>()
  let frame = 0
  const sync = () => {
    frame = 0
    const rows = [...panel.querySelectorAll<HTMLElement>('li[data-music-source]')]
    const nextRoot = rows[0]?.closest('ol, ul') as HTMLElement | undefined
    const nextMargin = (rows[0]?.getBoundingClientRect().height || 32) * 3
    if (nextRoot !== root || nextMargin !== margin) {
      observer?.disconnect()
      root?.removeEventListener('scroll', schedule)
      if (root) resizeObserver.unobserve(root)
      observed.clear()
      root = nextRoot
      margin = nextMargin
      // Observer entries are notifications only: an entry can be stale by the
      // time a playlist insertion or scroll-anchor correction has completed.
      observer = root ? new IntersectionObserver(schedule, { root, rootMargin: `${margin}px 0px`, threshold: [0, .001] }) : undefined
      root?.addEventListener('scroll', schedule, { passive: true })
      if (root) resizeObserver.observe(root)
    }
    for (const row of observed) {
      if (!row.isConnected) { observer?.unobserve(row); observed.delete(row) }
    }
    for (const row of rows) {
      if (!observed.has(row)) { observed.add(row); observer?.observe(row) }
    }
    const bounds = root?.getBoundingClientRect()
    const nextDemand = new Map<string, { playlist: string; source: string }>()
    if (bounds && bounds.height > 0 && show?.getAttribute('aria-expanded') !== 'false') {
      for (const row of rows) {
        const rect = row.getBoundingClientRect()
        if (rect.height <= 0 || rect.bottom <= bounds.top - margin || rect.top >= bounds.bottom + margin) continue
        const playlist = row.dataset.musicPlaylist!, source = row.dataset.musicSource!
        nextDemand.set(`${playlist}/${source}`, { playlist, source })
      }
    }
    // Reconcile by source identity, not removed DOM nodes. Vue may replace a
    // placeholder while another observer still has an exit entry queued for it.
    for (const [key, item] of demanded) {
      if (!nextDemand.has(key)) releaseMusicRow(item.playlist, item.source)
    }
    demanded = nextDemand
    for (const item of demanded.values()) requestMusicRow(item.playlist, item.source)
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(sync) }
  const resizeObserver = new ResizeObserver(schedule)
  new MutationObserver(schedule).observe(panel, { childList: true, subtree: true })
  if (show) new MutationObserver(schedule).observe(show, { attributes: true, attributeFilter: ['aria-expanded'] })
  window.addEventListener('resize', schedule)
  sync()
}

// A playlist source can replace one placeholder with many songs above the
// viewport. Preserve the first visible stable row, including its pixel offset.
export function preserveMusicListScroll() {
  const rows = [...document.querySelectorAll<HTMLElement>('#MusicPlayerRoot li[data-music-key]')]
  const root = rows[0]?.closest('ol, ul')
  const top = root?.getBoundingClientRect().top ?? 0
  const anchor = rows.find(row => row.getBoundingClientRect().bottom > top)
  const key = anchor?.dataset.musicKey
  const offset = anchor?.getBoundingClientRect().top ?? 0
  return () => {
    if (!root?.isConnected || !key) return
    const current = [...root.querySelectorAll<HTMLElement>('li[data-music-key]')].find(row => row.dataset.musicKey === key)
    if (current) root.scrollTop += current.getBoundingClientRect().top - offset
  }
}
