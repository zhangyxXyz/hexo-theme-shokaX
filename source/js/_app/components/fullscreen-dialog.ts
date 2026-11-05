import { openedByPointer, restoreModalFocus } from './input-modality'

/**
 * Moves `element` into a modal dialog until the returned close function runs
 * (Escape also closes it), then puts it back and restores focus.
 */
export function openFullscreen(element: HTMLElement, className: string, label: string, onClose: () => void, signal?: AbortSignal) {
  const pointerOpened = openedByPointer()
  const focusTarget = document.activeElement as HTMLElement | null
  const dialog = document.createElement('dialog')
  dialog.className = className
  dialog.setAttribute('aria-label', label)
  const placeholder = document.createComment(className)
  element.replaceWith(placeholder)
  dialog.append(element)
  document.body.append(dialog)
  const previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    dialog.close()
    placeholder.replaceWith(element)
    dialog.remove()
    document.body.style.overflow = previousOverflow
    onClose()
    if (!signal?.aborted) restoreModalFocus(focusTarget, pointerOpened)
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  dialog.showModal()
  return close
}

/** Swaps a server-rendered fullscreen button between its enter and `data-exit-label` states. */
export function setFullscreenButton(button: HTMLButtonElement | null, open: boolean) {
  if (!button) return
  button.dataset.enterLabel ??= button.getAttribute('aria-label') || ''
  const value = open ? button.dataset.exitLabel || button.dataset.enterLabel : button.dataset.enterLabel
  button.title = value
  button.setAttribute('aria-label', value)
  button.querySelector('i')?.setAttribute('class', `ic i-${open ? 'compress' : 'expand'}`)
}
