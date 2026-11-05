import { lstatSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { FILE_ICON, FOLDER_ICON, fileType } from './file-tree'
import { closingIndex, escapeHtml, parseAttrs, registerContainer, textAttr, type Attrs, type Translate } from './shared'

export interface CodeTreeOptions {
  /** Blog root; `dir` imports read from `<baseDir>/examples/`. */
  baseDir?: string
  warn?: (message: string) => void
}

interface CodeFile {
  path: string
  language: string
  content: string
  active: boolean
}

const EXAMPLES = 'examples'
const MAX_FILES = 40
const MAX_FILE = 64 * 1024
const MAX_TOTAL = 512 * 1024
const HEIGHT = /^\d+(?:\.\d+)?(?:px|rem|em|vh)$/

// Imported extensions and the Shiki language each maps to.
const LANGUAGES: Record<string, string> = {
  '.js': 'js', '.mjs': 'js', '.cjs': 'js', '.ts': 'ts', '.mts': 'ts', '.cts': 'ts', '.jsx': 'jsx', '.tsx': 'tsx',
  '.vue': 'vue', '.svelte': 'svelte', '.html': 'html', '.htm': 'html', '.xml': 'xml', '.svg': 'xml',
  '.css': 'css', '.scss': 'scss', '.sass': 'sass', '.less': 'less', '.styl': 'stylus', '.pug': 'pug',
  '.json': 'json', '.jsonc': 'jsonc', '.json5': 'json5', '.yml': 'yaml', '.yaml': 'yaml', '.toml': 'toml', '.ini': 'ini',
  '.md': 'markdown', '.markdown': 'markdown', '.txt': 'text',
  '.sh': 'bash', '.bash': 'bash', '.zsh': 'zsh', '.ps1': 'powershell', '.bat': 'bat', '.cmd': 'bat',
  '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java', '.kt': 'kotlin', '.c': 'c', '.h': 'c',
  '.cc': 'cpp', '.cpp': 'cpp', '.hpp': 'cpp', '.cs': 'csharp', '.lua': 'lua', '.rb': 'ruby', '.php': 'php',
  '.swift': 'swift', '.dart': 'dart', '.sql': 'sql', '.diff': 'diff'
}
const NAMED: Record<string, string> = { dockerfile: 'dockerfile', makefile: 'makefile' }
const SENSITIVE = /^(?:_config(?:\..+)?\.ya?ml|.*\.(?:pem|key|p12|pfx|crt|cer|der|jks|keystore|kdbx|sqlite3?|db|log)|id_(?:rsa|dsa|ecdsa|ed25519)(?:\.pub)?|.*(?:secret|credential|password|passwd|token).*|npmrc|yarnrc|netrc|htpasswd)$/i
const SKIPPED_DIRS = new Set(['node_modules', 'public', 'dist'])

const importLanguage = (name: string) => NAMED[name.toLowerCase()] || LANGUAGES[extname(name).toLowerCase()]

const normalizePath = (value: string) => value.replace(/\\/g, '/').replace(/^(?:\.?\/)+/, '').replace(/\/{2,}/g, '/')

/** Reads public examples under `<baseDir>/examples/`, applying the documented safety limits. */
function importDirectory(dir: string, options: CodeTreeOptions): { files?: CodeFile[], error?: string } {
  if (!options.baseDir) return { error: 'the blog root is unknown' }
  const requested = normalizePath(dir)
  if (requested !== EXAMPLES && !requested.startsWith(`${EXAMPLES}/`)) return { error: `only ${EXAMPLES}/ can be imported` }
  let root: string
  let target: string
  try {
    root = realpathSync(join(options.baseDir, EXAMPLES))
    target = realpathSync(resolve(options.baseDir, requested))
  } catch {
    return { error: 'the directory does not exist' }
  }
  if (target !== root && !target.startsWith(root + sep)) return { error: `the directory resolves outside ${EXAMPLES}/` }
  if (!lstatSync(target).isDirectory()) return { error: 'the path is not a directory' }

  const files: CodeFile[] = []
  let total = 0
  let stopped = false
  const walk = (folder: string) => {
    const entries = readdirSync(folder, { withFileTypes: true })
      .filter(entry => !entry.name.startsWith('.') && !entry.isSymbolicLink() && !SENSITIVE.test(entry.name))
      .sort((a, b) => Number(a.isDirectory()) - Number(b.isDirectory()) || a.name.localeCompare(b.name, 'en'))
    for (const entry of entries) {
      if (stopped) return
      if (files.length >= MAX_FILES) {
        options.warn?.(`code-tree: stopped at ${MAX_FILES} files`)
        stopped = true
        return
      }
      const path = join(folder, entry.name)
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRS.has(entry.name)) walk(path)
        continue
      }
      const language = entry.isFile() && importLanguage(entry.name)
      if (!language) continue
      const size = lstatSync(path).size
      if (size > MAX_FILE) {
        options.warn?.(`code-tree: skipped ${relative(root, path)} (over ${MAX_FILE / 1024} KB)`)
        continue
      }
      if (total + size > MAX_TOTAL) {
        options.warn?.(`code-tree: stopped at ${relative(root, path)} (over ${MAX_TOTAL / 1024} KB in total)`)
        stopped = true
        return
      }
      total += size
      files.push({ path: relative(target, path).split(sep).join('/'), language, content: readFileSync(path, 'utf8').replace(/\r\n?/g, '\n').replace(/\n$/, ''), active: false })
    }
  }
  walk(target)
  return files.length ? { files } : { error: 'no supported files were found' }
}

interface TreeNode { name: string, folders: Map<string, TreeNode>, files: Array<{ name: string, index: number }> }

function renderNav(files: CodeFile[], active: number) {
  const root: TreeNode = { name: '', folders: new Map(), files: [] }
  files.forEach((file, index) => {
    const parts = file.path.split('/')
    const name = parts.pop()!
    let node = root
    for (const part of parts) {
      if (!node.folders.has(part)) node.folders.set(part, { name: part, folders: new Map(), files: [] })
      node = node.folders.get(part)!
    }
    node.files.push({ name, index })
  })
  const entry = (icon: string, name: string) =>
    `<span class="md-tree-entry">${icon}<span class="md-tree-name">${escapeHtml(name)}</span></span>`
  // Folders keep their first-seen position relative to files, as the author ordered them.
  const render = (node: TreeNode): string => {
    const items: Array<[number, string]> = []
    node.files.forEach(file => items.push([file.index, `<li class="md-tree-file" data-type="${fileType(file.name)}"><button type="button" class="md-code-tree-file" data-code-tree-file="${file.index}" title="${escapeHtml(files[file.index].path)}"${file.index === active ? ' aria-current="true"' : ''}>${entry(FILE_ICON, file.name)}</button></li>`]))
    node.folders.forEach(folder => {
      const first = Math.min(...collect(folder))
      items.push([first, `<li class="md-tree-folder"><details open><summary>${entry(FOLDER_ICON, folder.name)}</summary><ul>${render(folder)}</ul></details></li>`])
    })
    return items.sort((a, b) => a[0] - b[0]).map(([, html]) => html).join('')
  }
  const collect = (node: TreeNode): number[] => [...node.files.map(file => file.index), ...[...node.folders.values()].flatMap(collect)]
  return `<ul class="md-tree">${render(root)}</ul>`
}

function pickActive(files: CodeFile[], entry: string) {
  if (entry) {
    const wanted = normalizePath(entry)
    const exact = files.findIndex(file => file.path === wanted)
    if (exact >= 0) return exact
    const byName = files.filter(file => file.path.split('/').pop() === wanted)
    if (byName.length === 1) return files.indexOf(byName[0])
  }
  const marked = files.findIndex(file => file.active)
  return marked >= 0 ? marked : 0
}

function parseFence(token: any, index: number): CodeFile {
  const info = token.info.trim()
  const active = /(?:^|\s):active(?=\s|$)/.test(info)
  const rest = info.replace(/(?:^|\s):active(?=\s|$)/, ' ').trim()
  const first = rest.split(/\s+/)[0] || ''
  const language = first.includes('=') ? '' : first
  const title = textAttr(parseAttrs(rest.slice(language.length)).title)
  return { path: normalizePath(title) || `file-${index + 1}${language ? `.${language}` : ''}`, language, content: token.content, active }
}

export function codeTreePlugin(md: any, t: Translate, options: CodeTreeOptions = {}) {
  registerContainer(md, 'code-tree', ({ state, startLine, endLine, directive }) => {
    const open = state.push('shokax_code_tree_open', 'figure', 1)
    open.block = true
    open.map = [startLine, endLine]
    open.meta = directive.attrs
    state.md.block.tokenize(state, startLine + 1, endLine)
    state.push('shokax_code_tree_close', 'figure', -1).block = true
  })

  // `::code-tree{dir="/examples/demo" …}` and `@[code-tree …](/examples/demo)` on their own line.
  md.block.ruler.before('fence', 'shokax_code_tree_import', (state: any, startLine: number, _endLine: number, silent: boolean) => {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false
    const line = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
    const leaf = line.match(/^::code-tree\{(.*)\}\s*$/)
    const link = !leaf && line.match(/^@\[code-tree(?:\s+([^\]]*))?\]\(([^)\s]+)\)\s*$/)
    if (!leaf && !link) return false
    const attrs: Attrs = leaf ? parseAttrs(leaf[1]) : { ...parseAttrs(link[1]), dir: link[2] }
    const dir = textAttr(attrs.dir)
    if (!dir) return false
    if (silent) return true
    const imported = importDirectory(dir, options)
    if (imported.error) options.warn?.(`code-tree: cannot import "${dir}": ${imported.error}`)
    const token = state.push('shokax_code_tree', 'figure', 0)
    token.block = true
    token.map = [startLine, startLine + 1]
    token.meta = {
      attrs,
      error: imported.error ? dir : '',
      files: (imported.files || []).map(file => {
        const fence = new state.Token('fence', 'code', 0)
        fence.info = file.language
        fence.content = `${file.content}\n`
        fence.markup = '```'
        return { ...file, token: fence }
      })
    }
    state.line = startLine + 1
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })

  // Collapse each container into one token holding its fences; other body content is dropped.
  md.core.ruler.after('block', 'shokax_code_tree_files', (state: any) => {
    const tokens = state.tokens
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'shokax_code_tree_open') continue
      const close = closingIndex(tokens, i)
      if (close < 0) continue
      const fences = tokens.slice(i + 1, close).filter((token: any) => token.type === 'fence' && token.level === tokens[i].level + 1)
      const token = new state.Token('shokax_code_tree', 'figure', 0)
      token.block = true
      token.map = tokens[i].map
      token.meta = {
        attrs: tokens[i].meta,
        error: '',
        files: fences.map((fence: any, index: number) => {
          const file = parseFence(fence, index)
          fence.info = file.language
          return { ...file, token: fence }
        })
      }
      tokens.splice(i, close - i + 1, token)
    }
  })

  md.renderer.rules.shokax_code_tree = (tokens: any[], index: number, renderOptions: any, env: any, self: any) => {
    const { attrs, error, files } = tokens[index].meta as { attrs: Attrs, error: string, files: Array<CodeFile & { token: any }> }
    const label = (key: string) => escapeHtml(t(`markdown.code_tree.${key}`))
    const title = textAttr(attrs.title) || t('markdown.code_tree.default_title')
    if (error || !files.length) {
      return `<figure class="md-code-tree is-error"><p>${label('import_error')}<code>${escapeHtml(error)}</code></p></figure>\n`
    }
    const height = HEIGHT.test(textAttr(attrs.height)) ? textAttr(attrs.height) : ''
    const icon = textAttr(attrs.icon) === 'simple' ? 'simple' : 'colored'
    const active = pickActive(files, textAttr(attrs.entry))
    const panels = files.map((file, i) => {
      const code = self.rules.fence([file.token], 0, renderOptions, env, self)
      return `<section class="md-code-tree-panel" data-code-tree-panel="${i}"${i === active ? ' data-active' : ''}>`
        + `<div class="md-code-tree-path">${escapeHtml(file.path)}</div>${code}</section>`
    }).join('')
    return `<figure class="md-code-tree" data-icon="${icon}"${height ? ` style="--md-code-tree-height: ${height}"` : ''}>`
      + '<div class="md-code-tree-bar">'
      + `<strong class="md-code-tree-title">${escapeHtml(title)}</strong>`
      + `<span class="md-code-tree-count">${escapeHtml(t('markdown.code_tree.count').replace('{count}', String(files.length)))}</span>`
      + '<div class="md-code-tree-tools">'
      + `<button type="button" data-code-tree-action="copy" data-copied="${label('copied')}" data-copy-failed="${label('copy_failed')}"><i class="ic i-clipboard" aria-hidden="true"></i><span>${label('copy')}</span></button>`
      + `<button type="button" data-code-tree-action="fullscreen" title="${label('fullscreen')}" aria-label="${label('fullscreen')}" data-exit-label="${label('exit_fullscreen')}"><i class="ic i-expand" aria-hidden="true"></i></button>`
      + '</div></div>'
      + '<div class="md-code-tree-body">'
      + `<nav class="md-code-tree-nav" aria-label="${label('files')}">${renderNav(files, active)}</nav>`
      + `<div class="md-code-tree-panels">${panels}</div>`
      + '</div></figure>\n'
  }
}
