/** Positive values move the glyph down; values are relative to its font size. */
export function iconBaselineCSS(data: unknown, font: string): string {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ''
  const config = data as { font?: unknown; default?: unknown; icons?: unknown }
  if (typeof config.font !== 'string' || config.font !== font) return ''
  const valid = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= .5
  const rules = [`:root{--icon-baseline-default:${valid(config.default) ? config.default : 0}em}`]
  if (config.icons && typeof config.icons === 'object' && !Array.isArray(config.icons)) {
    for (const [name, offset] of Object.entries(config.icons)) {
      if (/^i-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && valid(offset)) {
        rules.push(`.ic.${name}{--icon-baseline:${offset}em}`)
      }
    }
  }
  return rules.join('\n')
}
