import { load } from 'cheerio'

export interface GraphNode { id: string; title: string; url: string }
export interface GraphIndex {
  nodes: Map<string, GraphNode>
  outgoing: Map<string, Set<string>>
  incoming: Map<string, Set<string>>
}

const tagArray = tags => Array.isArray(tags) ? tags : tags?.toArray?.() || []
export function publicGraphPost(post, config): boolean {
  if (post.published === false || post.hidden || post.graph_index === false || /^_drafts[\\/]/.test(post.source || '')) return false
  if (!config.future && Number(post.date?.valueOf()) > Date.now()) return false
  if (post.encrypt === true || /id=["']hexo-blog-encrypt["']/.test(String(post.content || ''))) return false
  if (post.password === '') return true
  let password = post.password
  if (password == null) {
    const configured = new Map((config.encrypt?.tags || []).map(tag => [tag.name, tag.password]))
    for (const tag of tagArray(post.tags)) {
      if (configured.has(tag.name)) { password = configured.get(tag.name); break }
    }
  }
  return password == null || password === ''
}

// Decode each segment once without interpreting encoded path separators as directories.
function pathKey(pathname: string): string {
  return pathname.split('/').map(segment => {
    try { return encodeURIComponent(decodeURIComponent(segment)) } catch { return segment }
  }).join('/').replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/'
}

export function buildGraphIndex(posts: any[], config, aliases: string[] = []): GraphIndex {
  const base = new URL(config.url)
  const root = '/' + String(config.root ?? base.pathname).replace(/^\/+|\/+$/g, '')
  const prefix = root === '/' ? '/' : root + '/'
  const origins = new Set([base.origin])
  for (const alias of aliases) {
    try { const url = new URL(alias); if (/^https?:$/.test(url.protocol)) origins.add(url.origin) } catch { /* Invalid aliases cannot match. */ }
  }
  const nodes = new Map<string, GraphNode>()
  const paths = new Map<string, string>()
  const visible = posts.filter(post => post.path && publicGraphPost(post, config))
  for (const post of visible) {
    const id = String(post.path).replace(/^\/+/, '')
    const url = prefix + id
    nodes.set(id, { id, title: String(post.title || id), url })
    const key = pathKey(new URL(url, base).pathname)
    // Ambiguous canonical aliases are not resolved by insertion order.
    paths.set(key, paths.has(key) ? '' : id)
  }
  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()
  for (const id of nodes.keys()) { outgoing.set(id, new Set()); incoming.set(id, new Set()) }
  for (const post of visible) {
    const id = String(post.path).replace(/^\/+/, '')
    const $ = load(String(post.content || ''))
    $('pre, code, script, style, template').remove()
    $('a[href]').each((_, anchor) => {
      const href = $(anchor).attr('href')?.trim()
      if (!href || href.startsWith('#')) return
      try {
        const url = new URL(href, new URL(nodes.get(id).url, base))
        if (!/^https?:$/.test(url.protocol) || !origins.has(url.origin) || url.username || url.password) return
        const target = paths.get(pathKey(url.pathname))
        if (!target || target === id) return
        outgoing.get(id).add(target)
        incoming.get(target).add(id)
      } catch { /* Malformed and non-article links do not become references. */ }
    })
  }
  return { nodes, outgoing, incoming }
}

export function graphViews(index: GraphIndex, maxNodes = 50) {
  const views = new Map<string, any>()
  const limit = Math.max(2, Math.min(50, Math.floor(Number(maxNodes)) || 50))
  const sorted = (ids: Iterable<string>) => [...ids].sort().map(id => index.nodes.get(id))
  for (const [id, current] of index.nodes) {
    const incoming = index.incoming.get(id), outgoing = index.outgoing.get(id)
    const neighbors = sorted(new Set([...incoming, ...outgoing]))
    if (!neighbors.length) continue
    const selected = neighbors.slice(0, limit - 1)
    const nodes = [current, ...selected].map((node, i) => ({
      ...node,
      relation: i === 0 ? 'current' : incoming.has(node.id) && outgoing.has(node.id) ? 'mutual' : incoming.has(node.id) ? 'incoming' : 'outgoing',
      label: [...node.title].length > 23 ? [...node.title].slice(0, 22).join('') + '…' : node.title
    }))
    // One line per neighbor; mutual references carry arrowheads at both ends.
    const edges = selected.map(node => ({ source: id, target: node.id,
      incoming: incoming.has(node.id), outgoing: outgoing.has(node.id) }))
    views.set(id, { current, incoming: sorted(incoming), outgoing: sorted(outgoing), nodes, edges,
      dense: nodes.length > 12, total: neighbors.length + 1,
      truncated: neighbors.length > selected.length })
  }
  return views
}
