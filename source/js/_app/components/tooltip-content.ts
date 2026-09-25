type TooltipPart = { text: string } | { icon: string; color?: string }
const tokenPattern = /\{icon:(i-[a-z0-9]+(?:-[a-z0-9]+)*)(?:\|(#(?:[\da-fA-F]{6}|[\da-fA-F]{3})))?\}/g
const rendered = new WeakMap<HTMLElement, string>()

export function parseTooltipContent(value: string): TooltipPart[] {
  const parts: TooltipPart[] = []
  let cursor = 0
  for (const match of value.matchAll(tokenPattern)) {
    if (match.index > cursor) parts.push({ text: value.slice(cursor, match.index) })
    parts.push({ icon: match[1], ...(match[2] ? { color: match[2] } : {}) })
    cursor = match.index + match[0].length
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor) })
  return parts
}

export function tooltipPlainText(value: string) {
  return parseTooltipContent(value).map(part => 'text' in part ? part.text : '').join('').replace(/[ \t]{2,}/g, ' ').trim()
}

// Cache the source string, not textContent: icons have no text. Otherwise the
// tooltip's own DOM mutations would cause an endless observer/render cycle.
export function renderTooltipContent(target: HTMLElement, value: string) {
  if (rendered.get(target) === value) return false
  rendered.set(target, value)
  const doc = target.ownerDocument
  const nodes = parseTooltipContent(value).map(part => {
    if ('text' in part) return doc.createTextNode(part.text)
    const icon = doc.createElement('i')
    icon.className = `ic tooltip-inline-icon ${part.icon}`
    icon.setAttribute('aria-hidden', 'true')
    if (part.color) icon.style.color = part.color
    return icon
  })
  target.replaceChildren(...nodes)
  return true
}
