export function refreshArticleRelock() {
  // This marker only exists inside the decrypted payload, including auto-unlock.
  if (!document.querySelector('#hexo-blog-encrypt.hbe-decrypted-content, .post .md [data-article-unlocked]')) return
  const marker = document.querySelector<HTMLElement>('[data-post-relock]')
  if (!marker || marker instanceof HTMLButtonElement) return
  const button = document.createElement('button')
  button.type = 'button'
  button.className = marker.className
  button.dataset.postRelock = ''
  button.title = marker.dataset.relockLabel
  button.setAttribute('aria-label', marker.dataset.relockLabel)
  button.style.cssText = 'background:transparent;border:0;padding:0;font:inherit;color:inherit;cursor:pointer;pointer-events:auto'
  button.append(...Array.from(marker.childNodes))
  button.querySelector('.ic')?.classList.replace('i-lock', 'i-unlock')
  const label = button.querySelector<HTMLElement>('[data-encryption-label]')
  if (label) label.textContent = marker.dataset.unlockedLabel
  button.addEventListener('click', () => {
    // hexo-blog-encrypt v4 scopes its cached derived key to pathname + query.
    try {
      localStorage.removeItem('hbe.v4.' + location.pathname + location.search)
    } finally {
      location.reload()
    }
  })
  marker.replaceWith(button)
}
