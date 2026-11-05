import { blockHead, closingIndex, escapeHtml, registerContainer, textAttr, type Translate } from './shared'

/** `:::steps[title]` around one ordered list; any other body stays plain Markdown. */
export function stepsPlugin(md: any, t: Translate) {
  registerContainer(md, 'steps', ({ state, startLine, endLine, directive }) => {
    const meta = {
      title: directive.label || textAttr(directive.attrs.title) || directive.argument,
      start: Number.parseInt(textAttr(directive.attrs.start), 10),
      valid: false
    }
    const open = state.push('shokax_steps_open', 'section', 1)
    open.block = true
    open.map = [startLine, endLine]
    open.meta = meta
    state.md.block.tokenize(state, startLine + 1, endLine)
    state.push('shokax_steps_close', 'section', -1).meta = meta
  })

  md.core.ruler.after('block', 'shokax_steps', (state: any) => {
    const tokens = state.tokens
    tokens.forEach((token: any, index: number) => {
      if (token.type !== 'shokax_steps_open') return
      const list = tokens[index + 1]
      const close = closingIndex(tokens, index)
      if (list?.type !== 'ordered_list_open' || closingIndex(tokens, index + 1) !== close - 1) return
      token.meta.valid = true
      list.attrJoin('class', 'md-steps-list')
      const start = token.meta.start > 0 ? token.meta.start : Number(list.attrGet('start')) || 1
      if (start !== 1) {
        list.attrSet('start', String(start))
        list.attrSet('style', `counter-reset: counter ${start - 1}`)
      }
    })
  })

  md.renderer.rules.shokax_steps_open = (tokens: any[], index: number) => {
    const { valid, title } = tokens[index].meta
    if (!valid) return ''
    const label = title ? ` aria-label="${escapeHtml(title)}"` : ''
    return `<section class="md-steps"${label}>${blockHead(title, t('markdown.steps'))}\n`
  }
  md.renderer.rules.shokax_steps_close = (tokens: any[], index: number) => tokens[index].meta.valid ? '</section>\n' : ''
}
