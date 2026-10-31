/** Accept only opaque HEX or integer RGB, never arbitrary CSS. */
export function normalizeReadingColor(input: string): string | null {
  if (typeof input !== 'string') return null
  const value = input.trim()
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value)
  if (hex) return '#' + (hex[1].length === 3 ? [...hex[1]].map(channel => channel + channel).join('') : hex[1]).toUpperCase()
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(value)
  if (!rgb) return null
  const channels = rgb.slice(1).map(Number)
  return channels.every(channel => channel <= 255) ? toHex(channels) : null
}

const toHex = (channels: number[]) => '#' + channels.map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('').toUpperCase()
const channels = (hex: string) => [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16))
const linear = (channel: number) => {
  const value = channel / 255
  return value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4)
}
const encode = (value: number) => 255 * (value <= .0031308 ? 12.92 * value : 1.055 * Math.pow(value, 1 / 2.4) - .055)
const luminance = (hex: string) => channels(hex).map(linear).reduce((value, channel, index) => value + channel * [.2126, .7152, .0722][index], 0)

export function colorContrast(first: string, second: string): number {
  const a = luminance(first), b = luminance(second)
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
}

function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = channels(hex).map(linear)
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b)
  const m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b)
  const s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b)
  const a = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s
  const bb = .0259040371 * l + .7827717662 * m - .808675766 * s
  return [.2104542553 * l + .793617785 * m - .0040720468 * s, Math.hypot(a, bb), Math.atan2(bb, a)]
}

function fromOklch(lightness: number, chroma: number, hue: number): number[] | null {
  const a = chroma * Math.cos(hue), b = chroma * Math.sin(hue)
  const l = (lightness + .3963377774 * a + .2158037573 * b) ** 3
  const m = (lightness - .1055613458 * a - .0638541728 * b) ** 3
  const s = (lightness - .0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s,
    -.0041960863 * l - .7034186147 * m + 1.707614701 * s]
  return rgb.every(value => value >= -1e-6 && value <= 1 + 1e-6) ? rgb.map(value => encode(Math.min(1, Math.max(0, value)))) : null
}

/** Keep hue and as much chroma as sRGB allows at a lightness; darkening never turns muddy. */
function oklchColor(lightness: number, chroma: number, hue: number): string {
  const exact = fromOklch(lightness, chroma, hue)
  if (exact) return toHex(exact)
  let low = 0, high = chroma
  for (let step = 0; step < 16; step++) {
    const middle = (low + high) / 2
    if (fromOklch(lightness, middle, hue)) low = middle
    else high = middle
  }
  return toHex(fromOklch(lightness, low, hue)!) // Zero chroma is always inside sRGB.
}

function readableColor(seed: string, background: string, ratio: number, lighten: boolean): string {
  if (colorContrast(seed, background) >= ratio) return seed
  const [lightness, chroma, hue] = toOklch(seed)
  let low = lightness, high = lighten ? 1 : 0
  // Search the rounded sRGB color itself, so the returned CSS value meets the threshold.
  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2
    if (colorContrast(oklchColor(middle, chroma, hue), background) >= ratio) high = middle
    else low = middle
  }
  const color = oklchColor(high, chroma, hue)
  return colorContrast(color, background) >= ratio ? color : lighten ? '#FFFFFF' : '#000000'
}

export function deriveReadingColor(seed: string) {
  // Conservative neutral surfaces cover the existing light and dark content panels.
  // These are contrast reference surfaces, not a second set of brand defaults.
  const inkLight = readableColor(seed, '#F7F7F7', 4.5, false)
  const [lightness, chroma, hue] = toOklch(seed)
  return {
    seed,
    inkLight,
    inkDark: readableColor(seed, '#363636', 4.5, true),
    // WCAG large text: only bold headings of at least 18.66px may use these.
    titleLight: readableColor(seed, '#F7F7F7', 3, false),
    titleDark: readableColor(seed, '#363636', 3, true),
    // Filled controls carry short bold white labels, so they use the 3:1 component threshold;
    // the margin keeps rounded gradient midpoints above it.
    fill: readableColor(seed, '#FFFFFF', 3.05, false),
    // An analogous neighbour keeps filled gradients within one hue family.
    fillEnd: readableColor(oklchColor(lightness, chroma, hue - .5), '#FFFFFF', 3.05, false)
  }
}
