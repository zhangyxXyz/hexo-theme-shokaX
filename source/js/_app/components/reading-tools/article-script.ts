const excluded = 'pre, code, kbd, samp, script, style, noscript, textarea, input, select, svg, math, .katex, .MathJax, [contenteditable], [translate="no"], .notranslate, #hexo-blog-encrypt:not(.hbe-decrypted-content)'
const attributes = ['title', 'aria-label', 'placeholder', 'alt', 'data-theme-tooltip']
const han = /[\u3400-\u9fff]/
const storageKey = 'shokax.article-script'

type Saved = { original: string; converted: string }

let converter: ((text: string) => string) | undefined
let traditional = false
let loading: Promise<void> | undefined
let observer: MutationObserver | undefined
let title: Saved | undefined
const texts = new Map<Text, Saved>()
const attrs = new Map<Element, Map<string, Saved>>()

function readPreference() {
  try { return localStorage.getItem(storageKey) === 'traditional' } catch { return false }
}

function writePreference(value: boolean) {
  try {
    if (value) localStorage.setItem(storageKey, 'traditional')
    else localStorage.removeItem(storageKey)
  } catch { /* Storage may be disabled. */ }
}

function convertText(node: Text) {
  if (!han.test(node.data) || node.parentElement?.closest(excluded)) return
  const saved = texts.get(node)
  if (saved && node.data === saved.converted) return
  const converted = converter!(node.data)
  if (converted === node.data) return
  texts.set(node, { original: node.data, converted })
  node.data = converted
}

function convertAttributes(element: Element) {
  if (element.closest(excluded)) return
  for (const name of attributes) {
    const value = element.getAttribute(name)
    if (!value || !han.test(value)) continue
    const saved = attrs.get(element)?.get(name)
    if (saved && value === saved.converted) continue
    const converted = converter!(value)
    if (converted === value) continue
    if (!attrs.has(element)) attrs.set(element, new Map())
    attrs.get(element)!.set(name, { original: value, converted })
    element.setAttribute(name, converted)
  }
}

function convertTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return convertText(root as Text)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  convertAttributes(root as Element)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    if (node.nodeType === Node.TEXT_NODE) convertText(node as Text)
    else convertAttributes(node as Element)
  }
}

function convertTitle() {
  if (title && document.title === title.converted) return
  const converted = converter!(document.title)
  if (converted === document.title) return
  title = { original: document.title, converted }
  document.title = converted
}

function observe() {
  observer?.observe(document.documentElement, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: attributes })
}

// Mutations are handled per record so live widgets (lyrics, counters, tips) never trigger a full-page walk.
function handle(records: MutationRecord[]) {
  observer!.disconnect()
  for (const record of records) {
    if (record.type === 'characterData') convertText(record.target as Text)
    else if (record.type === 'attributes') convertAttributes(record.target as Element)
    else record.addedNodes.forEach(node => {
      if (node.nodeName === 'TITLE' || record.target.nodeName === 'TITLE') convertTitle()
      else if (node.isConnected) convertTree(node)
    })
  }
  observe()
}

function prune() {
  texts.forEach((_, node) => { if (!node.isConnected) texts.delete(node) })
  attrs.forEach((_, element) => { if (!element.isConnected) attrs.delete(element) })
}

function apply() {
  observer ??= new MutationObserver(handle)
  observer.disconnect()
  prune()
  convertTree(document.body)
  convertTitle()
  observe()
}

function restore() {
  observer?.disconnect()
  texts.forEach((value, node) => { if (node.data === value.converted) node.data = value.original })
  attrs.forEach((names, element) => names.forEach((value, name) => {
    if (element.getAttribute(name) === value.converted) element.setAttribute(name, value.original)
  }))
  if (title && document.title === title.converted) document.title = title.original
  texts.clear()
  attrs.clear()
  title = undefined
}

async function loadConverter() {
  if (converter) return
  loading ??= import('opencc-js').then(({ Converter }) => { converter = Converter({ from: 'cn', to: 'tw' }) })
  try { await loading } catch (error) { loading = undefined; throw error }
}

export function refreshArticleScript(button: HTMLButtonElement, config: DOMStringMap) {
  const sync = () => {
    const label = traditional ? config.simplified! : config.traditional!
    button.querySelector('i')!.className = `ic i-chinese-${traditional ? 'simplified' : 'traditional'}`
    button.setAttribute('aria-label', label)
    button.title = label
    button.setAttribute('aria-pressed', String(traditional))
  }
  const enable = async () => {
    button.disabled = true
    try {
      await loadConverter()
      traditional = true
      apply()
    } catch {
      traditional = false
      button.title = config.error!
    } finally {
      button.disabled = false
    }
  }

  // The toolbar button survives PJAX; bind it once and only re-apply to the new page content.
  if (!button.dataset.bound) {
    button.dataset.bound = 'true'
    button.addEventListener('click', async () => {
      if (button.disabled) return
      if (traditional) {
        traditional = false
        writePreference(false)
        restore()
        sync()
        return
      }
      writePreference(true)
      await enable()
      sync()
    })
  }

  if (traditional) apply()
  else if (readPreference()) void enable().then(sync)
  sync()
}
