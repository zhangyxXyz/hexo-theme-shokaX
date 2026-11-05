import { escapeHtml, parseAttrs, textAttr, type Translate } from './shared'

// First keyword of a Mermaid source → `markdown.mermaid.types.*` key.
const TYPES: Array<[RegExp, string]> = [
  [/^(?:flowchart|graph)\b/, 'flowchart'],
  [/^sequenceDiagram\b/, 'sequence'],
  [/^classDiagram\b/, 'class'],
  [/^stateDiagram\b/, 'state'],
  [/^erDiagram\b/, 'er'],
  [/^gantt\b/, 'gantt'],
  [/^pie\b/, 'pie'],
  [/^journey\b/, 'journey'],
  [/^gitGraph\b/, 'git'],
  [/^mindmap\b/, 'mindmap'],
  [/^timeline\b/, 'timeline'],
  [/^quadrantChart\b/, 'quadrant'],
  [/^(?:xychart|xychart-beta)\b/, 'xychart'],
  [/^(?:sankey|sankey-beta)\b/, 'sankey']
]

/** Skips front matter, `%%` comments and directives to find the diagram keyword. */
const diagramType = (source: string) => {
  const lines = source.split(/\r?\n/)
  let index = 0
  if (lines[0]?.trim() === '---') {
    index = lines.findIndex((line, i) => i > 0 && line.trim() === '---') + 1 || lines.length
  }
  const first = lines.slice(index).map(line => line.trim()).find(line => line && !line.startsWith('%%')) || ''
  return TYPES.find(([pattern]) => pattern.test(first))?.[1] || 'diagram'
}

const ICONS = {
  in: '<i class="ic i-plus-circle-outline" aria-hidden="true"></i>',
  out: '<i class="ic i-minus-circle-outline" aria-hidden="true"></i>',
  fit: '<i class="ic i-reset" aria-hidden="true"></i>',
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
    const kind = diagramType(source)
    const type = label(`types.${kind}`)
    const button = (action: keyof typeof ICONS, text: string, extra = '') =>
      `<button type="button" data-mermaid-action="${action}" title="${text}" aria-label="${text}"${extra}>${ICONS[action]}</button>`
    return `<figure class="md-mermaid" data-mermaid-kind="${kind}" data-error-label="${label('error')}" data-unavailable-label="${label('unavailable')}">`
      + '<div class="md-mermaid-bar">'
      + `<span class="md-mermaid-type">${type}</span>`
      + (title ? `<strong class="md-mermaid-title">${escapeHtml(title)}</strong>` : '')
      + `<div class="md-mermaid-tools" role="toolbar" aria-label="${label('toolbar')}">`
      + button('in', label('zoom_in'))
      + button('out', label('zoom_out'))
      + '<output class="md-mermaid-zoom" aria-live="polite">100%</output>'
      + button('fit', label('fit'))
      + button('fullscreen', label('fullscreen'), ` data-exit-label="${label('exit_fullscreen')}"`)
      + '</div></div>'
      + `<div class="md-mermaid-canvas" role="img" aria-label="${title ? escapeHtml(title) : type}" tabindex="0"><div class="md-mermaid-stage"></div></div>`
      + `<p class="md-mermaid-help"><span class="md-mermaid-help-desktop">${label('help')}</span><span class="md-mermaid-help-touch">${label('help_touch')}</span></p>`
      + `<pre class="md-mermaid-source"><code>${escapeHtml(source)}</code></pre></figure>\n`
  }
}
