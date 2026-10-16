import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundle = await build({ stdin: { contents: `export * from './source/js/_app/components/project-activity';
  export { setReadingPreferences, resetReadingPreferences } from './source/js/_app/components/reading-preferences';`,
  resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, bundle: true, write: false, format: 'iife', globalName: 'activity' })
const document = new EventTarget(), window = new EventTarget()
const attrs = new Map(), styles = new Map(), storage = new Map(), frames = new Map(), observers = new Set(), requests = []
let serial = 0
const root = {
  getAttribute: key => attrs.get(key) ?? null,
  hasAttribute: key => attrs.has(key),
  setAttribute(key, value) {
    const changed = attrs.get(key) !== value
    attrs.set(key, value)
    if (changed) observers.forEach(observer => { if (observer.keys.includes(key)) observer.callback() })
  },
  removeAttribute(key) {
    if (attrs.delete(key)) observers.forEach(observer => { if (observer.keys.includes(key)) observer.callback() })
  },
  style: { setProperty: (key, value) => styles.set(key, value), removeProperty: key => styles.delete(key) }
}
const original = 'https://ghchart.rshah.org/ab66ff/example-user'
const chart = { src: original, isConnected: true, getAttribute: key => key === 'src' ? chart.src : null }
const unrelated = { src: 'https://example.com/github.svg', isConnected: true, getAttribute: key => key === 'src' ? unrelated.src : null }
let images = [chart, unrelated]
document.documentElement = root
document.querySelectorAll = () => images
const media = new EventTarget()
media.matches = false
const scope = vm.createContext({
  document, window, URL, AbortController, location: { href: 'https://example.com/projects/' },
  shokax_CONFIG: { reading_settings: { enable: true }, darkmode: false, auto_dark: false },
  getComputedStyle: () => ({ getPropertyValue: key => {
    if (key !== '--primary-color') return ''
    const dark = attrs.get('data-theme') === 'dark'
    return styles.get(`--reading-primary-ink-${dark ? 'dark' : 'light'}`) || (dark ? 'rgba(237,114,133,.9)' : '#e9546b')
  } }),
  matchMedia: () => media,
  localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  requestAnimationFrame: callback => { frames.set(++serial, callback); return serial }, cancelAnimationFrame: id => frames.delete(id),
  MutationObserver: class {
    constructor(callback) { this.callback = callback }
    observe(_, options) { this.keys = options.attributeFilter; observers.add(this) }
    disconnect() { observers.delete(this) }
  },
  Image: class {
    constructor() { requests.push(this) }
    removeAttribute(key) { if (key === 'src') this.cancelled = true }
  }
})
vm.runInContext(bundle.outputFiles[0].text, scope)
const api = scope.activity
const tick = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()) }
assert.equal(api.contributionColorURL(original, '#123456'), 'https://ghchart.rshah.org/123456/example-user')
assert.equal(api.contributionColorURL(original, null), original)
assert.equal(api.contributionColorURL(original, 'rgba(237,114,133,.9)'), 'https://ghchart.rshah.org/ed7285/example-user')
assert.equal(api.contributionColorURL('https://ghchart.rshah.org.evil.test/ab66ff/example-user', '#123456'), undefined)
assert.equal(api.contributionColorURL('https://user:secret@ghchart.rshah.org/example-user', '#123456'), undefined)
assert.equal(api.contributionColorURL('https://ghchart.rshah.org/example-user?cache=1', '#123456'), 'https://ghchart.rshah.org/123456/example-user?cache=1')

api.refreshProjectActivity()
assert.equal(requests.length, 0, 'default appearance keeps the original image without a second request')
api.setReadingPreferences({ primaryColor: '#123456' })
tick()
assert.equal(requests.length, 1)
assert.equal(chart.src, original, 'keep the currently displayed image while loading')
requests[0].onload()
const lastGood = chart.src
assert.match(lastGood, /\/123456\/example-user$/)
assert.equal(unrelated.src, 'https://example.com/github.svg')

api.setReadingPreferences({ primaryColor: '#654321' }); tick()
const stale = requests[1].onload
api.setReadingPreferences({ primaryColor: '#135724' }); tick()
assert.equal(requests[1].cancelled, true)
stale()
assert.equal(chart.src, lastGood, 'an older color must not replace the latest requested color')
requests[2].onerror()
assert.equal(chart.src, lastGood, 'failed loads retain the last successful result')
api.setReadingPreferences({ secondaryColor: '#777777', fontScale: 1.25 }); tick()
assert.equal(requests.length, 3, 'unrelated preference changes do not refetch the monochrome graph')

api.setReadingPreferences({ theme: 'dark' }); tick()
assert.equal(requests.length, 4)
assert.notEqual(requests[3].src, requests[2].src, 'dark mode uses the readable dark primary color')
requests[3].onload()
api.resetReadingPreferences(); tick()
assert.equal(requests[4].src, original, 'reset restores the original URL, including its original seed')
requests[4].onload()
assert.equal(chart.src, original)

api.setReadingPreferences({ primaryColor: '#123456' }); tick()
const departed = requests[5].onload
images = []
chart.isConnected = false
api.refreshProjectActivity()
departed()
assert.equal(chart.src, original, 'late image responses cannot mutate a departed PJAX page')
assert.equal(observers.size, 0)
api.setReadingPreferences({ primaryColor: '#654321' }); tick()
assert.equal(requests.length, 6, 'departed pages release their preference listener')
images = [chart]
chart.isConnected = true
api.refreshProjectActivity()
assert.equal(requests.length, 7)
assert.equal(observers.size, 1, 'returning to the page has one theme observer')
images = []
api.refreshProjectActivity()

scope.shokax_CONFIG.palette = { primary: '#3469B8', secondary: '#4EAAD5' }
api.resetReadingPreferences(); tick()
assert.equal(attrs.get('data-reading-palette'), 'theme')
assert.equal(storage.has('shokax.reading.preferences'), false, 'site colors are not stored as visitor choices')
chart.src = original
images = [chart, unrelated]
api.refreshProjectActivity()
assert.equal(requests.length, 8, 'a configured site palette colors the graph on its first page initialization')
assert.equal(requests[7].src, 'https://ghchart.rshah.org/3469b8/example-user')
assert.equal(chart.src, original, 'the original graph remains visible until the configured-color image is ready')
requests[7].onload()
const themed = chart.src
assert.equal(unrelated.src, 'https://example.com/github.svg')
api.setReadingPreferences({ primaryColor: '#123456' }); tick()
assert.equal(requests[8].src, 'https://ghchart.rshah.org/123456/example-user')
requests[8].onload()
api.setReadingPreferences({ primaryColor: null, secondaryColor: null }); tick()
assert.equal(attrs.get('data-reading-palette'), 'theme')
assert.equal(requests[9].src, themed, 'palette reset restores the configured primary instead of the original image seed')
requests[9].onload()
assert.equal(chart.src, themed)
api.setReadingPreferences({ secondaryColor: '#abc' }); tick()
assert.equal(requests.length, 10, 'a secondary-only visitor override preserves the inherited primary graph')
api.setReadingPreferences({ theme: 'dark' }); tick()
assert.equal(requests.length, 11)
assert.notEqual(requests[10].src, themed, 'the site default also receives a readable dark-mode graph color')
requests[10].onload()
api.resetReadingPreferences(); tick()
assert.equal(requests[11].src, themed, 'full reset still respects configured site colors')
requests[11].onload()
assert.equal(chart.src, themed)
assert.equal(attrs.get('data-reading-palette'), 'theme')
images = []
api.refreshProjectActivity()
assert.equal(observers.size, 0)
console.log('Project contribution chart: scoped URL, successful swap, failure rollback, configured defaults, visitor/reset, dark mode and PJAX cleanup passed.')
