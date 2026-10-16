import assert from 'node:assert/strict'
import { build } from 'esbuild'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../source/js/_app/components/', import.meta.url))
const bundle = await build({
  entryPoints: [source + 'reading-preferences.ts'], bundle: true, platform: 'node', format: 'cjs', write: false
})
const defaults = { enabled: true, darkmode: false, auto_dark: { enable: true, start: 21, end: 8 } }
const sitePalette = { primary: '#3469B8', secondary: '#4EAAD5' }
const bootstrap = await build({
  entryPoints: [source + 'reading-preferences/bootstrap.ts'], bundle: true, platform: 'browser', format: 'iife', write: false
})
const paletteBundle = await build({
  entryPoints: [source + 'reading-preferences/palette.ts'], bundle: true, platform: 'node', format: 'cjs', write: false
})
const paletteModule = { exports: {} }
vm.runInNewContext(paletteBundle.outputFiles[0].text, { module: paletteModule, exports: {} })
const { colorContrast, deriveReadingColor } = paletteModule.exports

const key = 'shokax.reading.preferences'
function setup({ saved = {}, blocked = false, enabled = true, hour = 14, systemDark = false, systemReduce = false,
  primarySeed = '#e9546b', secondarySeed = '#ec8c69', palette } = {}) {
  const values = new Map(Object.entries(saved))
  const attributes = new Map(), styles = new Map()
  const root = {
    setAttribute: (name, value) => attributes.set(name, value), removeAttribute: name => attributes.delete(name),
    style: { setProperty: (name, value) => styles.set(name, value), removeProperty: name => styles.delete(name) }
  }
  class Query extends EventTarget {
    constructor(matches) { super(); this.matches = matches }
    set(matches) { this.matches = matches; this.dispatchEvent(new Event('change')) }
  }
  const motion = new Query(systemReduce), color = new Query(systemDark)
  const document = Object.assign(new EventTarget(), { documentElement: root, hidden: false })
  const window = new EventTarget()
  const storage = {
    getItem(name) { if (blocked) throw Error('blocked'); return values.get(name) ?? null },
    setItem(name, value) { if (blocked) throw Error('blocked'); values.set(name, String(value)) },
    removeItem(name) { if (blocked) throw Error('blocked'); values.delete(name) }
  }
  class Clock extends Date { getHours() { return hour } }
  const context = { module: { exports: {} }, exports: {}, document, window, localStorage: storage,
    matchMedia: media => media.includes('reduced') ? motion : color, Date: Clock,
    getComputedStyle: () => ({ getPropertyValue: name => styles.get(name) ?? (name === '--theme-primary-seed' ? primarySeed : name === '--theme-secondary-seed' ? secondarySeed : '') }),
    shokax_READING_DEFAULTS: { ...defaults, enabled, palette },
    shokax_CONFIG: { reading_settings: { enable: enabled }, darkmode: defaults.darkmode, auto_dark: defaults.auto_dark, palette } }
  vm.runInNewContext(bundle.outputFiles[0].text, context)
  return { api: context.module.exports, context, values, attributes, styles, motion, color, document, window }
}

// Importing must not touch storage, browser globals or DOM nodes.
const inert = { module: { exports: {} }, exports: {} }
vm.runInNewContext(bundle.outputFiles[0].text, inert)
assert.equal(typeof inert.module.exports.getReadingPreferences, 'function')

for (const raw of ['broken', '[]', 'null', '{"version":3,"theme":"light"}']) {
  const env = setup({ saved: { [key]: raw, theme: 'dark' } })
  env.api.initReadingPreferences()
  assert.equal(env.api.getReadingPreferences().theme, 'dark', 'invalid versions retain a valid legacy theme')
  assert.equal(env.attributes.get('data-theme'), 'dark')
}
{
  const env = setup({ saved: { [key]: JSON.stringify({ version: 1, theme: 'constructor', motion: 'yes', fontScale: 99, lineHeight: 'huge', extra: 1 }) } })
  assert.equal(JSON.stringify(env.api.getReadingPreferences()), JSON.stringify({ fontScale: 1, lineHeight: 'default', theme: 'default', motion: 'system',
    primaryColor: null, secondaryColor: null, background: 'banner', texture: 'none', textureIntensity: 12, homeLayout: 'list' }))
  env.api.initReadingPreferences()
  assert.equal(env.styles.size, 0)
  assert.equal(env.attributes.size, 0)
}
{
  const env = setup({ saved: { [key]: JSON.stringify({ version: 1, fontScale: 1.125, lineHeight: 'compact', theme: 'system', motion: 'reduce', primaryColor: '#000', homeLayout: 'grid' }) } })
  const state = env.api.getReadingPreferences()
  assert.equal(state.fontScale, 1.125)
  assert.equal(state.lineHeight, 'compact')
  assert.equal(state.theme, 'system')
  assert.equal(state.motion, 'reduce')
  assert.equal(state.primaryColor, null, 'v1 migration reads only its original fields')
  assert.equal(state.homeLayout, 'list')
  env.api.setReadingPreferences({ texture: 'dots' })
  assert.equal(JSON.parse(env.values.get(key)).version, 2)
}
{
  const env = setup()
  for (const [input, expected] of [['#abc', '#AABBCC'], [' #aB12eF ', '#AB12EF'], ['rgb(0, 128, 255)', '#0080FF'], ['RGB( 255 , 0 , 10 )', '#FF000A']]) {
    assert.equal(env.api.normalizeReadingColor(input), expected)
  }
  for (const invalid of ['', '#abcd', '#aabbccdd', 'red', 'ffffff', 'rgb(256,0,0)', 'rgb(-1,0,0)', 'rgb(1.5,2,3)',
    'rgb(10% 20% 30%)', 'rgb(1 2 3)', 'rgba(1,2,3,1)', 'var(--primary-color)', '#fff; color:red', 'url(x)', null]) {
    assert.equal(env.api.normalizeReadingColor(invalid), null, `reject unsupported CSS ${invalid}`)
  }
  assert.equal(env.api.getReadingPalette().primary, '#E9546B')
  assert.equal(env.api.getReadingPalette().secondary, '#EC8C69')
  assert.equal(env.api.setReadingPreferences({ primaryColor: '#abc', texture: 'stars', textureIntensity: 20, background: 'gradient', homeLayout: 'grid', fontScale: 1.25 }), true)
  assert.equal(env.api.getReadingPalette().primary, '#AABBCC')
  assert.equal(env.api.getReadingPalette().secondary, '#EC8C69')
  assert.equal(env.styles.get('--reading-primary-seed'), '#AABBCC')
  assert.equal(env.attributes.get('data-reading-palette'), 'custom')
  assert.equal(env.styles.has('--reading-secondary-seed'), false, 'a single custom side must leave its CSS fallback untouched')
  assert.equal(env.styles.get('--reading-texture-opacity'), '0.2')
  assert.equal(env.attributes.get('data-reading-texture'), 'stars')
  assert.equal(env.attributes.get('data-reading-background'), 'gradient')
  assert.equal(env.attributes.get('data-reading-home-layout'), 'grid')
  env.api.setReadingPreferences({ primaryColor: 'var(--invalid)', secondaryColor: 'rgb(12,34,56)', textureIntensity: 26 })
  assert.equal(env.api.getReadingPreferences().primaryColor, '#AABBCC')
  assert.equal(env.api.getReadingPreferences().textureIntensity, 20)
  assert.equal(env.styles.get('--reading-secondary-seed'), '#0C2238')
  env.api.setReadingPreferences({ primaryColor: null, secondaryColor: null })
  assert.equal(env.attributes.has('data-reading-palette'), false)
  assert.equal([...env.styles.keys()].some(name => /--reading-(primary|secondary)-/.test(name)), false)
  assert.equal(env.api.getReadingPreferences().fontScale, 1.25, 'palette reset leaves reading choices intact')
  assert.equal(env.attributes.get('data-reading-home-layout'), 'grid', 'palette reset leaves layout intact')
  for (const intensity of [5, 12, 25]) {
    env.api.setReadingPreferences({ textureIntensity: intensity })
    assert.equal(env.api.getReadingPreferences().textureIntensity, intensity)
  }
  for (const intensity of [0, 4, 26, 12.5, '12', NaN, Infinity]) {
    env.api.setReadingPreferences({ textureIntensity: intensity })
    assert.equal(env.api.getReadingPreferences().textureIntensity, 25)
  }
  env.api.setReadingPreferences({ background: 'banner', texture: 'none', homeLayout: 'list' })
  assert.equal(env.attributes.has('data-reading-background'), false)
  assert.equal(env.attributes.has('data-reading-texture'), false)
  assert.equal(env.attributes.has('data-reading-home-layout'), false)
  assert.equal(env.styles.has('--reading-texture-opacity'), false)
  env.api.setReadingPreferences({ secondaryColor: '#000' })
  assert.equal(env.styles.has('--reading-primary-seed'), false, 'secondary-only customization does not synthesize a primary color')
  env.api.resetReadingPreferences()
  assert.equal(env.styles.size, 0)
  assert.equal(env.attributes.size, 0)
}
{
  const env = setup({ primarySeed: '', secondarySeed: '' })
  assert.equal(env.api.getReadingPalette().primary, null, 'no JS brand fallback before CSS loads')
  assert.equal(env.api.getReadingPalette().secondary, null)
}
{
  const env = setup({ palette: sitePalette, primarySeed: '', secondarySeed: '', saved: { 'shokax.music.visualizer': 'on' } })
  assert.equal(env.api.getReadingPalette().primary, sitePalette.primary, 'configured defaults are available before the color sheet loads')
  assert.equal(env.api.getReadingPalette().secondary, sitePalette.secondary)
  env.api.initReadingPreferences()
  assert.equal(env.attributes.get('data-reading-palette'), 'theme')
  assert.equal(env.api.getReadingPreferences().primaryColor, null)
  assert.equal(env.api.getReadingPreferences().secondaryColor, null)
  assert.equal(env.values.has(key), false, 'first visit must not persist site defaults as visitor choices')
  for (const name of ['primary', 'secondary']) {
    assert.equal(env.styles.get(`--theme-${name}-seed`), sitePalette[name])
    assert.equal(env.styles.get(`--reading-${name}-seed`), sitePalette[name])
    assert.ok(colorContrast(env.styles.get(`--reading-${name}-ink-light`), '#F7F7F7') >= 4.5)
    assert.ok(colorContrast(env.styles.get(`--reading-${name}-ink-dark`), '#363636') >= 4.5)
    assert.ok(colorContrast(env.styles.get(`--reading-${name}-fill`), '#FFFFFF') >= 4.5)
  }
  env.api.setReadingPreferences({ fontScale: 1.25, lineHeight: 'relaxed', homeLayout: 'grid', theme: 'light' })
  let saved = JSON.parse(env.values.get(key))
  assert.equal(saved.primaryColor, null, 'saving another preference must not pin the site palette')
  assert.equal(saved.secondaryColor, null)
  env.api.setReadingPreferences({ primaryColor: '#abc' })
  assert.equal(env.attributes.get('data-reading-palette'), 'custom')
  assert.equal(env.styles.get('--reading-primary-seed'), '#AABBCC')
  assert.equal(env.styles.get('--reading-secondary-seed'), sitePalette.secondary, 'the untouched side inherits the configured default')
  assert.equal(env.styles.get('--theme-primary-seed'), sitePalette.primary, 'a visitor color cannot replace the reset target')
  env.api.setReadingPreferences({ primaryColor: null, secondaryColor: '#ff0' })
  assert.equal(env.styles.get('--reading-primary-seed'), sitePalette.primary)
  assert.equal(env.styles.get('--reading-secondary-seed'), '#FFFF00')
  env.api.setReadingPreferences({ primaryColor: null, secondaryColor: null })
  assert.equal(env.attributes.get('data-reading-palette'), 'theme', 'palette reset restores the site palette rather than the historical colors')
  assert.equal(env.api.getReadingPalette().primary, sitePalette.primary)
  assert.equal(env.api.getReadingPalette().secondary, sitePalette.secondary)
  assert.equal(env.attributes.get('data-reading-font'), 'larger')
  assert.equal(env.attributes.get('data-reading-line-height'), 'relaxed')
  assert.equal(env.attributes.get('data-reading-home-layout'), 'grid')
  assert.equal(env.api.getReadingPreferences().theme, 'light')
  saved = JSON.parse(env.values.get(key))
  assert.equal(saved.primaryColor, null)
  assert.equal(saved.secondaryColor, null)
  env.api.resetReadingPreferences()
  assert.deepEqual([...env.attributes], [['data-reading-palette', 'theme']])
  assert.equal(env.styles.get('--reading-primary-seed'), sitePalette.primary)
  assert.equal(env.styles.get('--reading-secondary-seed'), sitePalette.secondary)
  assert.equal(env.values.has(key), false)
  assert.equal(env.values.has('theme'), false)
  assert.equal(env.values.get('shokax.music.visualizer'), 'on')
}
{
  const raw = JSON.stringify({ version: 2, primaryColor: '#128C9F', secondaryColor: '#56B7A7', fontScale: 1.125 })
  const env = setup({ palette: sitePalette, saved: { [key]: raw } })
  env.api.initReadingPreferences()
  assert.equal(env.attributes.get('data-reading-palette'), 'custom')
  assert.equal(env.styles.get('--reading-primary-seed'), '#128C9F', 'a new site default preserves existing visitor colors')
  assert.equal(env.styles.get('--reading-secondary-seed'), '#56B7A7')
  assert.equal(env.values.get(key), raw, 'initialization must not rewrite existing preferences')
}
for (const palette of [{}, { primary: '', secondary: null }, { primary: 'red', secondary: 'var(--bad)' },
  { primary: '#12345678', secondary: 'rgb(256,0,0)' }, { primary: 123, secondary: {} }]) {
  const env = setup({ palette })
  env.api.initReadingPreferences()
  assert.equal(env.attributes.has('data-reading-palette'), false, 'empty or invalid configuration retains the original color sheet')
  assert.equal(env.styles.size, 0)
  assert.equal(env.api.getReadingPalette().primary, '#E9546B')
  assert.equal(env.api.getReadingPalette().secondary, '#EC8C69')
}
{
  const env = setup({ palette: { primary: 'url(x)', secondary: 'rgb(78,170,213)' } })
  env.api.initReadingPreferences()
  assert.equal(env.attributes.get('data-reading-palette'), 'theme')
  assert.equal(env.styles.has('--reading-primary-seed'), false, 'an invalid side must not suppress the other valid configured color')
  assert.equal(env.styles.get('--reading-secondary-seed'), sitePalette.secondary)
  assert.equal(env.api.getReadingPalette().primary, '#E9546B')
  assert.equal(env.api.getReadingPalette().secondary, sitePalette.secondary)
}
{
  const raw = JSON.stringify({ version: 2, primaryColor: '#FF0000', secondaryColor: '#00FF00', fontScale: 1.25 })
  const env = setup({ palette: sitePalette, enabled: false, saved: { [key]: raw } })
  env.api.initReadingPreferences()
  assert.equal(env.attributes.get('data-reading-palette'), 'theme', 'site palette works independently of the visitor settings switch')
  assert.equal(env.styles.get('--reading-primary-seed'), sitePalette.primary)
  assert.equal(env.styles.get('--reading-secondary-seed'), sitePalette.secondary)
  env.api.setReadingPreferences({ primaryColor: '#FF0000', secondaryColor: '#00FF00', fontScale: 1.25 })
  assert.equal(env.api.getReadingPreferences().fontScale, 1)
  assert.equal(env.api.getReadingPreferences().primaryColor, null)
  assert.equal(env.values.get(key), raw, 'disabled preferences leave the stored choices available for re-enabling')
  assert.equal(env.attributes.get('data-reading-palette'), 'theme')
}
{
  const env = setup({ palette: sitePalette, blocked: true })
  env.api.initReadingPreferences()
  assert.equal(env.attributes.get('data-reading-palette'), 'theme', 'blocked storage does not disable the site palette')
  assert.equal(env.api.setReadingPreferences({ primaryColor: '#abc' }), false)
  assert.equal(env.styles.get('--reading-primary-seed'), '#AABBCC')
  assert.equal(env.styles.get('--reading-secondary-seed'), sitePalette.secondary)
  assert.equal(env.api.resetReadingPreferences(), false)
  assert.equal(env.attributes.get('data-reading-palette'), 'theme')
  assert.equal(env.styles.get('--reading-primary-seed'), sitePalette.primary)
}
{
  const env = setup({ saved: { [key]: JSON.stringify({ version: 2, primaryColor: 'rgba(1,2,3,0)', secondaryColor: '#12345',
    background: 'url(x)', texture: '__proto__', textureIntensity: 900, homeLayout: 'six-columns' }) } })
  env.api.initReadingPreferences()
  assert.equal(env.api.getReadingPreferences().primaryColor, null)
  assert.equal(env.api.getReadingPreferences().secondaryColor, null)
  assert.equal(env.api.getReadingPreferences().textureIntensity, 12)
  assert.equal(env.attributes.size, 0)
  assert.equal(env.styles.size, 0)
}
assert.equal(colorContrast('#000000', '#FFFFFF'), 21)
for (const red of [0, 32, 64, 128, 192, 255]) for (const green of [0, 32, 64, 128, 192, 255]) for (const blue of [0, 32, 64, 128, 192, 255]) {
  const seed = '#' + [red, green, blue].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()
  const colors = deriveReadingColor(seed)
  assert.equal(colors.seed, seed, 'color pickers retain the requested seed')
  for (const surface of ['#FDFDFD', '#F7F7F7']) assert.ok(colorContrast(colors.inkLight, surface) >= 4.5, `${seed} light text`)
  for (const surface of ['#21252B', '#363636']) assert.ok(colorContrast(colors.inkDark, surface) >= 4.5, `${seed} dark text`)
  assert.ok(colorContrast(colors.fill, '#FFFFFF') >= 4.5, `${seed} white label on filled controls`)
}
const gradientColors = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF'].map(seed => deriveReadingColor(seed).fill)
for (const first of gradientColors) for (const second of gradientColors) for (const amount of [0, .25, .5, .75, 1]) {
  const mixed = '#' + [1, 3, 5].map(index => {
    const a = Number.parseInt(first.slice(index, index + 2), 16), b = Number.parseInt(second.slice(index, index + 2), 16)
    return Math.round(a + (b - a) * amount).toString(16).padStart(2, '0')
  }).join('')
  assert.ok(colorContrast(mixed, '#FFFFFF') >= 4.5, 'white text stays readable between filled gradient endpoints')
}
for (const hour of [0, 8, 21, 23]) {
  const env = setup({ hour })
  env.api.initReadingPreferences()
  assert.equal(env.attributes.get('data-theme'), 'dark', 'default preserves the inclusive overnight schedule')
}
{
  const env = setup({ saved: { theme: 'light' }, hour: 23, systemDark: true })
  env.api.initReadingPreferences()
  assert.equal(env.attributes.has('data-theme'), false, 'legacy explicit light overrides the schedule')
  env.color.set(false); env.color.set(true)
  assert.equal(env.attributes.has('data-theme'), false, 'system events cannot override manual light')
  env.api.setReadingPreferences({ theme: 'system' })
  assert.equal(env.values.has('theme'), false)
  assert.equal(env.attributes.get('data-theme'), 'dark')
  env.color.set(false)
  assert.equal(env.attributes.has('data-theme'), false)
  env.api.setReadingPreferences({ theme: 'default' })
  assert.equal(env.attributes.get('data-theme'), 'dark', 'default restores the site schedule')
}
{
  const env = setup({ saved: { theme: 'dark', 'shokax.music.visualizer': 'on', playing: 'retained' } })
  const updates = [], motion = []
  const lifecycle = new AbortController()
  const unsubscribe = env.api.subscribeReadingPreferences(state => updates.push(state.fontScale))
  env.api.subscribeReducedMotion(value => motion.push(value), { signal: lifecycle.signal })
  env.api.initReadingPreferences(); env.api.initReadingPreferences()
  assert.equal(env.api.setReadingPreferences({ fontScale: 1.25, lineHeight: 'relaxed' }), true)
  assert.equal(env.styles.get('--reading-font-scale'), '1.25')
  assert.equal(env.attributes.get('data-reading-font'), 'larger')
  assert.equal(env.attributes.get('data-reading-line-height'), 'relaxed')
  env.api.setReadingPreferences({ fontScale: -2, motion: 'invalid' })
  assert.equal(env.api.getReadingPreferences().fontScale, 1.25, 'invalid changes preserve the valid current value')
  env.api.setReadingPreferences({ motion: 'reduce' })
  env.motion.set(true)
  env.api.setReadingPreferences({ motion: 'system' })
  assert.deepEqual(motion, [true], 'system reduce cannot be overridden, with no duplicate notifications')
  env.motion.set(false)
  assert.deepEqual(motion, [true, false])
  assert.equal(env.attributes.has('data-motion'), false)
  lifecycle.abort(); unsubscribe()
  const previousCount = updates.length
  env.api.setReadingPreferences({ motion: 'reduce' })
  assert.equal(updates.length, previousCount)
  assert.deepEqual(motion, [true, false])
  assert.equal(env.api.resetReadingPreferences(), true)
  assert.equal(env.values.has(key), false)
  assert.equal(env.values.has('theme'), false)
  assert.equal(env.values.get('shokax.music.visualizer'), 'on')
  assert.equal(env.values.get('playing'), 'retained')
  assert.equal(env.styles.size, 0)
}
{
  const env = setup({ blocked: true })
  assert.equal(env.api.setReadingPreferences({ fontScale: 1.125 }), false)
  assert.equal(env.attributes.get('data-reading-font'), 'large', 'storage failures must not block immediate changes')
  assert.equal(env.api.resetReadingPreferences(), false)
  assert.equal(env.attributes.has('data-reading-font'), false)
}
{
  const env = setup({ enabled: false, saved: { [key]: JSON.stringify({ version: 2, theme: 'light', fontScale: 1.25, motion: 'reduce',
    primaryColor: '#FF0000', secondaryColor: '#00FF00', texture: 'sakura', textureIntensity: 25, background: 'gradient', homeLayout: 'grid' }), theme: 'dark' } })
  env.api.initReadingPreferences()
  assert.equal(env.api.getReadingPreferences().fontScale, 1)
  assert.equal(env.api.effectiveReducedMotion(), false)
  assert.equal(env.attributes.get('data-theme'), 'dark')
  assert.equal(env.attributes.size, 1, 'disabled settings must not apply persisted appearance fields')
  assert.equal(env.styles.size, 0)
  env.api.setReadingPreferences({ theme: 'light', fontScale: 1.25 })
  assert.equal(env.api.getReadingPreferences().fontScale, 1)
  assert.equal(env.values.get('theme'), 'light', 'existing navbar toggle continues working with the panel disabled')
}
{
  const env = setup()
  env.api.initReadingPreferences()
  env.values.set(key, JSON.stringify({ version: 1, fontScale: 1.125, lineHeight: 'compact', theme: 'dark', motion: 'reduce' }))
  const event = new Event('storage'); event.key = key
  env.window.dispatchEvent(event)
  assert.equal(env.attributes.get('data-reading-font'), 'large')
  assert.equal(env.attributes.get('data-theme'), 'dark')
  assert.equal(env.api.effectiveReducedMotion(), true)
}

for (const options of [
  {}, { hour: 23 }, { saved: { theme: 'dark' } }, { blocked: true },
  { saved: { [key]: JSON.stringify({ version: 1, fontScale: 1.25, lineHeight: 'relaxed', theme: 'system', motion: 'reduce' }) }, systemDark: true },
  { saved: { [key]: JSON.stringify({ version: 2, primaryColor: '#fff', secondaryColor: '#000', texture: 'sakura', textureIntensity: 5, homeLayout: 'grid', background: 'gradient', theme: 'dark' }) } },
  { saved: { [key]: JSON.stringify({ version: 2, secondaryColor: 'rgb(255,255,0)' }) } },
  { palette: sitePalette }, { palette: sitePalette, hour: 23 }, { palette: sitePalette, blocked: true },
  { palette: sitePalette, saved: { [key]: JSON.stringify({ version: 2, primaryColor: '#128C9F', secondaryColor: '#56B7A7' }) } },
  { palette: sitePalette, saved: { [key]: JSON.stringify({ version: 2, secondaryColor: '#abc', theme: 'dark' }) } },
  { palette: sitePalette, enabled: false, saved: { [key]: JSON.stringify({ version: 2, primaryColor: '#fff', fontScale: 1.25 }) } },
  { palette: { primary: '#bad-input', secondary: 'rgb(78,170,213)' } }
]) {
  const env = setup(options)
  vm.runInNewContext(bootstrap.outputFiles[0].text, env.context)
  const before = JSON.stringify({ attributes: [...env.attributes], styles: [...env.styles] })
  env.api.initReadingPreferences()
  assert.equal(JSON.stringify({ attributes: [...env.attributes], styles: [...env.styles] }), before, 'head and runtime share identical restoration')
}
console.log('Reading preferences passed: v1/v2 validation, strict colors, contrast, site/visitor palettes, one-sided inheritance, appearance, reset isolation, mode priority, motion, persistence failure, disabled config and head/runtime parity')
