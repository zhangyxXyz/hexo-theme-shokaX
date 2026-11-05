export interface IconAdjustment {
  /** Em offset; positive values move the glyph down. */
  baseline?: number
  /** Visual size multiplier around the glyph centre; the layout box keeps its size. */
  scale?: number
  /** Extra stroke width in em; glyphs can only be thickened. */
  weight?: number
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const LIMITS: Record<keyof IconAdjustment, (value: number) => boolean> = {
  baseline: value => Math.abs(value) <= .5,
  scale: value => value >= .5 && value <= 2,
  weight: value => value >= 0 && value <= .1
}

/** A number is the legacy baseline-only form; objects may carry any of the three corrections. */
const adjustment = (value: unknown): IconAdjustment | undefined => {
  const source = finite(value) ? { baseline: value } : value
  if (!source || typeof source !== 'object' || Array.isArray(source)) return
  const result: IconAdjustment = {}
  for (const key of Object.keys(LIMITS) as Array<keyof IconAdjustment>) {
    const item = (source as Record<string, unknown>)[key]
    if (finite(item) && LIMITS[key](item)) result[key] = item
  }
  return Object.keys(result).length ? result : undefined
}

const declarations = (value: IconAdjustment, suffix = '') => [
  value.baseline !== undefined && `--icon-baseline${suffix}:${value.baseline}em`,
  value.scale !== undefined && `--icon-scale${suffix}:${value.scale}`,
  value.weight !== undefined && `--icon-weight${suffix}:${value.weight}em`
].filter(Boolean).join(';')

/** Per-icon corrections, or undefined when the data belongs to another font version. */
export function iconAdjustments(data: unknown, font: string): { default: IconAdjustment, icons: Map<string, IconAdjustment> } | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return
  const config = data as { font?: unknown; default?: unknown; icons?: unknown }
  if (typeof config.font !== 'string' || config.font !== font) return
  const icons = new Map<string, IconAdjustment>()
  if (config.icons && typeof config.icons === 'object' && !Array.isArray(config.icons)) {
    for (const [name, value] of Object.entries(config.icons)) {
      const item = /^i-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) && adjustment(value)
      if (item) icons.set(name, item)
    }
  }
  return { default: { baseline: 0, ...adjustment(config.default) }, icons }
}

export function iconBaselineCSS(data: unknown, font: string): string {
  const config = iconAdjustments(data, font)
  if (!config) return ''
  const rules = [`:root{${declarations(config.default, '-default')}}`]
  for (const [name, value] of config.icons) rules.push(`.ic.${name}{${declarations(value)}}`)
  return rules.join('\n')
}
