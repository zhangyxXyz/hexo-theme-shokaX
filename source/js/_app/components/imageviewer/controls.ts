const controls: Record<string, { label: keyof ImageViewerLocale, paths: string[] }> = {
  'zoom-in': { label: 'zoomIn', paths: ['M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15', 'm16 16 5 5', 'M7 10.5h7M10.5 7v7'] },
  'zoom-out': { label: 'zoomOut', paths: ['M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15', 'm16 16 5 5', 'M7 10.5h7'] },
  'one-to-one': { label: 'oneToOne', paths: ['M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5', 'M9 9h6v6H9z'] },
  reset: { label: 'reset', paths: ['M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5', 'm7 3-4 4 4 4', 'M3 7h8a4 4 0 0 1 4 4v3'] },
  'rotate-left': { label: 'rotateLeft', paths: ['M3 9a9 9 0 1 1 0 6', 'M3 3v6h6'] },
  'rotate-right': { label: 'rotateRight', paths: ['M21 9a9 9 0 1 0 0 6', 'M21 3v6h-6'] },
  prev: { label: 'previous', paths: ['m15 5-7 7 7 7'] },
  next: { label: 'next', paths: ['m9 5 7 7-7 7'] },
  mix: { label: 'close', paths: ['m6 6 12 12M18 6 6 18'] }
}

export const decorateViewerControls = (root: HTMLElement, locale: ImageViewerLocale) => {
  root.querySelectorAll<HTMLElement>('[data-viewer-action]').forEach((button) => {
    const control = controls[button.dataset.viewerAction]
    if (!control) return
    button.title = locale[control.label]
    button.setAttribute('aria-label', locale[control.label])
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    icon.setAttribute('viewBox', '0 0 24 24')
    icon.setAttribute('aria-hidden', 'true')
    for (const d of control.paths) {
      const path = document.createElementNS(icon.namespaceURI, 'path')
      path.setAttribute('d', d)
      icon.append(path)
    }
    button.replaceChildren(icon)
  })
}
