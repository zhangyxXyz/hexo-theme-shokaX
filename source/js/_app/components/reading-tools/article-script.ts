const excluded = 'pre, code, kbd, samp, script, style, textarea, input, select, button, svg, math, .katex, .MathJax, [contenteditable], [translate="no"], .notranslate, #hexo-blog-encrypt:not(.hbe-decrypted-content)'
let cleanup: (() => void) | undefined
let converter: ((text: string) => string) | undefined

export function refreshArticleScript(button: HTMLButtonElement, config: DOMStringMap) {
  cleanup?.()
  const body = document.querySelector<HTMLElement>('article.post [itemprop="articleBody"]') || document.getElementById('main')
  button.hidden = !body
  if (!body) return
  const events = new AbortController()
  const original = new Map<Text, { original: string; converted: string }>()
  let traditional = false
  let active = true
  let busy = false
  const sync = () => {
    button.querySelector('i')!.className = `ic i-chinese-${traditional ? 'simplified' : 'traditional'}`
    button.setAttribute('aria-label', traditional ? config.simplified! : config.traditional!)
    button.title = traditional ? config.simplified! : config.traditional!
    button.setAttribute('aria-pressed', String(traditional))
  }
  const restore = () => {
    original.forEach((value, node) => { if (node.data === value.converted) node.data = value.original })
    original.clear()
  }
  const convert = () => {
    if (!converter || !traditional) return
    observer.disconnect()
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
    let node: Text | null
    while ((node = walker.nextNode() as Text | null)) {
      if (node.parentElement?.closest(excluded) || !/[\u3400-\u9fff]/.test(node.data)) continue
      const saved = original.get(node)
      if (saved && node.data === saved.converted) continue
      const converted = converter(node.data)
      original.set(node, { original: node.data, converted })
      node.data = converted
    }
    observer.observe(body, { childList: true, characterData: true, subtree: true })
  }
  const observer = new MutationObserver(convert)
  cleanup = () => { active = false; events.abort(); observer.disconnect(); restore(); button.disabled = false }
  button.addEventListener('click', async () => {
    if (busy) return
    if (traditional) {
      observer.disconnect(); traditional = false; restore(); sync(); return
    }
    busy = true
    button.disabled = true
    try {
      if (!converter) { const { Converter } = await import('opencc-js'); converter = Converter({ from: 'cn', to: 'tw' }) }
      if (!active || !body.isConnected) return
      traditional = true; convert(); sync()
    } catch { button.title = config.error! }
    finally { busy = false; if (active) button.disabled = false }
  }, { signal: events.signal })
  sync()
}
