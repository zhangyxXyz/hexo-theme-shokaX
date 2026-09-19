// Keep the existing viewport-sized canvas above modal dialogs without moving it
// into their scrolling / transformed coordinate systems.
export function attachFireworkLayer(canvas: HTMLCanvasElement) {
  canvas.dataset.siteFireworks = ''
  canvas.setAttribute('aria-hidden', 'true')
  canvas.setAttribute('popover', 'manual')
  Object.assign(canvas.style, {
    margin: '0', padding: '0', border: '0', background: 'transparent',
    inset: '0 auto auto 0', maxWidth: 'none', maxHeight: 'none',
    pointerEvents: 'none'
  })
  const raise = () => {
    if (!canvas.isConnected) return
    if (canvas.matches(':popover-open')) canvas.hidePopover()
    canvas.showPopover()
  }
  if (typeof canvas.showPopover !== 'function') return
  raise()
  // The open mutation runs before the first frame of the new modal.
  const observer = new MutationObserver(records => {
    if (records.some(record => record.target instanceof HTMLDialogElement && record.target.open ||
      Array.from(record.addedNodes).some(node => node instanceof Element && (node.matches('dialog[open]') || node.querySelector('dialog[open]'))))) raise()
  })
  observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open'] })
  document.addEventListener('toggle', event => {
    if (event.target instanceof HTMLDialogElement && event.target.open) raise()
  }, true)
}
