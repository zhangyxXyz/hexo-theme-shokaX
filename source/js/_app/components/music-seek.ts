import { subscribeMusicState, type MusicPlaybackState } from './music-state'
import { cancelMusicRestart } from './music-source'

export function formatMusicTime(seconds: number) {
  const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}

export function musicSeekTime(x: number, left: number, width: number, duration: number) {
  if (![x, left, width, duration].every(Number.isFinite) || width <= 0 || duration <= 0) return null
  return Math.min(1, Math.max(0, (x - left) / width)) * duration
}

export function seekMusicAudio(audio: HTMLAudioElement | null, url: string | undefined, seconds: number, update: (time: number) => void) {
  if (!audio || !url || audio.currentSrc !== url || audio.readyState < 1 || !Number.isFinite(seconds)
    || !Number.isFinite(audio.duration) || audio.duration <= 0) return false
  const time = Math.min(audio.duration, Math.max(0, seconds))
  cancelMusicRestart(audio)
  try { audio.currentTime = time } catch { return false }
  update(time)
  return true
}

let controller: ReturnType<typeof createMusicSeek> | undefined
export function initMusicSeek() { controller ??= createMusicSeek() }

export function createMusicSeek() {
  const events = new AbortController()
  let state: MusicPlaybackState = { time: 0, playing: false, panelOpen: false }
  let root: HTMLElement | null = null
  let row: HTMLElement | null = null
  let queued = false
  let destroyed = false
  let drag: { row: HTMLElement; pointer: number; song: MusicPlaybackState['song']; time: number } | undefined
  let fill: { row: HTMLElement; time: number } | undefined
  let handled: { row: HTMLElement; until: number } | undefined
  const tip = document.createElement('div')
  tip.className = 'theme-tooltip music-seek-tooltip'
  tip.setAttribute('aria-hidden', 'true')
  tip.hidden = true
  document.body.append(tip)
  const duration = () => Number.isFinite(state.duration) && state.duration! > 0 ? state.duration! : 0
  // A class mutation can notify MutationObserver even when the class is absent.
  // Keep cleanup idempotent when an unloaded/current row has no seek duration.
  const removeClass = (element: HTMLElement | null | undefined, name: string) => {
    if (element?.classList.contains(name)) element.classList.remove(name)
  }
  const holdFill = (element: HTMLElement, time: number) => {
    fill = { row: element, time }
    element.style.setProperty('--music-seek-fill', `${time / duration() * 100}%`)
    if (!element.classList.contains('music-seeking')) element.classList.add('music-seeking')
  }
  const clearFill = () => {
    if (!fill) return
    removeClass(fill.row, 'music-seeking')
    fill.row.style.removeProperty('--music-seek-fill')
    fill = undefined
    schedule()
  }
  const clearPreview = () => {
    tip.hidden = true
    removeClass(row, 'music-seek-hover')
    row?.style.removeProperty('--music-seek-target')
  }
  const cancelDrag = (keepFill = false) => {
    const previous = drag
    drag = undefined
    if (previous) handled = { row: previous.row, until: performance.now() + 500 }
    if (!keepFill) clearFill()
    if (previous?.row.hasPointerCapture(previous.pointer)) previous.row.releasePointerCapture(previous.pointer)
    clearPreview()
    if (previous) schedule()
  }
  const restore = () => {
    if (!row) return
    row.setAttribute('role', 'button')
    for (const name of ['aria-label', 'aria-valuemin', 'aria-valuemax', 'aria-valuenow', 'aria-valuetext', 'aria-orientation']) row.removeAttribute(name)
    removeClass(row, 'music-seek-hover')
    removeClass(row, 'music-seeking')
    row.style.removeProperty('--music-seek-target')
    row.style.removeProperty('--music-seek-fill')
  }
  const syncRow = () => {
    queued = false
    if (destroyed) return
    const next = root?.querySelector<HTMLElement>('li.current') ?? null
    if (row !== next) { cancelDrag(); restore(); row = next }
    if (!row) return
    if (!duration() || !state.seek) { cancelDrag(); restore(); return }
    const time = fill?.time ?? state.time
    row.setAttribute('role', 'slider')
    row.setAttribute('aria-orientation', 'horizontal')
    row.setAttribute('aria-label', `${document.getElementById('player')?.dataset.seek ?? ''} · ${state.song?.name ?? ''}`)
    row.setAttribute('aria-valuemin', '0')
    row.setAttribute('aria-valuemax', String(Math.floor(duration())))
    row.setAttribute('aria-valuenow', String(Math.floor(time)))
    row.setAttribute('aria-valuetext', `${formatMusicTime(time)} / ${formatMusicTime(duration())}`)
  }
  const schedule = () => { if (!queued && !destroyed) { queued = true; queueMicrotask(syncRow) } }
  const observer = new MutationObserver(() => {
    if (!root) {
      root = document.getElementById('MusicPlayerRoot')
      if (root) { observer.disconnect(); observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }) }
    }
    schedule()
  })
  root = document.getElementById('MusicPlayerRoot')
  observer.observe(root ?? document.body, root
    ? { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }
    : { childList: true, subtree: true })
  const unsubscribe = subscribeMusicState(next => {
    if (drag && (drag.song !== next.song || !next.panelOpen)) cancelDrag()
    if (!next.panelOpen || next.song !== state.song) { clearFill(); clearPreview() }
    state = next
    schedule()
  })
  const target = (event: Event) => {
    const element = event.target instanceof Element ? event.target.closest<HTMLElement>('#MusicPlayerRoot li.current') : null
    return element && state.panelOpen && duration() && state.seek ? element : null
  }
  const preview = (element: HTMLElement, x: number) => {
    const box = element.getBoundingClientRect()
    const time = musicSeekTime(x, box.left, box.width, duration())
    if (time === null) return null
    element.classList.add('music-seek-hover')
    element.style.setProperty('--music-seek-target', `${time / duration() * 100}%`)
    tip.textContent = `${formatMusicTime(time)} / ${formatMusicTime(duration())}`
    tip.hidden = false
    tip.style.left = `${Math.max(8, Math.min(x - tip.offsetWidth / 2, innerWidth - tip.offsetWidth - 8))}px`
    const above = box.top - tip.offsetHeight - 8
    tip.style.top = `${Math.max(8, Math.min(above >= 8 ? above : box.bottom + 8, innerHeight - tip.offsetHeight - 8))}px`
    return time
  }
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return
    clearFill()
    const element = target(event)
    if (!element) return
    const time = preview(element, event.clientX)
    if (time === null) return
    event.preventDefault()
    event.stopImmediatePropagation()
    cancelDrag()
    preview(element, event.clientX)
    drag = { row: element, pointer: event.pointerId, song: state.song, time }
    handled = { row: element, until: Infinity }
    holdFill(element, time)
    element.focus({ preventScroll: true })
    element.setPointerCapture(event.pointerId)
    syncRow()
  }, { capture: true, signal: events.signal })
  document.addEventListener('pointermove', event => {
    if (drag && drag.pointer !== event.pointerId) return
    const element = drag?.row ?? target(event)
    if (!element || (!drag && event.pointerType === 'touch')) return
    const time = preview(element, event.clientX)
    if (drag && time !== null) {
      drag.time = time; holdFill(element, time); syncRow()
    }
  }, { capture: true, signal: events.signal })
  document.addEventListener('pointerup', event => {
    if (!drag || event.pointerId !== drag.pointer) return
    const pending = drag
    handled = { row: pending.row, until: performance.now() + 500 }
    const time = preview(pending.row, event.clientX) ?? pending.time
    event.preventDefault()
    event.stopImmediatePropagation()
    holdFill(pending.row, time)
    const committedFill = fill
    cancelDrag(true)
    const commit = () => {
      if (!destroyed && state.panelOpen && pending.song === state.song && state.seek?.(time)) {
        state = { ...state, time }; syncRow()
        // Keep the target visible until Nyx has rendered the committed clock.
        // Releasing before the render briefly exposed the previous width.
        queueMicrotask(() => { if (fill === committedFill) clearFill() })
      } else if (fill === committedFill) clearFill()
    }
    commit()
  }, { capture: true, signal: events.signal })
  for (const type of ['pointercancel', 'lostpointercapture'] as const) {
    document.addEventListener(type, event => { if (drag?.pointer === event.pointerId) cancelDrag() }, { capture: true, signal: events.signal })
  }
  document.addEventListener('pointerout', event => {
    if (!drag && target(event) && !(event.relatedTarget instanceof Node && row?.contains(event.relatedTarget))) clearPreview()
  }, { signal: events.signal })
  // A loaded current row is a progress slider, including repeated clicks.
  // Other rows keep Nyx's double-click activation from the beginning.
  for (const type of ['click', 'dblclick']) document.addEventListener(type, event => {
    if (target(event) || (handled && performance.now() < handled.until && event.target instanceof Node && handled.row.contains(event.target))) {
      event.preventDefault(); event.stopImmediatePropagation()
    }
  }, { capture: true, signal: events.signal })
  document.addEventListener('keydown', event => {
    if (!target(event)) return
    clearFill()
    if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); cancelDrag(); return }
    const commands: Record<string, number> = { ArrowLeft: state.time - 5, ArrowDown: state.time - 5, ArrowRight: state.time + 5, ArrowUp: state.time + 5, Home: 0, End: duration() }
    if (event.key in commands) {
      event.preventDefault(); event.stopImmediatePropagation()
      cancelDrag()
      const time = Math.max(0, Math.min(duration(), commands[event.key]))
      if (state.seek?.(time)) { state = { ...state, time }; syncRow() }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); event.stopImmediatePropagation(); cancelDrag()
    }
  }, { capture: true, signal: events.signal })
  const cancelInteraction = () => { cancelDrag() }
  window.addEventListener('blur', cancelInteraction, { signal: events.signal })
  window.addEventListener('resize', cancelInteraction, { signal: events.signal })
  window.addEventListener('scroll', cancelInteraction, { capture: true, passive: true, signal: events.signal })
  window.addEventListener('pagehide', cancelInteraction, { signal: events.signal })
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancelInteraction() }, { signal: events.signal })
  return { destroy() { destroyed = true; cancelInteraction(); restore(); unsubscribe(); observer.disconnect(); events.abort(); tip.remove() } }
}
