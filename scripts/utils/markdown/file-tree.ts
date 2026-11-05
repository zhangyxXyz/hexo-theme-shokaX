import { blockHead, bodyLines, escapeHtml, parseAttrs, registerContainer, textAttr, type Translate } from './shared'

interface TreeNode {
  name: string
  note: string
  strong: boolean
  change?: 'added' | 'removed'
  /** A trailing slash marks a folder even without children. */
  slash: boolean
  children: TreeNode[]
}

export const FOLDER_ICON = '<svg class="md-tree-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7.25A2.25 2.25 0 0 1 5.25 5h3.6c.6 0 1.17.24 1.6.66L11.9 7.1h6.85A2.25 2.25 0 0 1 21 9.35v8.4A2.25 2.25 0 0 1 18.75 20H5.25A2.25 2.25 0 0 1 3 17.75z"/></svg>'
export const FILE_ICON = '<svg class="md-tree-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.25 3h7.1l5.4 5.4v11.35A1.25 1.25 0 0 1 17.5 21h-11.25A1.25 1.25 0 0 1 5 19.75V4.25A1.25 1.25 0 0 1 6.25 3z"/><path class="md-tree-fold" d="M13.25 3v4.4c0 .58.47 1.05 1.05 1.05h4.45"/></svg>'

const FILE_TYPES: Array<[string, RegExp]> = [
  ['code', /\.(?:[cm]?[jt]sx?|vue|svelte|py|go|rs|java|kt|c|cc|cpp|h|hpp|cs|lua|rb|php|swift|dart)$/i],
  ['shell', /\.(?:sh|bash|zsh|ps1|bat|cmd)$/i],
  ['style', /\.(?:css|styl|scss|sass|less)$/i],
  ['markup', /\.(?:html?|pug|njk|ejs|xml|svg)$/i],
  ['data', /(?:\.(?:json|ya?ml|toml|ini|lock|env)|^\.env(?:\..+)?)$/i],
  ['doc', /\.(?:md|markdown|txt|pdf|docx?|rst)$/i],
  ['image', /\.(?:png|jpe?g|webp|gif|avif|ico|bmp)$/i]
]

export const fileType = (name: string) => FILE_TYPES.find(([, pattern]) => pattern.test(name))?.[0] || 'file'

function parseEntry(source: string): TreeNode {
  let value = source.trim()
  let change: TreeNode['change']
  const marked = value.match(/^(\+\+|--)\s+(.*)$/)
  if (marked) {
    change = marked[1] === '++' ? 'added' : 'removed'
    value = marked[2]
  }
  let note = ''
  // Only " # " starts a note, so names such as `C#` stay intact.
  const noteAt = value.search(/\s#\s/)
  if (noteAt >= 0) {
    note = value.slice(noteAt).replace(/^\s#\s/, '').trim()
    value = value.slice(0, noteAt).trim()
  }
  let strong = false
  const bold = value.match(/^\*\*(.+)\*\*$/)
  if (bold) {
    strong = true
    value = bold[1]
  }
  const slash = /\/$/.test(value)
  return { name: value.replace(/\/+$/, ''), note, strong, change, slash, children: [] }
}

function buildTree(items: Array<{ depth: number, text: string }>) {
  const root: TreeNode[] = []
  const stack: Array<{ depth: number, node: TreeNode }> = []
  for (const item of items) {
    while (stack.length && stack[stack.length - 1].depth >= item.depth) stack.pop()
    const node = parseEntry(item.text)
    if (!node.name) continue
    ;(stack.length ? stack[stack.length - 1].node.children : root).push(node)
    stack.push({ depth: item.depth, node })
  }
  return root
}

/** Indented Markdown list (`- name`, two spaces per level). */
export function parseListTree(lines: string[]) {
  return buildTree(lines.flatMap(line => {
    const match = line.match(/^( *)[-*+]\s+(.*)$/)
    return match ? [{ depth: match[1].length, text: match[2] }] : []
  }))
}

/** Text produced by `tree` on Unix (├──) or Windows (+---). */
export function parseTextTree(source: string) {
  return buildTree(source.split(/\r?\n/).flatMap(raw => {
    const line = raw.replace(/\u00a0/g, ' ').replace(/\t/g, '    ')
    if (!line.trim()) return []
    const match = line.match(/^((?:[│|] {3}| {4})*)(?:([├└]──|[+\\]---)\s*)?(.*)$/)
    const depth = match[1].length / 4 + (match[2] ? 1 : 0)
    return [{ depth, text: match[3] }]
  }))
}

export function renderTree(md: any, t: Translate, nodes: TreeNode[], options: { title: string, icon: string, collapseSlash: boolean }) {
  const entry = (node: TreeNode, folder: boolean) => {
    const name = escapeHtml(node.name)
    const badge = node.change ? `<span class="md-tree-badge">${escapeHtml(t(`markdown.file_tree.${node.change}`))}</span>` : ''
    const note = node.note ? `<span class="md-tree-note">${md.renderInline(node.note)}</span>` : ''
    return `<span class="md-tree-entry">${folder ? FOLDER_ICON : FILE_ICON}<span class="md-tree-name">${node.strong ? `<strong>${name}</strong>` : name}</span>${badge}${note}</span>`
  }
  const render = (list: TreeNode[]): string => list.map(node => {
    const change = node.change ? ` is-${node.change}` : ''
    if (node.children.length) {
      const open = options.collapseSlash && node.slash ? '' : ' open'
      return `<li class="md-tree-folder${change}"><details${open}><summary>${entry(node, true)}</summary><ul>${render(node.children)}</ul></details></li>`
    }
    if (node.slash) return `<li class="md-tree-folder is-empty${change}">${entry(node, true)}</li>`
    return `<li class="md-tree-file${change}" data-type="${fileType(node.name)}">${entry(node, false)}</li>`
  }).join('')
  const icon = options.icon === 'simple' ? 'simple' : 'colored'
  return `<figure class="md-file-tree" data-icon="${icon}">${blockHead(options.title, t('markdown.file_tree.eyebrow'), 'figcaption')}<ul class="md-tree">${render(nodes)}</ul></figure>\n`
}

export function fileTreePlugin(md: any, t: Translate) {
  registerContainer(md, 'file-tree', ({ state, startLine, endLine, directive }) => {
    const token = state.push('shokax_file_tree', 'figure', 0)
    token.block = true
    token.map = [startLine, endLine]
    token.meta = {
      title: directive.label || textAttr(directive.attrs.title) || directive.argument,
      icon: textAttr(directive.attrs.icon),
      nodes: parseListTree(bodyLines(state, startLine, endLine)),
      collapseSlash: true
    }
  })

  // ```file-tree fences bypass Shiki: convert them before rendering.
  md.core.ruler.after('block', 'shokax_file_tree_fence', (state: any) => {
    for (const token of state.tokens) {
      if (token.type !== 'fence') continue
      const info = token.info.trim()
      if (!/^file-tree(?:\s|$)/.test(info)) continue
      const attrs = parseAttrs(info.slice('file-tree'.length))
      token.type = 'shokax_file_tree'
      token.meta = { title: textAttr(attrs.title), icon: textAttr(attrs.icon), nodes: parseTextTree(token.content), collapseSlash: false }
    }
  })

  md.renderer.rules.shokax_file_tree = (tokens: any[], index: number) => {
    const { nodes, ...options } = tokens[index].meta
    return renderTree(md, t, nodes, options)
  }
}
