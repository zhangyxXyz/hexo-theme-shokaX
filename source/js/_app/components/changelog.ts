let cleanup: (() => void) | undefined

export const refreshChangelog = () => {
  cleanup?.()
  cleanup = undefined
  const details = document.querySelector<HTMLDetailsElement>('[data-changelog]')
  if (!details) return
  const trigger = details.querySelector<HTMLElement>('summary')
  const content = details.querySelector<HTMLElement>('.changelog-content')
  if (!trigger || !content) return
  const abort = new AbortController()
  const dialog = document.createElement('dialog')
  dialog.className = 'changelog-dialog'
  dialog.tabIndex = -1
  dialog.dataset.side = details.dataset.side
  dialog.setAttribute('aria-label', details.dataset.title)
  const header = document.createElement('header')
  header.className = 'changelog-dialog-header'
  const heading = document.createElement('h2')
  heading.textContent = details.dataset.title
  const count = document.createElement('span')
  count.className = 'changelog-count'
  count.textContent = details.dataset.count
  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'changelog-close'
  const closeIcon = document.createElement('i')
  closeIcon.className = 'ic i-times'
  closeIcon.setAttribute('aria-hidden', 'true')
  closeButton.append(closeIcon)
  closeButton.setAttribute('aria-label', details.dataset.close)
  header.append(heading, count, closeButton)
  dialog.append(header)
  document.body.append(dialog)
  let previousOverflow: string | undefined
  let closing: Animation | undefined
  let backdropPress = false
  let keyboardInteraction = false
  const finish = (restoreFocus = true) => {
    closing?.cancel()
    closing = undefined
    if (dialog.open) dialog.close()
    details.append(content)
    details.open = false
    trigger.setAttribute('aria-expanded', 'false')
    if (previousOverflow !== undefined) document.body.style.overflow = previousOverflow
    previousOverflow = undefined
    if (restoreFocus && keyboardInteraction && trigger.isConnected) trigger.focus({ preventScroll: true })
  }
  const close = () => {
    if (!dialog.open || closing) return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return }
    const offset = dialog.dataset.side === 'left' ? '-2rem' : '2rem'
    closing = dialog.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: `translateX(${offset})`, opacity: 0 }], { duration: 160, easing: 'ease-in', fill: 'forwards' })
    closing.onfinish = () => finish()
  }
  const options = { signal: abort.signal }
  trigger.addEventListener('click', event => {
    event.preventDefault()
    if (dialog.open) return
    keyboardInteraction = event.detail === 0
    dialog.append(content)
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    trigger.setAttribute('aria-expanded', 'true')
    dialog.showModal()
    content.scrollTop = 0
    dialog.focus({ preventScroll: true })
  }, options)
  dialog.addEventListener('keydown', () => { keyboardInteraction = true }, options)
  closeButton.addEventListener('click', close, options)
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() }, options)
  const outside = (event: MouseEvent) => {
    const rect = dialog.getBoundingClientRect()
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  }
  dialog.addEventListener('pointerdown', event => { backdropPress = outside(event) }, options)
  dialog.addEventListener('click', event => { if (backdropPress && outside(event)) close(); backdropPress = false }, options)
  cleanup = () => { abort.abort(); finish(false); dialog.remove() }
}
