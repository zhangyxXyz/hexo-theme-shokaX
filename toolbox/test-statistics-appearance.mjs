import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundle = await build({
  stdin: { contents: `export * from './source/js/_app/components/statistics/palette';
    export { chartOptions } from './source/js/_app/components/statistics/options';
    export { calendarDetails } from './source/js/_app/components/statistics/calendar';
    export { watchStatisticsAppearance } from './source/js/_app/components/statistics/appearance';
    export { setReadingPreferences, resetReadingPreferences } from './source/js/_app/components/reading-preferences';`,
    resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
  bundle: true, write: false, format: 'iife', globalName: 'statistics'
})

const document = new EventTarget(), window = new EventTarget()
const attributes = new Map(), properties = new Map(), storage = new Map(), frames = new Map(), observers = new Set()
let serial = 0, rasterReads = 0
const root = {
  clientWidth: 900,
  getAttribute: name => attributes.get(name) ?? null,
  setAttribute(name, value) {
    const changed = attributes.get(name) !== value
    attributes.set(name, value)
    if (changed) observers.forEach(observer => { if (observer.attributes.includes(name)) observer.callback() })
  },
  removeAttribute(name) {
    const changed = attributes.delete(name)
    if (changed) observers.forEach(observer => { if (observer.attributes.includes(name)) observer.callback() })
  },
  style: { setProperty: (name, value) => properties.set(name, value), removeProperty: name => properties.delete(name) }
}
document.documentElement = root
document.createElement = tag => tag === 'canvas' ? {
  getContext: () => ({ clearRect() {}, fillRect() {}, getImageData() { rasterReads++; return { data: [18, 52, 86, 128] } } })
} : { children: [], style: {}, setAttribute() {}, append(...children) { this.children.push(...children) } }
const media = new Map()
const scope = vm.createContext({
  document, window, AbortController, console,
  shokax_CONFIG: { reading_settings: { enable: true }, darkmode: false, auto_dark: false },
  getComputedStyle: () => ({ fontFamily: 'sans-serif', getPropertyValue: name => properties.get(name) || '' }),
  matchMedia: query => {
    if (!media.has(query)) { const result = new EventTarget(); result.matches = false; media.set(query, result) }
    return media.get(query)
  },
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  requestAnimationFrame: callback => { frames.set(++serial, callback); return serial },
  cancelAnimationFrame: id => frames.delete(id),
  MutationObserver: class {
    constructor(callback) { this.callback = callback }
    observe(_, options) { this.attributes = options.attributeFilter; observers.add(this) }
    disconnect() { observers.delete(this) }
  }
})
vm.runInContext(bundle.outputFiles[0].text, scope)
const api = scope.statistics
const tick = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()) }

// Existing theme defaults remain the fallback, while CSS Color 4 is normalized
// for the older chart renderer without rereading pixels on every chart render.
assert.equal(api.statisticsColors(root).scale[2], '#df5d82')
assert.equal(api.statisticsColors(root).calendar[4], '#f838b2')
assert.equal(api.resolveChartColor('#abcdef', '#000000'), '#abcdef')
assert.equal(rasterReads, 0)
const modernColor = 'color-mix(in srgb, #123456 50%, transparent)'
assert.match(api.resolveChartColor(modernColor, '#000000'), /^rgba\(18,52,86,0\.50/)
api.resolveChartColor(modernColor, '#000000')
assert.equal(rasterReads, 1, 'shared chart palette caches resolved CSS colors')

const labels = { weekdays: 'S,M,T,W,T,F,S', months: 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec' }
const echarts = { graphic: { LinearGradient: class { constructor(x, y, x2, y2, stops) { this.colorStops = stops } } } }
const option = key => api.chartOptions(key, [{ name: '20260101', value: 8 }], labels, root, { clientWidth: 800 }, echarts)
const categoryColors = JSON.stringify(option('categories').color)
properties.set('--statistics-scale-high', '#155e75')
properties.set('--statistics-bar-start', '#dbeafe')
properties.set('--statistics-calendar-4', '#348399')
properties.set('--statistics-trend-current', '#155e75')
properties.set('--statistics-trend-previous', '#7c3aed')
assert.equal(option('tags').series[0].itemStyle.color.colorStops[0].color, '#155e75')
assert.equal(option('posts').series[0].lineStyle.color, '#155e75', 'comment trend shares the post line palette')
assert.equal(option('map').visualMap.inRange.color[2], '#155e75', 'visit and comment maps share the continuous scale')
assert.equal(option('clock').series[0].itemStyle.color, '#155e75')
assert.equal(option('calendar').visualMap.pieces[4].color, '#348399')
assert.equal(JSON.stringify(option('categories').color), categoryColors, 'categorical series retain their distinct colors')
assert.equal(api.statisticsColors(root).bar[1], '#155e75', 'content and comment rankings share the same gradient palette')
assert.equal(api.statisticsColors(root).trend[1], '#7c3aed')
const details = api.calendarDetails([], labels)
const legend = details.children[0].children[1]
assert.equal(legend.children[3].style.backgroundColor, 'var(--statistics-calendar-4, #f838b2)', 'the DOM legend follows the same live CSS variable as canvas')

// Preferences and theme changes repaint once after CSS has settled. Settings
// unrelated to color/motion do not trigger a costly full chart repaint.
let renders = 0
const first = new AbortController()
api.watchStatisticsAppearance(() => renders++, first.signal)
api.setReadingPreferences({ primaryColor: '#155e75', secondaryColor: '#7c3aed' })
api.setReadingPreferences({ theme: 'dark' })
assert.equal(frames.size, 1)
tick()
assert.equal(renders, 1)
api.setReadingPreferences({ fontScale: 1.25, texture: 'dots' })
assert.equal(frames.size, 0)
api.setReadingPreferences({ motion: 'reduce' })
assert.equal(frames.size, 1)
tick()
assert.equal(renders, 2)
api.resetReadingPreferences()
assert.equal(frames.size, 1, 'resetting colors repaints existing charts')
first.abort()
assert.equal(frames.size, 0, 'PJAX abort cancels a scheduled repaint')
assert.equal(observers.size, 0)
api.setReadingPreferences({ primaryColor: '#123456' })
assert.equal(frames.size, 0, 'an unmounted page no longer subscribes to preferences')
const second = new AbortController()
api.watchStatisticsAppearance(() => renders++, second.signal)
api.setReadingPreferences({ secondaryColor: '#654321' })
tick()
assert.equal(renders, 3, 'returning via PJAX creates one active subscription')
second.abort()
console.log('Statistics appearance: palette coverage, calendar legend, batching, reset and PJAX cleanup passed.')
