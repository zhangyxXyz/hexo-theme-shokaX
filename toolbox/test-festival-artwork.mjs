import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

// Exercise asynchronous lifecycle failures, not artwork's exact path strings.
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL('../source/js/_app/components/festival/index.ts', import.meta.url))],
  bundle: true, format: 'esm', platform: 'browser', write: false,
  // The real shared picker is exercised in-browser; this harness isolates
  // artwork lifecycle and verifies programmatic selections synchronize it.
  plugins: [{ name: 'picker-boundary', setup(build) {
    build.onResolve({ filter: /\/select-picker$/ }, () => ({ path: 'picker', namespace: 'test' }))
    build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
      export function enhanceSelect(select) {
        const picker = { sync() { select.pickerValue = select.value }, destroy() { select.pickerDestroyed = true } };
        picker.sync(); return picker;
      }` }))
  } }]
})
const timers = new Map()
let timerId = 0
globalThis.setInterval = callback => { timers.set(++timerId, callback); return timerId }
globalThis.clearInterval = id => timers.delete(id)
class Events {
  listeners = new Map()
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set())
    this.listeners.get(type).add(callback)
  }
  removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback) }
  emit(type, event) { for (const callback of this.listeners.get(type) || []) callback(event) }
  count(type) { return this.listeners.get(type)?.size || 0 }
}
const desktop = new Events()
desktop.matches = true
globalThis.matchMedia = () => desktop
let currentRoot
let currentPreview
const documentMock = new Events()
documentMock.querySelector = selector => selector === '.festival-decoration' ? currentRoot : currentPreview
documentMock.importNode = element => ({ ...element, caption: { textContent: '' } })
globalThis.document = documentMock
globalThis.DOMParser = class {
  parseFromString(source) {
    return {
      querySelector: () => source.startsWith('<svg') ? null : {},
      documentElement: { localName: 'svg', source }
    }
  }
}
const pending = []
globalThis.fetch = (url, options) => new Promise((resolve, reject) => {
  pending.push({ url, signal: options.signal, resolve, reject })
})
const settle = () => new Promise(resolve => setImmediate(resolve))
const response = (source = '<svg></svg>') => ({ ok: true, text: async () => source })
function root(theme, extra = {}) {
  const options = { enable: true, theme, table: { items: { daily: { enable: true } } }, ...extra }
  const scenes = ['daily', 'spring'].map(scene => ({
    dataset: { festivalScene: scene }, hidden: true, querySelectorAll: () => []
  }))
  const characters = [0, 1].map(index => ({ dataset: { festivalCharacter: String(index) }, textContent: '' }))
  const host = {
    hidden: true, children: [], replaceChildren(...children) { this.children = children },
    querySelectorAll() { return this.children.map(child => child.caption) }
  }
  return {
    dataset: { festival: JSON.stringify(options), artwork: JSON.stringify({
      dragon_boat: '/dragon.svg', mid_autumn: '/autumn.svg', lantern: '/lantern.svg'
    }) }, host, scenes, characters,
    querySelector: () => host,
    querySelectorAll: selector => selector === '[data-festival-character]' ? characters : scenes
  }
}
const { refreshFestival } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)

desktop.matches = false
currentRoot = root('dragon_boat')
refreshFestival()
assert.equal(currentRoot.dataset.scene, 'none')
assert.equal(pending.length, 0, 'hidden mobile decorations should not download')
desktop.matches = true
desktop.emit('change')
assert.equal(pending.length, 1, 'widening the viewport enables artwork')
pending[0].resolve(response('<svg id="dragon"></svg>'))
await settle()
assert.equal(currentRoot.dataset.scene, 'dragon_boat')
assert.equal(currentRoot.host.children.length, 1)
documentMock.emit('visibilitychange')
assert.equal(pending.length, 1, 'same scene should retain its DOM and animation')

currentRoot = root('mid_autumn')
refreshFestival()
const staleRoot = currentRoot
assert.equal(pending.length, 2)
currentRoot = root('lantern')
refreshFestival()
assert.equal(pending[1].signal.aborted, true, 'PJAX aborts the old request')
assert.equal(timers.size, 1)
assert.equal(documentMock.count('visibilitychange'), 1)
assert.equal(desktop.count('change'), 1)
pending[1].resolve(response('<svg id="old"></svg>'))
pending[2].resolve(response('<svg id="new"></svg>'))
await settle()
assert.equal(staleRoot.host.children.length, 0, 'stale requests cannot paint the old page')
assert.equal(currentRoot.dataset.scene, 'lantern')
assert.match(currentRoot.host.children[0].source, /new/)

currentRoot = root('dragon_boat')
refreshFestival()
await settle()
assert.equal(pending.length, 3, 'a successful scene is reused across PJAX')
assert.equal(currentRoot.dataset.scene, 'dragon_boat')

currentRoot = root('mid_autumn')
refreshFestival()
pending[3].reject(new Error('temporary network failure'))
await settle()
assert.equal(currentRoot.dataset.scene, 'daily')
documentMock.emit('visibilitychange')
assert.equal(pending.length, 5, 'visibility change retries after a network failure')
pending[4].resolve(response('invalid XML'))
await settle()
assert.equal(currentRoot.dataset.scene, 'daily', 'invalid SVG falls back without breaking the page')
for (const callback of timers.values()) callback()
pending[5].resolve(response('<svg id="recovered"></svg>'))
await settle()
assert.equal(currentRoot.dataset.scene, 'mid_autumn')

desktop.matches = false
desktop.emit('change')
assert.equal(currentRoot.dataset.scene, 'none')
assert.equal(currentRoot.host.children.length, 0)
currentRoot = root('dragon_boat', { mobile: true })
refreshFestival()
await settle()
assert.equal(currentRoot.dataset.scene, 'dragon_boat', 'explicit mobile opt-in works')

currentRoot = undefined
refreshFestival()
assert.equal(timers.size, 0, 'leaving a page with decorations clears the timer')
assert.equal(documentMock.count('visibilitychange'), 0)
assert.equal(desktop.count('change'), 0)

function preview() {
  const select = new Events()
  select.value = 'auto'
  select.options = ['auto', 'none', 'daily', 'spring', 'dragon_boat', 'mid_autumn', 'lantern'].map(value => ({ value, textContent: value }))
  const reset = new Events()
  const labelInput = new Events()
  labelInput.value = ''
  const status = { textContent: '' }
  const cards = ['spring', 'dragon_boat', 'mid_autumn'].map(scene => ({
    dataset: { previewScene: scene }, attributes: {}, setAttribute(name, value) { this.attributes[name] = value }
  }))
  const element = new Events()
  element.dataset = { labels: JSON.stringify({ auto: 'Default:', selected: 'Preview:', loading: 'Loading:', failed: 'Fallback:' }) }
  element.querySelector = selector => ({
    '[data-festival-select]': select, '[data-festival-status]': status,
    '[data-festival-reset]': reset, '[data-festival-label-input]': labelInput
  })[selector]
  element.querySelectorAll = () => cards
  element.contains = card => cards.includes(card)
  return Object.assign(element, { select, reset, status, cards, labelInput })
}
globalThis.location = { href: 'https://example.test/festival/?scene=mid_autumn' }
globalThis.history = { state: null, replaceState(state, title, url) { location.href = String(url) } }
desktop.matches = false
currentRoot = root('none', { enable: false, table: { items: { mid_autumn: { enable: false, label: '中秋' }, spring: { label: '春节' } } } })
const originalOptions = currentRoot.dataset.festival
currentPreview = preview()
refreshFestival()
await settle()
assert.equal(currentRoot.dataset.scene, 'mid_autumn', 'preview URL overrides disabled scene and global settings')
assert.equal(currentRoot.dataset.mobile, 'true', 'preview releases the CSS mobile gate as well as JS')
assert.equal(currentRoot.dataset.festival, originalOptions, 'preview does not mutate baseline settings')
assert.equal(currentPreview.status.textContent, 'Preview: mid_autumn')
assert.equal(currentPreview.labelInput.value, '中秋')
const beforeEdit = currentRoot.host.children[0]
const beforeRequests = pending.length
currentPreview.labelInput.value = '团圆快乐'
currentPreview.labelInput.emit('input', { isComposing: true })
assert.equal(currentRoot.host.children[0].caption.textContent, '中秋', 'IME composition is not truncated mid-input')
currentPreview.labelInput.emit('compositionend', {})
assert.equal(currentPreview.labelInput.value, '团圆')
assert.equal(beforeEdit.caption.textContent, '团圆')
assert.equal(currentRoot.host.children[0], beforeEdit, 'editing words preserves the artwork DOM and animation')
assert.equal(pending.length, beforeRequests, 'editing words does not reload artwork')
currentPreview.labelInput.value = ''
currentPreview.labelInput.emit('input', {})
assert.equal(beforeEdit.caption.textContent, '', 'empty labels hide the text')
currentPreview.labelInput.value = '𠮷祥'
currentPreview.labelInput.emit('input', {})
assert.equal(beforeEdit.caption.textContent, '𠮷祥', 'supplementary characters are not split')
currentPreview.select.value = 'spring'
currentPreview.select.emit('change')
assert.equal(currentRoot.characters.map(word => word.textContent).join(''), '春节')
currentPreview.labelInput.value = '新岁'
currentPreview.labelInput.emit('input', {})
assert.equal(currentRoot.characters.map(word => word.textContent).join(''), '新岁')
currentPreview.select.value = 'dragon_boat'
currentPreview.select.emit('change')
await settle()
assert.equal(currentRoot.dataset.scene, 'dragon_boat')
assert.equal(new URL(location.href).searchParams.get('scene'), 'dragon_boat')
assert.equal(currentPreview.cards[1].attributes['aria-pressed'], 'true')
assert.equal(currentPreview.select.pickerValue, 'dragon_boat')
currentPreview.select.value = 'auto'
currentPreview.select.emit('change')
assert.equal(currentRoot.dataset.scene, 'none', 'the default option releases the preview override')
currentPreview.select.value = 'mid_autumn'
currentPreview.select.emit('change')
await settle()
assert.equal(currentPreview.labelInput.value, '中秋', 'choosing site default also discards custom captions')
currentPreview.reset.emit('click')
await settle()
assert.equal(currentRoot.dataset.scene, 'none', 'restore respects the original disabled configuration')
assert.equal(currentRoot.dataset.mobile, 'false')
assert.equal(new URL(location.href).searchParams.has('scene'), false)
currentPreview.select.value = 'mid_autumn'
currentPreview.select.emit('change')
await settle()
assert.equal(currentPreview.labelInput.value, '中秋', 'reset clears caption drafts as well as the scene override')
assert.equal(currentRoot.host.children[0].caption.textContent, '中秋')
currentPreview.reset.emit('click')
const oldPreview = currentPreview
currentPreview = undefined
refreshFestival()
assert.equal(oldPreview.select.count('change'), 0)
assert.equal(oldPreview.reset.count('click'), 0)
assert.equal(oldPreview.count('click'), 0)
assert.equal(oldPreview.labelInput.count('input'), 0)
assert.equal(oldPreview.labelInput.count('compositionend'), 0)
assert.equal(oldPreview.select.pickerDestroyed, true)
assert.equal(currentRoot.dataset.scene, 'none', 'PJAX leaving restores disabled state')

desktop.matches = true
currentRoot = root('daily')
currentPreview = preview()
refreshFestival()
const card = currentPreview.cards[2]
currentPreview.emit('click', { target: { closest: () => card } })
await settle()
assert.equal(currentRoot.dataset.scene, 'mid_autumn', 'card selection paints the real decoration')
currentPreview = undefined
refreshFestival()
assert.equal(currentRoot.dataset.scene, 'daily', 'persistent body decoration returns to the baseline on PJAX exit')
assert.equal(currentRoot.dataset.mobile, 'false')
currentRoot = root('spring', { table: { items: { spring: { label: '春节', word1: '', word2: '安' } } } })
refreshFestival()
assert.deepEqual(currentRoot.characters.map(word => word.textContent), ['', '安'], 'legacy per-lantern overrides retain their positions and explicit blank')
currentRoot = undefined
refreshFestival()
assert.equal(timers.size, 0)
console.log('Festival artwork: loading, cache, PJAX cancellation, recovery, live preview, URL selection, disabled/mobile overrides and default restoration passed.')
