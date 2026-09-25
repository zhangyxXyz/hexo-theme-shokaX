import { subscribeMusicState } from './music-state'

let initialized = false

export function initMusicVolumeTooltip() {
  if (initialized) return
  initialized = true
  const tip = document.createElement('div')
  tip.className = 'theme-tooltip music-volume-tooltip'
  tip.setAttribute('aria-hidden', 'true')
  tip.hidden = true
  document.body.append(tip)
  let active: HTMLInputElement | null = null
  let dragging: { input: HTMLInputElement; pointer: number } | undefined
  const target = (event: Event) => event.target instanceof HTMLInputElement
    && event.target.matches('#MusicPlayerRoot .music-volume input[type="range"]') ? event.target : null
  const hide = () => { tip.hidden = true; active = null }
  const cancel = () => { dragging = undefined; hide() }
  const show = (input: HTMLInputElement, x?: number, actual = false) => {
    if (!input.isConnected) { cancel(); return }
    const box = input.getBoundingClientRect()
    // Match the native slider: the thumb center travels inside its half-width.
    const thumb = Number.parseFloat(getComputedStyle(input).getPropertyValue('--music-volume-thumb-size')) || 6
    const travel = Math.max(1, box.width - thumb)
    const percent = x === undefined || actual ? Number(input.value)
      : Math.round(Math.max(0, Math.min(1, (x - box.left - thumb / 2) / travel)) * 100)
    const point = x ?? box.left + thumb / 2 + percent / 100 * travel
    active = input
    tip.textContent = `${percent}%`
    tip.hidden = false
    tip.style.left = `${Math.max(8, Math.min(point - tip.offsetWidth / 2, innerWidth - tip.offsetWidth - 8))}px`
    tip.style.top = `${Math.max(8, box.top - tip.offsetHeight - 6)}px`
  }
  document.addEventListener('pointerover', event => {
    const input = target(event)
    if (input && event.pointerType !== 'touch') show(input, event.clientX)
  })
  document.addEventListener('pointermove', event => {
    if (dragging && event.pointerId !== dragging.pointer) return
    const input = dragging?.input ?? target(event)
    if (input && (dragging || event.pointerType !== 'touch')) show(input, event.clientX, !!dragging)
  })
  document.addEventListener('pointerdown', event => {
    const input = target(event)
    if (!input) { cancel(); return }
    if (!event.isPrimary || event.button !== 0) return
    dragging = { input, pointer: event.pointerId }
    show(input, event.clientX, true)
  })
  document.addEventListener('input', event => {
    const input = target(event)
    if (input && (input === active || input === document.activeElement)) show(input)
  })
  document.addEventListener('pointerup', event => {
    if (!dragging || dragging.pointer !== event.pointerId) return
    const input = dragging.input, box = input.getBoundingClientRect()
    dragging = undefined
    if (event.pointerType === 'touch' || event.clientX < box.left || event.clientX > box.right
      || event.clientY < box.top || event.clientY > box.bottom) hide()
    else show(input, event.clientX, true)
  })
  document.addEventListener('pointerout', event => { if (!dragging && target(event)) hide() })
  document.addEventListener('pointercancel', cancel)
  document.addEventListener('focusin', event => { const input = target(event); if (input) show(input) })
  document.addEventListener('focusout', event => { if (target(event)) cancel() })
  document.addEventListener('keydown', event => { if (event.key === 'Escape') cancel() })
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel() })
  window.addEventListener('blur', cancel)
  window.addEventListener('resize', cancel)
  window.addEventListener('scroll', cancel, { capture: true, passive: true })
  subscribeMusicState(state => { if (!state.panelOpen) cancel() })
}
