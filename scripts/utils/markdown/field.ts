import { escapeHtml, flagAttr, registerContainer, textAttr, type Translate } from './shared'

interface FieldMeta {
  name: string
  type: string
  required: boolean
  optional: boolean
  defaultValue: string
}

/**
 * `:::field name` with leading `@type`, `@required`, `@optional` and `@default`
 * lines, or the same values as `{type="string" required}` on the opener.
 */
export function fieldPlugin(md: any, t: Translate) {
  registerContainer(md, 'field-group', ({ state, startLine, endLine }) => {
    const open = state.push('shokax_field_group_open', 'div', 1)
    open.block = true
    open.map = [startLine, endLine]
    state.md.block.tokenize(state, startLine + 1, endLine)
    state.push('shokax_field_group_close', 'div', -1)
  })

  registerContainer(md, 'field', ({ state, startLine, endLine, directive }) => {
    const { attrs } = directive
    const meta: FieldMeta = {
      name: directive.label || directive.argument.replace(/^`(.*)`$/, '$1'),
      type: textAttr(attrs.type),
      required: flagAttr(attrs.required),
      optional: flagAttr(attrs.optional),
      defaultValue: textAttr(attrs.default)
    }
    let body = startLine + 1
    for (; body < endLine; body++) {
      const line = state.src.slice(state.bMarks[body] + state.tShift[body], state.eMarks[body]).trim()
      const match = line.match(/^@(type|required|optional|default)\b\s*(.*)$/)
      if (!match) break
      if (match[1] === 'type') meta.type = match[2]
      else if (match[1] === 'default') meta.defaultValue = match[2]
      else meta[match[1] as 'required' | 'optional'] = true
    }
    const open = state.push('shokax_field_open', 'section', 1)
    open.block = true
    open.map = [startLine, endLine]
    open.meta = meta
    state.md.block.tokenize(state, body, endLine)
    state.push('shokax_field_close', 'section', -1)
  })

  md.renderer.rules.shokax_field_group_open = () => '<div class="md-field-group">\n'
  md.renderer.rules.shokax_field_group_close = () => '</div>\n'
  md.renderer.rules.shokax_field_open = (tokens: any[], index: number) => {
    const meta: FieldMeta = tokens[index].meta
    const flag = meta.required
      ? `<span class="md-field-flag is-required">${escapeHtml(t('markdown.field.required'))}</span>`
      : meta.optional ? `<span class="md-field-flag">${escapeHtml(t('markdown.field.optional'))}</span>` : ''
    const type = meta.type ? `<span class="md-field-type">${escapeHtml(meta.type)}</span>` : ''
    const fallback = meta.defaultValue
      ? `<p class="md-field-default"><span>${escapeHtml(t('markdown.field.default'))}</span><code>${escapeHtml(meta.defaultValue)}</code></p>`
      : ''
    return `<section class="md-field"><header class="md-field-head"><code class="md-field-name">${escapeHtml(meta.name)}</code>${type}${flag}</header>${fallback}<div class="md-field-body">\n`
  }
  md.renderer.rules.shokax_field_close = () => '</div></section>\n'
}
