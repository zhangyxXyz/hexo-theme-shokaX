type Manifest = { source: string; paths: string[]; origins: string[] }
let bank: Promise<Map<string, HTMLDetailsElement>> | undefined
let bankSource = ''
let manifestNode: Element | null | undefined
let manifestText: string | null | undefined
let cachedManifest: Manifest | undefined
let paths = new Map<string, string>()
let origins = new Set<string>()

const pathKey = (path: string) => path.split('/').map(segment => {
  try { return encodeURIComponent(decodeURIComponent(segment)) } catch { return segment }
}).join('/').replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/'

// Both tooltip arbitration and lazy previews use the same public-article allowlist.
export function articlePreviewTarget(element: Element): string | undefined {
  const anchor = element.closest('a[href]')
  if (!anchor || anchor.closest('.article-preview-row, .article-preview, .contents, .wl-panel, .wl-content, .twikoo, pre, code, [data-no-article-preview]')) return
  const href = anchor.getAttribute('href') || ''
  if (!href || href.startsWith('#') || anchor.hasAttribute('download')) return
  const manifest = readManifest()
  if (!manifest) return
  try {
    const url = new URL(href, location.href)
    if (!/^https?:$/.test(url.protocol) || !origins.has(url.origin) || url.username || url.password) return
    if (pathKey(url.pathname) === pathKey(location.pathname)) return
    return paths.get(pathKey(url.pathname))
  } catch { return }
}

export function readManifest(): Manifest | undefined {
  const node = document.querySelector('[data-article-preview-manifest]')
  const text = node?.textContent
  if (node === manifestNode && text === manifestText) return cachedManifest
  manifestNode = node
  manifestText = text
  cachedManifest = undefined
  paths = new Map()
  origins = new Set()
  try {
    const manifest: Manifest | null = JSON.parse(text || 'null')
    if (!manifest) return
    const nextPaths = new Map(manifest.paths.map(path => [pathKey(new URL(path, location.href).pathname), path]))
    const nextOrigins = new Set([location.origin, ...manifest.origins.map(origin => new URL(origin).origin)])
    paths = nextPaths
    origins = nextOrigins
    cachedManifest = manifest
    return manifest
  } catch { return }
}

export async function loadArticlePreview(path: string): Promise<HTMLDetailsElement | undefined> {
  const manifest = readManifest()
  if (!manifest) return
  if (!bank || bankSource !== manifest.source) {
    bankSource = manifest.source
    const request = fetch(manifest.source, { signal: AbortSignal.timeout(10000) }).then(response => {
      if (!response.ok) throw new Error('Article preview unavailable')
      return response.text()
    }).then(html => {
      const doc = new DOMParser().parseFromString(html, 'text/html')
      const entries = new Map<string, HTMLDetailsElement>()
      doc.querySelectorAll<HTMLElement>('[data-preview-path]').forEach(entry => {
        const preview = entry.querySelector<HTMLDetailsElement>('.article-preview')
        if (preview && entry.dataset.previewPath) entries.set(entry.dataset.previewPath, preview)
      })
      return entries
    }).catch(error => { if (bank === request) bank = undefined; throw error })
    bank = request
  }
  const entries = await bank
  return entries.get(path)?.cloneNode(true) as HTMLDetailsElement | undefined
}
