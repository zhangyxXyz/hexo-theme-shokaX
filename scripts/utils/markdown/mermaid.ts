import { escapeHtml, parseAttrs, textAttr, type Translate } from './shared'

// First keyword of a Mermaid source → kind and its name, shown untranslated like code language names.
const TYPES: Array<[RegExp, string, string]> = [
  [/^(?:flowchart|graph)\b/, 'flowchart', 'Flowchart'],
  [/^sequenceDiagram\b/, 'sequence', 'Sequence'],
  [/^classDiagram\b/, 'class', 'Class'],
  [/^stateDiagram\b/, 'state', 'State'],
  [/^erDiagram\b/, 'er', 'ER'],
  [/^gantt\b/, 'gantt', 'Gantt'],
  [/^pie\b/, 'pie', 'Pie'],
  [/^journey\b/, 'journey', 'Journey'],
  [/^gitGraph\b/, 'git', 'Git Graph'],
  [/^mindmap\b/, 'mindmap', 'Mindmap'],
  [/^timeline\b/, 'timeline', 'Timeline'],
  [/^quadrantChart\b/, 'quadrant', 'Quadrant'],
  [/^(?:xychart|xychart-beta)\b/, 'xychart', 'XY Chart'],
  [/^(?:sankey|sankey-beta)\b/, 'sankey', 'Sankey']
]

/** Skips front matter, `%%` comments and directives to find the diagram keyword. */
const diagramType = (source: string) => {
  const lines = source.split(/\r?\n/)
  let index = 0
  if (lines[0]?.trim() === '---') {
    index = lines.findIndex((line, i) => i > 0 && line.trim() === '---') + 1 || lines.length
  }
  const first = lines.slice(index).map(line => line.trim()).find(line => line && !line.startsWith('%%')) || ''
  const match = TYPES.find(([pattern]) => pattern.test(first))
  return match ? { kind: match[1], name: match[2] } : { kind: 'diagram', name: 'Mermaid' }
}

const ICONS = {
  in: '<i class="ic i-plus" aria-hidden="true"></i>',
  out: '<i class="ic i-minus" aria-hidden="true"></i>',
  fit: '<i class="ic i-focus-center" aria-hidden="true"></i>',
  source: '<i class="ic i-code" aria-hidden="true"></i>',
  fullscreen: '<i class="ic i-expand" aria-hidden="true"></i>'
}

/** ```mermaid fences become placeholders rendered by the browser; the source stays readable without JS. */
export function mermaidPlugin(md: any, t: Translate) {
  md.core.ruler.after('block', 'shokax_mermaid_fence', (state: any) => {
    for (const token of state.tokens) {
      if (token.type === 'fence' && /^mermaid(?:\s|$)/.test(token.info.trim())) token.type = 'shokax_mermaid'
    }
  })

  md.renderer.rules.shokax_mermaid = (tokens: any[], index: number) => {
    const token = tokens[index]
    const source = token.content.replace(/\s+$/, '')
    const title = textAttr(parseAttrs(token.info.trim().slice('mermaid'.length)).title)
    const label = (key: string) => escapeHtml(t(`markdown.mermaid.${key}`))
    const { kind, name } = diagramType(source)
    const type = escapeHtml(name)
    const button = (action: keyof typeof ICONS, text: string, extra = '') =>
      `<button type="button" data-mermaid-action="${action}" title="${text}" aria-label="${text}"${extra}>${ICONS[action]}</button>`
    // Highlighted like any fence, so the source view and the no-script fallback read as a code block.
    const highlighted = md.options.highlight?.(source, 'mermaid', '')
    const code = typeof highlighted === 'string' && highlighted.trim()
      ? highlighted
      : `<pre><code class="language-mermaid">${escapeHtml(source)}</code></pre>`
    return `<figure class="md-mermaid" data-mermaid-kind="${kind}" data-error-label="${label('error')}" data-unavailable-label="${label('unavailable')}" data-diagram-label="${label('diagram')}">`
      + '<div class="md-mermaid-bar">'
      + `<button type="button" class="md-mermaid-heading" data-mermaid-action="heading" title="${label('fullscreen')}">`
      + '<span class="md-mermaid-dots" aria-hidden="true"></span>'
      + `<span class="md-mermaid-type">${type}</span>`
      + (title ? `<span class="md-mermaid-title">${escapeHtml(title)}</span>` : '')
      + '</button>'
      + `<div class="md-mermaid-tools" role="toolbar" aria-label="${label('toolbar')}">`
      + button('out', label('zoom_out'))
      + '<output class="md-mermaid-zoom" aria-live="polite">100%</output>'
      + button('in', label('zoom_in'))
      + button('fit', label('fit'))
      + '<span class="md-mermaid-sep" aria-hidden="true"></span>'
      + button('source', label('source'))
      + button('fullscreen', label('fullscreen'), ` data-exit-label="${label('exit_fullscreen')}"`)
      + '</div></div>'
      + `<div class="md-mermaid-canvas" role="img" aria-label="${title ? escapeHtml(title) : type}" tabindex="0"><div class="md-mermaid-stage"></div></div>`
      + `<div class="md-mermaid-source">${code}</div></figure>`
      // Language strings mark keys with <kbd>, so they are inserted as-is.
      + `<p class="md-mermaid-help"><span class="md-mermaid-help-desktop">${t('markdown.mermaid.help')}</span><span class="md-mermaid-help-touch">${t('markdown.mermaid.help_touch')}</span></p>\n`
  }
}
