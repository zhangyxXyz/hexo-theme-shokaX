import { closingIndex, escapeHtml, registerContainer, textAttr } from './shared'

const ASPECT = /^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/

/** `:::grid{columns="3" aspect="16/10" fit="cover"}` around Markdown images. */
export function gridPlugin(md: any) {
  registerContainer(md, 'grid', ({ state, startLine, endLine, directive }) => {
    const { attrs } = directive
    const columns = Number.parseInt(textAttr(attrs.columns), 10)
    const aspect = textAttr(attrs.aspect)
    const open = state.push('shokax_grid_open', 'div', 1)
    open.block = true
    open.map = [startLine, endLine]
    open.meta = {
      columns: columns >= 1 && columns <= 6 ? columns : 3,
      aspect: ASPECT.test(aspect) ? aspect.replace(/\s+/g, '').replace('/', ' / ') : '',
      fit: textAttr(attrs.fit) === 'contain' ? 'contain' : 'cover',
      images: [] as any[]
    }
    state.md.block.tokenize(state, startLine + 1, endLine)
    state.push('shokax_grid_close', 'div', -1).meta = open.meta
  })

  // Only images (and the line breaks between them) become cards; any other
  // content keeps the whole block as ordinary Markdown so nothing is dropped.
  md.core.ruler.after('inline', 'shokax_grid', (state: any) => {
    const tokens = state.tokens
    for (let index = 0; index < tokens.length; index++) {
      const token = tokens[index]
      if (token.type !== 'shokax_grid_open') continue
      const close = closingIndex(tokens, index)
      const images: any[] = []
      const valid = tokens.slice(index + 1, close).every((child: any) => {
        if (child.type === 'paragraph_open' || child.type === 'paragraph_close') return true
        if (child.type !== 'inline') return false
        return child.children.every((part: any) => {
          if (part.type === 'image') { images.push(part); return true }
          return part.type === 'softbreak' || part.type === 'hardbreak' || (part.type === 'text' && !part.content.trim())
        })
      })
      if (!valid || !images.length) {
        token.meta.images = null
        continue
      }
      token.meta.images = images
      tokens.splice(index + 1, close - index - 1)
    }
  })

  md.renderer.rules.shokax_grid_open = (tokens: any[], index: number, options: any, env: any, self: any) => {
    const { columns, aspect, fit, images } = tokens[index].meta
    if (!images) return ''
    const items = images.map((image: any) => {
      const alt = self.renderInlineAsText(image.children, options, env)
      const caption = image.attrGet('title') || alt
      return `<figure class="md-grid-item"><img src="${escapeHtml(image.attrGet('src'))}" alt="${escapeHtml(alt)}" decoding="async">${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}</figure>`
    }).join('')
    return `<div class="md-grid" data-columns="${columns}" data-fit="${fit}"${aspect ? ` style="--md-grid-aspect: ${aspect}"` : ''}>${items}`
  }
  md.renderer.rules.shokax_grid_close = (tokens: any[], index: number) => tokens[index].meta.images ? '</div>\n' : ''
}
