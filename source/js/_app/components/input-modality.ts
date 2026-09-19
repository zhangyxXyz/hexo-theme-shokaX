// Escape closes a modal; it does not turn a pointer-opened modal into a keyboard one.
let pointer = false
document.addEventListener('pointerdown', () => { pointer = true }, true)
document.addEventListener('keydown', event => {
  if (event.key === 'Tab' || event.key === 'Enter' || event.key === ' ') pointer = false
}, true)
export const openedByPointer = () => pointer
export function restoreModalFocus(element: HTMLElement | null, wasPointer: boolean) {
  if (!element?.isConnected) return
  if (wasPointer) {
    if (document.activeElement === element) element.blur()
  } else element.focus({ preventScroll: true })
}
