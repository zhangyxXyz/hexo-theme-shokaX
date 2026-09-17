let cleanup: (() => void) | undefined

export function refreshSidebarMenu() {
  cleanup?.()
  const events = new AbortController()
  document.querySelectorAll<HTMLElement>('.overview .menu .dropdown').forEach((group, index) => {
    const button = group.querySelector<HTMLButtonElement>(':scope > .sidebar-menu-toggle')
    const submenu = group.querySelector<HTMLElement>(':scope > .submenu')
    if (!button || !submenu) return
    submenu.id = `sidebar-submenu-${index}`
    button.setAttribute('aria-controls', submenu.id)
    let pinned = group.classList.contains('expand')
    const open = (value: boolean) => {
      group.classList.toggle('is-open', value)
      group.classList.remove('expand')
      button.setAttribute('aria-expanded', String(value))
      submenu.inert = !value
    }
    open(pinned)
    button.addEventListener('click', () => { pinned = !pinned; open(pinned) }, { signal: events.signal })
    group.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') open(true) }, { signal: events.signal })
    group.addEventListener('pointerleave', () => { if (!pinned && !group.contains(document.activeElement)) open(false) }, { signal: events.signal })
    group.addEventListener('focusout', event => {
      if (!pinned && !(event.relatedTarget instanceof Node && group.contains(event.relatedTarget))) open(false)
    }, { signal: events.signal })
    group.addEventListener('keydown', event => {
      if (event.key === 'Escape') { pinned = false; open(false); button.focus() }
      if (event.key === 'ArrowDown' && event.target === button) {
        event.preventDefault()
        open(true)
        submenu.querySelector<HTMLAnchorElement>('a')?.focus()
      }
    }, { signal: events.signal })
  })
  cleanup = () => events.abort()
}
