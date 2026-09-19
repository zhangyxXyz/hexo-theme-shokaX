import type { Labels } from './types'

export function mapDrawer(layout: HTMLElement, aside: HTMLElement, labels: Labels, signal: AbortSignal) {
  const media = window.matchMedia('(max-width: 600px)')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'statistics-map-toggle'
  button.setAttribute('aria-label', labels.ranking)
  button.setAttribute('aria-controls', 'statistics-map-drawer')
  aside.id = 'statistics-map-drawer'
  const icon = document.createElement('i')
  icon.setAttribute('aria-hidden', 'true')
  button.append(icon)
  layout.append(button)
  let open = false
  const sync = () => {
    button.hidden = !media.matches
    aside.hidden = media.matches && !open
    layout.classList.toggle('is-ranking-open', media.matches && open)
    button.setAttribute('aria-expanded', String(media.matches && open))
    icon.className = `ic i-chevrons-${open ? 'right' : 'left'}`
  }
  const close = () => { open = false; sync() }
  button.onclick = () => { open = !open; sync() }
  document.addEventListener('pointerdown', event => {
    if (open && !aside.contains(event.target as Node) && !button.contains(event.target as Node)) close()
  }, { signal })
  document.addEventListener('keydown', event => {
    if (open && event.key === 'Escape') { close(); button.focus({ preventScroll: true }) }
  }, { signal })
  media.addEventListener('change', close, { signal })
  sync()
}
