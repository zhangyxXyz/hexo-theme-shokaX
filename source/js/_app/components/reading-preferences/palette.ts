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
const luminance = (hex: string) => channels(hex).map(channel => {
  const value = channel / 255
  return value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4)
}).reduce((value, channel, index) => value + channel * [.2126, .7152, .0722][index], 0)

export function colorContrast(first: string, second: string): number {
  const a = luminance(first), b = luminance(second)
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
}

function readableColor(seed: string, background: string, toward: number): string {
  if (colorContrast(seed, background) >= 4.5) return seed
  const source = channels(seed)
  const mix = (amount: number) => toHex(source.map(channel => channel + (toward - channel) * amount))
  let low = 0, high = 1
  // Search the rounded sRGB color itself, so the returned CSS value meets the threshold.
  for (let step = 0; step < 20; step++) {
    const middle = (low + high) / 2
    if (colorContrast(mix(middle), background) >= 4.5) high = middle
    else low = middle
  }
  return mix(high)
}

export function deriveReadingColor(seed: string) {
  // Conservative neutral surfaces cover the existing light and dark content panels.
  // These are contrast reference surfaces, not a second set of brand defaults.
  const inkLight = readableColor(seed, '#F7F7F7', 0)
  return {
    seed,
    inkLight,
    inkDark: readableColor(seed, '#363636', 255),
    fill: inkLight // Also exceeds 4.5:1 against white text at either gradient endpoint.
  }
}
