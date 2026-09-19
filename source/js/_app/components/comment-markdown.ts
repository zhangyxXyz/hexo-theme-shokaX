import { enhanceCodeBlocks } from './codeblock'

export function createCommentMarkdown(container: HTMLElement) {
  const pending = new WeakSet<Element>()
  const blocks = new Map<HTMLElement, () => void>()
  let disposed = false
  const sync = () => {
    for (const [pre, destroy] of blocks) {
      if (!pre.isConnected) { destroy(); blocks.delete(pre) }
    }
    container.querySelectorAll<HTMLElement>('.wl-content').forEach(content => {
      if (!content.classList.contains('md')) content.classList.add('md')
      content.querySelectorAll<HTMLPreElement>('pre').forEach(pre => {
        if (pre.closest('.shokax-code') || pending.has(pre)) return
        const code = pre.querySelector('code')
        if (!code) return
        pending.add(pre)
        const text = code.textContent || ''
        const language = Array.from(code.classList).find(name => name.startsWith('language-'))?.slice(9) || 'text'
        // Build the final geometry synchronously, before the async grammar loads.
        // Keep this code element: toolbar handlers retain a reference to it.
        const lines = document.createDocumentFragment()
        text.split('\n').forEach((line, index) => {
          if (index) lines.append(document.createTextNode('\n'))
          const span = document.createElement('span')
          span.className = 'line'
          span.textContent = line
          lines.append(span)
        })
        code.replaceChildren(lines)
        pre.classList.add('shiki')
        pre.style.setProperty('--shiki-dark', 'var(--text-color)')
        blocks.set(pre, enhanceCodeBlocks(content, 'pre.shiki', true))
        void import('./comment-highlight').then(module => module.highlightCommentCode(text, language)).then(html => {
          if (disposed || !pre.isConnected || !container.contains(pre) || code.textContent !== text) return
          // Only Shiki output from plain code text is inserted; never reparse raw comment HTML.
          const template = document.createElement('template')
          template.innerHTML = html
          const rendered = template.content.querySelector('pre')!
          const highlightedCode = rendered.querySelector('code')!
          pre.style.cssText = rendered.style.cssText
          code.replaceChildren(...Array.from(highlightedCode.childNodes))
        }).catch(error => { console.error('Comment code highlighting:', error) })
      })
    })
  }
  return { sync, destroy: () => { disposed = true; blocks.forEach(destroy => destroy()); blocks.clear() } }
}
