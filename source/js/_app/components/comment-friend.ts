// A website match is a decorative label, not verified user identity.
export function matchesFriendWebsite(link: string, friends: string[]): boolean {
  const parse = (value: string) => {
    try {
      const url = new URL(value.startsWith('//') ? `https:${value}` : value)
      return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url : null
    } catch { return null }
  }
  const website = parse(link)
  if (!website) return false
  return friends.some(friend => {
    const entry = parse(friend)
    if (!entry || website.host !== entry.host) return false
    const prefix = entry.pathname.replace(/\/+$/, '')
    return !prefix || website.pathname === prefix || website.pathname.startsWith(`${prefix}/`)
  })
}

export function syncFriendBadges(container: HTMLElement, friends: string[], label: string) {
  container.querySelectorAll<HTMLElement>('.wl-card > .wl-head').forEach(head => {
    const badge = head.querySelector<HTMLElement>(':scope > .shokax-friend-badge')
    const nick = head.querySelector<HTMLAnchorElement>('a.wl-nick')
    const nativeIdentity = head.querySelector('.wl-badge:not(.shokax-friend-badge)') ||
      head.parentElement?.parentElement?.querySelector(':scope > .wl-user .administrator-icon')
    if (nativeIdentity || !nick || !matchesFriendWebsite(nick.getAttribute('href') || '', friends)) {
      badge?.remove()
      return
    }
    if (!badge) {
      const element = document.createElement('span')
      element.className = 'wl-badge shokax-friend-badge'
      element.textContent = label
      nick.after(element)
    } else if (badge.textContent !== label) badge.textContent = label
  })
}
