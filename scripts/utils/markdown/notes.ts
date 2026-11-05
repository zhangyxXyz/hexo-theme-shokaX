import { escapeHtml, type Translate } from './shared'

type Kind = 'footnote' | 'annotation'

interface NoteState {
  /** Labels defined anywhere in the document, known before inline parsing. */
  defined: Set<string>
  /** Labels in order of first reference. */
  order: string[]
  refs: Map<string, number>
}

const MARKS: Record<number, Kind> = { 0x5E: 'footnote', 0x2B: 'annotation' }
const PREFIX: Record<Kind, [string, string]> = { footnote: ['fn', 'fnref'], annotation: ['note', 'noteref'] }

const notes = (env: any, kind: Kind): NoteState => {
  env.shokaxNotes ||= {}
  return env.shokaxNotes[kind] ||= { defined: new Set(), order: [], refs: new Map() }
}

const slug = (label: string) => label.trim().replace(/\s+/g, '-')

/** Reads `[^label]` / `[+label]` at `start`; returns the label and the index after `]`. */
function readLabel(src: string, start: number, max: number) {
  if (src.charCodeAt(start) !== 0x5B) return null
  const kind = MARKS[src.charCodeAt(start + 1)]
  if (!kind) return null
  for (let pos = start + 2; pos < max; pos++) {
    const code = src.charCodeAt(pos)
    if (code === 0x0A || (kind === 'footnote' && code === 0x20)) return null
    if (code === 0x5D) {
      const label = src.slice(start + 2, pos).trim()
      return label ? { kind, label, end: pos + 1 } : null
    }
  }
  return null
}

/**
 * Footnotes (`[^1]`) and inline annotations (`[+term]`). Definitions use
 * `[^1]: text` / `[+term]: text`; indented following lines belong to them.
 * Both lists render at the end, so the article still reads without scripts.
 */
export function notesPlugin(md: any, t: Translate) {
  md.block.ruler.before('reference', 'shokax_note_def', (state: any, startLine: number, endLine: number, silent: boolean) => {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false
    const start = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    const found = readLabel(state.src, start, max)
    if (!found || state.src.charCodeAt(found.end) !== 0x3A) return false
    if (silent) return true

    notes(state.env, found.kind).defined.add(found.label)
    const open = state.push('shokax_note_def_open', '', 1)
    open.meta = { kind: found.kind, label: found.label }

    // Same approach as markdown-it-footnote: tokenize the rest of the line and
    // the indented continuation as the definition body.
    const oldBMark = state.bMarks[startLine]
    const oldTShift = state.tShift[startLine]
    const oldSCount = state.sCount[startLine]
    const oldParent = state.parentType
    let pos = found.end + 1
    const afterColon = pos
    const initial = state.sCount[startLine] + pos - start
    let offset = initial
    while (pos < max) {
      const code = state.src.charCodeAt(pos)
      if (code === 0x09) offset += 4 - offset % 4
      else if (code === 0x20) offset++
      else break
      pos++
    }
    state.tShift[startLine] = pos - afterColon
    state.sCount[startLine] = offset - initial
    state.bMarks[startLine] = afterColon
    state.blkIndent += 4
    state.parentType = 'footnote'
    if (state.sCount[startLine] < state.blkIndent) state.sCount[startLine] += state.blkIndent
    state.md.block.tokenize(state, startLine, endLine, true)
    state.parentType = oldParent
    state.blkIndent -= 4
    state.tShift[startLine] = oldTShift
    state.sCount[startLine] = oldSCount
    state.bMarks[startLine] = oldBMark
    state.push('shokax_note_def_close', '', -1)
    return true
  }, { alt: ['paragraph', 'reference'] })

  md.inline.ruler.after('image', 'shokax_note_ref', (state: any, silent: boolean) => {
    const found = readLabel(state.src, state.pos, state.posMax)
    if (!found || !state.env.shokaxNotes?.[found.kind]?.defined.has(found.label)) return false
    if (!silent) {
      const store = notes(state.env, found.kind)
      if (!store.refs.has(found.label)) {
        store.order.push(found.label)
        store.refs.set(found.label, 0)
      }
      const count = store.refs.get(found.label) + 1
      store.refs.set(found.label, count)
      const token = state.push('shokax_note_ref', '', 0)
      token.meta = { kind: found.kind, label: found.label, number: store.order.indexOf(found.label) + 1, count }
    }
    state.pos = found.end
    return true
  })

  // Move definitions out of the flow and append the referenced ones in order.
  md.core.ruler.after('inline', 'shokax_note_tail', (state: any) => {
    const bodies = new Map<string, any[]>()
    const kept: any[] = []
    let current: any[] | undefined
    let key = ''
    let depth = 0
    for (const token of state.tokens) {
      if (token.type === 'shokax_note_def_open' && !current) {
        current = []
        key = `${token.meta.kind}:${token.meta.label}`
        depth = 0
        continue
      }
      if (current) {
        if (token.type === 'shokax_note_def_open') depth++
        if (token.type === 'shokax_note_def_close') {
          if (depth === 0) {
            if (!bodies.has(key)) bodies.set(key, current)
            current = undefined
            continue
          }
          depth--
        }
        current.push(token)
        continue
      }
      kept.push(token)
    }
    for (const kind of ['annotation', 'footnote'] as Kind[]) {
      const store: NoteState | undefined = state.env.shokaxNotes?.[kind]
      if (!store?.order.length) continue
      const list = new state.Token('shokax_note_list_open', '', 1)
      list.meta = { kind }
      kept.push(list)
      store.order.forEach((label, index) => {
        const item = new state.Token('shokax_note_item_open', '', 1)
        item.meta = { kind, label, number: index + 1, count: store.refs.get(label) }
        kept.push(item, ...(bodies.get(`${kind}:${label}`) || []))
        const close = new state.Token('shokax_note_item_close', '', -1)
        close.meta = item.meta
        kept.push(close)
      })
      kept.push(new state.Token('shokax_note_list_close', '', -1))
    }
    state.tokens = kept
  })

  const ids = (kind: Kind, label: string) => {
    const [note, ref] = PREFIX[kind]
    return { note: `${note}-${slug(label)}`, ref: `${ref}-${slug(label)}` }
  }

  md.renderer.rules.shokax_note_ref = (tokens: any[], index: number) => {
    const { kind, label, number, count } = tokens[index].meta
    const { note, ref } = ids(kind, label)
    const id = escapeHtml(count > 1 ? `${ref}-${count}` : ref)
    const target = escapeHtml(note)
    if (kind === 'footnote') {
      return `<sup class="md-footnote-ref"><a href="#${target}" id="${id}" data-note-ref="${target}" role="doc-noteref">${number}</a></sup>`
    }
    return `<a class="md-annotation" href="#${target}" id="${id}" data-note-ref="${target}">${escapeHtml(label)}&#8288;<span class="md-annotation-mark" aria-hidden="true">+</span></a>`
  }
  md.renderer.rules.shokax_note_list_open = (tokens: any[], index: number) => {
    const { kind } = tokens[index].meta
    const title = escapeHtml(t(kind === 'footnote' ? 'markdown.notes.footnotes' : 'markdown.notes.annotations'))
    const role = kind === 'footnote' ? ' role="doc-endnotes"' : ''
    const close = escapeHtml(t('markdown.notes.close'))
    return `<section class="md-notes is-${kind}"${role} aria-label="${title}" data-close-label="${close}"><p class="md-notes-title">${title}</p><ol>\n`
  }
  md.renderer.rules.shokax_note_list_close = () => '</ol></section>\n'
  md.renderer.rules.shokax_note_item_open = (tokens: any[], index: number) => {
    const { kind, label } = tokens[index].meta
    const term = kind === 'annotation' ? `<strong class="md-note-term">${escapeHtml(label)}</strong>` : ''
    return `<li id="${escapeHtml(ids(kind, label).note)}" class="md-note-item">${term}<div class="md-note-body">\n`
  }
  md.renderer.rules.shokax_note_item_close = (tokens: any[], index: number) => {
    const { kind, label, count } = tokens[index].meta
    const { ref } = ids(kind, label)
    const back = escapeHtml(t('markdown.notes.back'))
    const links = Array.from({ length: count }, (_, i) => {
      const id = escapeHtml(i ? `${ref}-${i + 1}` : ref)
      return `<a class="md-note-back" href="#${id}" aria-label="${back}" title="${back}">↩${count > 1 ? `<sup>${i + 1}</sup>` : ''}</a>`
    }).join('')
    return `</div>${links}</li>\n`
  }
}
