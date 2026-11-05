const KEY = 'shokax.live2d.position'
type Position = { x: number; y: number }

function read(): Position | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null')
    if (value && Number.isFinite(value.x) && Number.isFinite(value.y)) return value
  } catch {}
  return undefined
}

function write(position: Position | undefined) {
  try { position ? localStorage.setItem(KEY, JSON.stringify(position)) : localStorage.removeItem(KEY) } catch {}
}

const clamp = (value: number, max: number) => Math.min(Math.max(0, value), max)

// The widget may be dragged anywhere inside the viewport. Its place is kept as a
// fraction of the free space, so a resized window keeps the same relative corner.
export function enableLive2DDrag(widget: HTMLElement, handle: HTMLElement) {
  let position = read()
  let drag: { id: number; x: number; y: number; left: number; bottom: number; moved: boolean } | undefined
  let suppressClick = false
  const room = () => {
    const { width, height } = widget.getBoundingClientRect()
    const root = document.documentElement
    return [Math.max(0, root.clientWidth - width), Math.max(0, root.clientHeight - height)]
  }
  const apply = () => {
    if (!position || widget.style.display === 'none') return
    const [maxX, maxY] = room()
    widget.style.left = `${Math.round(position.x * maxX)}px`
    widget.style.right = 'auto'
    widget.style.bottom = `${Math.round(position.y * maxY)}px`
  }
  const reset = () => {
    position = undefined
    write(undefined)
    for (const side of ['left', 'right', 'bottom']) widget.style.removeProperty(side)
  }
  const end = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return
    if (drag.moved) {
      write(position)
      suppressClick = true
      setTimeout(() => { suppressClick = false }, 0)
    }
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId)
    widget.classList.remove('is-dragging')
    drag = undefined
  }
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return
    const rect = widget.getBoundingClientRect()
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY,
      left: rect.left, bottom: document.documentElement.clientHeight - rect.bottom, moved: false }
  })
  handle.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 5) return
      drag.moved = true
      handle.setPointerCapture(event.pointerId)
      widget.classList.add('is-dragging')
    }
    const [maxX, maxY] = room()
    position = { x: maxX ? clamp(drag.left + dx, maxX) / maxX : 0, y: maxY ? clamp(drag.bottom - dy, maxY) / maxY : 0 }
    apply()
  })
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
  handle.addEventListener('dblclick', reset)
  // Registered before the tip listeners so a finished drag does not count as a click.
  window.addEventListener('click', event => {
    if (suppressClick && event.target instanceof Node && handle.contains(event.target)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      suppressClick = false
    }
  }, true)
  window.addEventListener('resize', apply)
  apply()
  return { apply }
}
