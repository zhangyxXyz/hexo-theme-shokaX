// Native modal dialogs sit in the browser's top layer. While one is open the whole
// widget (character and bubble) joins the top layer above it; otherwise it keeps its
// ordinary z-index below the music panel. The document is inert behind a modal, so
// the lifted widget is visible but not interactive until the dialog closes.
export function floatAboveModals(widget: HTMLElement) {
  if (typeof widget.showPopover !== 'function') return
  const lifted = () => widget.matches(':popover-open')
  const sync = () => {
    if (lifted()) widget.hidePopover()
    if (document.querySelector('dialog:modal')) {
      widget.setAttribute('popover', 'manual')
      // Reopening places the widget above the most recently opened modal.
      widget.showPopover()
    } else widget.removeAttribute('popover')
  }
  new MutationObserver(records => {
    if (records.some(record => record.target instanceof HTMLDialogElement)) sync()
  }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['open'] })
  sync()
}
