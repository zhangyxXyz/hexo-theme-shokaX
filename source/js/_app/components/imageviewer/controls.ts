const controls: Record<string, { label: keyof ImageViewerLocale, icon: string }> = {
  'zoom-in': { label: 'zoomIn', icon: 'zoom-in' },
  'zoom-out': { label: 'zoomOut', icon: 'zoom-out' },
  'one-to-one': { label: 'oneToOne', icon: 'focus-center' },
  reset: { label: 'reset', icon: 'refresh' },
  'rotate-left': { label: 'rotateLeft', icon: 'rotate-left' },
  'rotate-right': { label: 'rotateRight', icon: 'rotate-right' },
  prev: { label: 'previous', icon: 'chevrons-left' },
  next: { label: 'next', icon: 'chevrons-right' },
  mix: { label: 'close', icon: 'times' }
}

export const decorateViewerControls = (root: HTMLElement, locale: ImageViewerLocale) => {
  root.querySelectorAll<HTMLElement>('[data-viewer-action]').forEach((button) => {
    const control = controls[button.dataset.viewerAction]
    if (!control) return
    button.title = locale[control.label]
    button.setAttribute('aria-label', locale[control.label])
    const icon = document.createElement('i')
    icon.className = `ic i-${control.icon}`
    icon.setAttribute('aria-hidden', 'true')
    button.replaceChildren(icon)
  })
}
