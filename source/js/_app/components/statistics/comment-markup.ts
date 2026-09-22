/** Rebuild supported comment markup without copying executable attributes or nodes. */
export function renderCommentMarkup(html: string): DocumentFragment {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const result = document.createDocumentFragment()
  const allowed = new Set(['P', 'DIV', 'BR', 'HR', 'STRONG', 'B', 'EM', 'I', 'DEL', 'S', 'U', 'CODE', 'PRE', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'A', 'IMG', 'SPAN', 'SUP', 'SUB', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'])
  const blocked = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'FORM', 'INPUT', 'BUTTON', 'TEXTAREA', 'TEMPLATE'])
  const url = (value: string | null) => {
    if (!value) return ''
    try {
      const parsed = new URL(value, location.origin)
      return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : ''
    } catch { return '' }
  }
  const append = (node: Node, parent: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.textContent || '')); return }
    if (!(node instanceof Element) || blocked.has(node.tagName)) return
    if (!allowed.has(node.tagName)) { node.childNodes.forEach(child => append(child, parent)); return }
    const element = document.createElement(node.tagName.toLowerCase())
    if (node.tagName === 'A') {
      const href = url(node.getAttribute('href'))
      if (href) {
        element.setAttribute('href', href)
        element.setAttribute('target', '_blank')
        element.setAttribute('rel', 'ugc nofollow noopener noreferrer')
      }
    }
    if (node.tagName === 'IMG') {
      const src = url(node.getAttribute('src'))
      if (!src) return
      element.setAttribute('src', src)
      element.setAttribute('alt', node.getAttribute('alt') || '')
      element.setAttribute('loading', 'lazy')
      element.setAttribute('referrerpolicy', 'no-referrer')
      if (node.classList.contains('wl-emoji')) element.className = 'statistics-comment-emoji'
    }
    node.childNodes.forEach(child => append(child, element))
    parent.appendChild(element)
  }
  parsed.body.childNodes.forEach(node => append(node, result))
  return result
}
