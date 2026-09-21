// Decorations mutate the same subtree that Waline renders. Do not observe our
// own writes, and coalesce native updates so they cannot starve browser input.
export function observeCommentDecorations(container: HTMLElement, sync: () => void) {
  let frame: number | undefined
  let disposed = false
  const options: MutationObserverInit = {
    childList: true, subtree: true, attributes: true,
    attributeFilter: ['class', 'title', 'data-value', 'data-visibility-reason', 'href', 'src', 'srcset']
  }
  const observer = new MutationObserver(() => {
    if (disposed || frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      if (disposed) return
      observer.disconnect()
      try { sync() } finally { if (!disposed) observer.observe(container, options) }
    })
  })
  observer.observe(container, options)
  return {
    disconnect() {
      disposed = true
      observer.disconnect()
      if (frame !== undefined) cancelAnimationFrame(frame)
    }
  }
}
