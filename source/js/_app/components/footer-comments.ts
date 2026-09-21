export interface FooterComment {
  nick: string
  text: string
  url: string
  id: string
  avatar?: string
}

export const renderFooterComments = (container: HTMLElement, rows: FooterComment[]) => {
  const fragment = document.createDocumentFragment()
  for (const item of rows.slice(0, Number(container.dataset.limit) || 3)) {
    const target = new URL(item.url || '/', shokax_siteURL)
    // A comment's page must stay on this blog, even if the service returns a full URL.
    if (target.origin !== new URL(shokax_siteURL).origin) continue
    const li = document.createElement('li')
    const link = document.createElement('a')
    link.className = 'footer-comment-link'
    link.href = target.pathname + target.search + '#' + encodeURIComponent(item.id)
    const avatar = document.createElement('span')
    avatar.className = 'footer-comment-avatar'
    avatar.setAttribute('aria-hidden', 'true')
    avatar.textContent = Array.from(item.nick || '?')[0]
    if (item.avatar && /^https?:\/\//i.test(item.avatar)) {
      const img = document.createElement('img')
      img.alt = ''
      img.loading = 'lazy'
      img.referrerPolicy = 'no-referrer'
      img.src = item.avatar
      img.addEventListener('error', () => { img.remove(); avatar.textContent = Array.from(item.nick || '?')[0] }, { once: true })
      avatar.replaceChildren(img)
    }
    const body = document.createElement('span')
    const name = document.createElement('span')
    name.className = 'footer-comment-name'
    name.textContent = item.nick
    const text = document.createElement('span')
    text.className = 'footer-comment-text'
    text.textContent = item.text
    body.append(name, text)
    link.append(avatar, body)
    li.append(link)
    fragment.append(li)
  }
  container.replaceChildren(fragment)
  if (!container.children.length) footerCommentState(container, 'empty')
  container.dataset.loaded = 'true'
}

export const footerCommentState = (container: HTMLElement, state: 'empty' | 'error') => {
  const li = document.createElement('li')
  li.className = 'footer-comment-state'
  li.textContent = container.dataset[state] || ''
  container.replaceChildren(li)
}
