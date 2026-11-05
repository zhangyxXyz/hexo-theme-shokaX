export type Translate = (key: string) => string

export type Attrs = Record<string, string | true>

export interface Directive {
  label?: string
  argument: string
  attrs: Attrs
}

export const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

export const textAttr = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export const flagAttr = (value: unknown) => value === true || value === 'true'

export function parseAttrs(source = ''): Attrs {
  const attrs: Attrs = {}
  const pattern = /([A-Za-z_][\w-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'}]+)))?/g
  for (const match of source.matchAll(pattern)) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4] ?? true
  }
  return attrs
}

/** Parses the text after a directive name: `[label] argument {key="value" flag}`. */
export function parseDirective(rest: string): Directive {
  const match = rest.match(/^\s*(?:\[([^\]]*)\])?\s*([^{]*?)\s*(?:\{(.*)\})?\s*$/)
  if (!match) return { argument: rest.trim(), attrs: {} }
  return { label: match[1]?.trim(), argument: match[2].trim(), attrs: parseAttrs(match[3]) }
}

export const blockHead = (title: string, eyebrow: string, tag = 'header') => title
  ? `<${tag} class="md-block-head"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(eyebrow)}</span></${tag}>`
  : ''

export interface ContainerContext {
  state: any
  startLine: number
  /** First line after the container body (the closing marker line when present). */
  endLine: number
  directive: Directive
}

const COLON = 0x3A

/**
 * Registers a `:::name` block. Unlike the bundled markdown-it-container, the
 * handler owns the body, so it can tokenize, skip or parse raw lines itself.
 * Nested blocks close only on a marker at least as long as their opener.
 */
export function registerContainer(md: any, name: string, handler: (context: ContainerContext) => void) {
  md.block.ruler.before('fence', `shokax_${name.replace(/-/g, '_')}`, (state: any, startLine: number, endLine: number, silent: boolean) => {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false
    let start = state.bMarks[startLine] + state.tShift[startLine]
    let max = state.eMarks[startLine]
    if (state.src.charCodeAt(start) !== COLON) return false
    let pos = start + 1
    while (pos < max && state.src.charCodeAt(pos) === COLON) pos++
    const count = pos - start
    if (count < 3) return false
    const params = state.src.slice(pos, max).trimStart()
    if (!params.startsWith(name) || !/^(?:$|[\s{[])/.test(params.slice(name.length))) return false
    if (silent) return true

    let nextLine = startLine
    let closed = false
    while (++nextLine < endLine) {
      start = state.bMarks[nextLine] + state.tShift[nextLine]
      max = state.eMarks[nextLine]
      if (start < max && state.sCount[nextLine] < state.blkIndent) break
      if (state.src.charCodeAt(start) !== COLON || state.sCount[nextLine] - state.blkIndent >= 4) continue
      let end = start + 1
      while (end < max && state.src.charCodeAt(end) === COLON) end++
      if (end - start < count || state.src.slice(end, max).trim()) continue
      closed = true
      break
    }

    const oldParent = state.parentType
    const oldLineMax = state.lineMax
    state.parentType = 'container'
    state.lineMax = nextLine
    handler({ state, startLine, endLine: nextLine, directive: parseDirective(params.slice(name.length)) })
    state.parentType = oldParent
    state.lineMax = oldLineMax
    state.line = nextLine + (closed ? 1 : 0)
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })
}

/** Raw source lines of a container body with the shared indentation removed. */
export function bodyLines(state: any, startLine: number, endLine: number) {
  const lines: string[] = []
  for (let line = startLine + 1; line < endLine; line++) {
    lines.push(state.src.slice(state.bMarks[line], state.eMarks[line]).replace(/\t/g, '    '))
  }
  const indents = lines.filter(line => line.trim()).map(line => line.match(/^ */)[0].length)
  const shared = indents.length ? Math.min(...indents) : 0
  return lines.map(line => line.slice(Math.min(shared, line.match(/^ */)[0].length)))
}

/** Index of the token closing the block opened at `index`. */
export function closingIndex(tokens: any[], index: number) {
  const level = tokens[index].level
  for (let i = index + 1; i < tokens.length; i++) {
    if (tokens[i].level === level && tokens[i].nesting === -1) return i
  }
  return -1
}
