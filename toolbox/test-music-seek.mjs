import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const result = await build({ stdin: { contents: "export * from './source/js/_app/components/music-seek'; export {publishMusicState} from './source/js/_app/components/music-state'", resolveDir: fileURLToPath(new URL('../', import.meta.url)), loader: 'ts' }, bundle: true, write: false, format: 'cjs', platform: 'node' })
const module = { exports: {} }
new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
const { musicSeekTime, formatMusicTime, seekMusicAudio } = module.exports
assert.equal(musicSeekTime(250, 100, 300, 240), 120)
assert.equal(musicSeekTime(-20, 100, 300, 240), 0)
assert.equal(musicSeekTime(800, 100, 300, 240), 240)
for (const args of [[0, 0, 0, 1], [0, 0, 1, 0], [0, 0, 1, Infinity], [NaN, 0, 100, 10]]) assert.equal(musicSeekTime(...args), null)
assert.equal(formatMusicTime(294.9), '4:54')
assert.equal(formatMusicTime(-2), '0:00')
assert.equal(formatMusicTime(NaN), '0:00')
assert.equal(formatMusicTime(3601), '60:01')

const audio = { currentSrc: 'fixture.wav', readyState: 4, duration: 120, currentTime: 10, paused: false }
const updates = []
const seek = (time, url = 'fixture.wav') => seekMusicAudio(audio, url, time, value => updates.push(value))
assert.equal(seek(75), true)
assert.equal(audio.currentTime, 75)
assert.equal(audio.paused, false, 'seeking preserves ongoing playback')
audio.paused = true
assert.equal(seek(35), true)
assert.equal(audio.paused, true, 'seeking while paused must not resume playback')
assert.equal(seek(-10), true)
assert.equal(audio.currentTime, 0)
assert.equal(seek(999), true)
assert.equal(audio.currentTime, 120)
const before = updates.length
assert.equal(seek(30, 'stale-track.wav'), false)
assert.equal(seek(Infinity), false)
audio.duration = Infinity
assert.equal(seek(20), false, 'live/unknown durations cannot be sought by percentage')
audio.duration = 120; audio.readyState = 0
assert.equal(seek(20), false, 'unloaded metadata cannot be sought')
assert.equal(updates.length, before)
assert.equal(seekMusicAudio(null, 'fixture.wav', 10, () => assert.fail()), false)
assert.equal(seekMusicAudio({ ...audio, readyState: 4, set currentTime(value) { throw new DOMException('unavailable') } }, 'fixture.wav', 10, () => assert.fail()), false)
console.log('Music seek: pointer bounds, formatting, finite metadata, stale sources, failure and paused playback passed.')

// Reproduce native classList's no-op mutations: unloaded/current rows must not
// create an observer -> cleanup -> observer loop, including after track changes.
const jobs = []
let notify = () => {}, observing = false
function element() {
  const classes = new Set(), attrs = new Map(), styles = new Map()
  return {
    style: { removeProperty: name => styles.delete(name), setProperty: (name, value) => styles.set(name, value), getPropertyValue: name => styles.get(name) }, dataset: {},
    classList: {
      contains: name => classes.has(name),
      add(...names) { names.forEach(name => classes.add(name)); if (observing) jobs.push(notify) },
      remove(...names) { names.forEach(name => classes.delete(name)); if (observing) jobs.push(notify) }
    },
    setAttribute: (name, value) => attrs.set(name, value),
    removeAttribute: name => attrs.delete(name),
    getAttribute: name => attrs.get(name),
    append() {}, remove() {}, hasPointerCapture: () => false,
    focus() {}, setPointerCapture() {}, contains(other) { return other === this },
    closest() { return this }, getBoundingClientRect: () => ({ left: 0, width: 500, top: 100, bottom: 140 }),
    offsetWidth: 100, offsetHeight: 30
  }
}
const row = element(), root = element(), document = new EventTarget(), window = new EventTarget()
root.querySelector = () => row
document.body = element()
document.createElement = element
document.getElementById = id => id === 'MusicPlayerRoot' ? root : { dataset: { seek: 'Seek' } }
const timers = new Map()
let timerId = 0
class FixtureElement {}
Object.setPrototypeOf(row, FixtureElement.prototype)
const originals = Object.fromEntries(['document', 'window', 'MutationObserver', 'queueMicrotask', 'Element', 'Node', 'innerWidth', 'innerHeight', 'setTimeout', 'clearTimeout'].map(key => [key, globalThis[key]]))
Object.assign(globalThis, { document, window, queueMicrotask: job => jobs.push(job), MutationObserver: class {
  constructor(callback) { notify = callback }
  observe() { observing = true }
  disconnect() { observing = false }
}, Element: FixtureElement, Node: FixtureElement, innerWidth: 1000, innerHeight: 800,
setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id }, clearTimeout: id => timers.delete(id) })
const flush = () => {
  let count = 0
  while (jobs.length) { assert.ok(++count < 30, 'mutation cleanup must settle without a feedback loop'); jobs.shift()() }
}
try {
  const control = module.exports.createMusicSeek()
  const state = { time: 10, playing: false, panelOpen: true, duration: 0, seek: () => true }
  module.exports.publishMusicState(state); flush()
  assert.equal(row.getAttribute('role'), 'button')
  module.exports.publishMusicState({ ...state, duration: 120 }); flush()
  assert.equal(row.getAttribute('role'), 'slider')
  row.classList.add('music-seek-hover')
  module.exports.publishMusicState({ ...state, song: { url: 'next-track' } }); flush()
  assert.equal(row.getAttribute('role'), 'button')
  assert.equal(row.classList.contains('music-seek-hover'), false)
  let commits = 0, activations = 0, time = 60
  const loaded = { ...state, duration: 120, song: { url: 'fixture.wav' }, seek: value => {
    assert.equal(row.classList.contains('music-seeking'), true, 'keep preview visible while submitting the native seek')
    assert.equal(row.style.getPropertyValue('--music-seek-fill'), `${value / 120 * 100}%`)
    // Vue updates the underlying bar in its queued render, before releasing the preview.
    jobs.push(() => assert.equal(row.classList.contains('music-seeking'), true, 'preview persists until renderer receives the new clock'))
    commits++; time = value; return true
  } }
  module.exports.publishMusicState(loaded); flush()
  document.addEventListener('dblclick', () => { activations++; time = 0 })
  const dispatch = (type, props = {}) => {
    const event = new Event(type, { cancelable: true })
    Object.defineProperties(event, Object.fromEntries(Object.entries({ target: row, button: 0, isPrimary: true, pointerId: 1, pointerType: 'mouse', clientX: 500, detail: 1, ...props }).map(([key, value]) => [key, { value }])))
    document.dispatchEvent(event); flush()
    return event
  }
  const click = (x = 500) => { dispatch('pointerdown', { clientX: x }); dispatch('pointerup', { clientX: x }); dispatch('click') }
  click(250)
  assert.equal(commits, 1, 'single click seeks immediately without a double-click delay')
  assert.equal(time, 60)
  assert.equal(row.classList.contains('music-seeking'), false, 'release preview after renderer handoff')
  assert.equal(row.style.getPropertyValue('--music-seek-fill'), undefined)
  assert.equal(timers.size, 0, 'single click does not schedule a delayed seek')
  click(400); click(400); dispatch('dblclick', { detail: 2 })
  assert.equal(activations, 0, 'double click on the current song cannot restart it')
  assert.equal(commits, 3)
  assert.equal(time, 96, 'repeated clicks only adjust the current progress')
  dispatch('pointerdown', { clientX: 100 }); dispatch('pointermove', { clientX: 350 })
  module.exports.publishMusicState({ ...loaded, time: 10 }); flush()
  assert.equal(row.style.getPropertyValue('--music-seek-fill'), '70%', 'background time updates cannot replace drag preview')
  assert.equal(row.getAttribute('aria-valuenow'), '84')
  dispatch('pointerup', { clientX: 350 })
  assert.equal(commits, 4); assert.equal(time, 84)
  dispatch('pointerdown'); window.dispatchEvent(new Event('blur')); flush()
  assert.equal(row.classList.contains('music-seeking'), false)
  dispatch('pointerup'); assert.equal(commits, 4, 'cancelled gesture cannot commit')
  dispatch('pointerdown'); module.exports.publishMusicState({ ...loaded, song: { url: 'other.wav' } }); flush()
  dispatch('pointerup'); assert.equal(commits, 4, 'switching songs cancels the old drag')
  assert.equal(dispatch('keydown', { key: 'Enter' }).defaultPrevented, true, 'current slider keyboard cannot accidentally restart playback')
  const otherRow = element(); Object.setPrototypeOf(otherRow, FixtureElement.prototype); otherRow.closest = () => null
  dispatch('dblclick', { target: otherRow })
  assert.equal(activations, 1, 'other tracks retain their native double-click activation')
  dispatch('pointerdown')
  control.destroy(); flush()
  assert.equal(row.classList.contains('music-seeking'), false)
  assert.equal(timers.size, 0)
  assert.equal(observing, false)
} finally { for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value } }
console.log('Music seek: unloaded row and track-change observer cleanup settle correctly.')
console.log('Music seek: immediate click/drag, stable preview handoff, current-track double-click suppression and other-track activation passed.')
