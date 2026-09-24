import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

async function bundle(file, globalName) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(file, import.meta.url))], bundle: true, write: false, format: 'iife', globalName })
  return result.outputFiles[0].text
}
const loaderCode = await bundle('../source/js/_app/components/page-loader.ts', 'loaderModule')
const entryCode = await bundle('../source/js/_app/components/page-entry.ts', 'entryModule')
function events() {
  const handlers = new Map()
  return {
    addEventListener(name, fn, options = {}) {
      const group = handlers.get(name) || new Set(); group.add(fn); handlers.set(name, group)
      options.signal?.addEventListener('abort', () => group.delete(fn), { once: true })
    },
    emit(name) { for (const fn of [...(handlers.get(name) || [])]) fn() },
    count() { return [...handlers.values()].reduce((sum, group) => sum + group.size, 0) }
  }
}
function fixture({ initial = false, reduced = false } = {}) {
  let now = 0, id = 0
  const timers = new Map(), animations = [], classes = new Set()
  const root = { hidden: !initial, dataset: {}, style: {}, removeAttribute() { this.style = {} } }
  const window = events()
  const page = { dataset: {}, dispatchEvent() {}, getBoundingClientRect: () => ({ left: 64, top: -500, width: 850 }) }
  const document = { ...events(), hidden: false, body: { classList: { add: name => classes.add(name) } },
    getElementById: () => page,
    querySelector: () => ({ animate(frames, options) { const item = { frames, options, cancelled: false, cancel() { this.cancelled = true } }; animations.push(item); return item } }) }
  const context = vm.createContext({ document, window, AbortController, Event, innerWidth: 1280, innerHeight: 720,
    matchMedia: () => ({ matches: reduced }), performance: { now: () => now },
    setTimeout: (fn, delay) => { timers.set(++id, { fn, at: now + delay }); return id }, clearTimeout: id => timers.delete(id) })
  vm.runInContext(loaderCode, context); vm.runInContext(entryCode, context)
  const tick = ms => {
    const end = now + ms
    for (;;) {
      const next = [...timers.entries()].filter(([, item]) => item.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      now = next[1].at; timers.delete(next[0]); next[1].fn()
    }
    now = end
  }
  return { root, page, window, document, context, timers, animations, classes, tick,
    loader: options => context.loaderModule.createPageLoader(root, options), entry: rise => context.entryModule.playPageEntry(rise) }
}

let f = fixture()
let loader = f.loader({ start: false, switch: true, scope: 'content' })
const first = loader.show('navigation')
assert.equal(f.root.hidden, false, 'switch remains independent of initial loading')
assert.equal(f.root.style.left, '64px')
let revealed = 0
loader.hide(first, () => revealed++)
assert.equal(revealed, 0, 'entrance should wait for the veil to start leaving')
assert.ok(f.classes.has('loaded'), 'page usability must not wait for the visual hold/fade')
f.tick(180); assert.equal(f.root.dataset.state, 'leaving')
assert.equal(revealed, 1)
const next = loader.show('navigation')
loader.hide(first); f.tick(250)
assert.equal(f.root.hidden, false, 'a stale completion must not hide the next request')
assert.equal(f.root.dataset.state, 'loading')
loader.hide(next); f.tick(240)
assert.equal(f.root.hidden, true); assert.equal(f.timers.size, 0)

for (const event of ['wheel', 'touchstart', 'pagehide']) {
  f = fixture(); loader = f.loader({ start: false, switch: true })
  const token = loader.show('navigation'); f.window.emit(event); loader.hide(token); f.tick(20000)
  assert.equal(f.root.hidden, true); assert.equal(f.timers.size, 0)
}
f = fixture({ initial: true }); loader = f.loader({ start: true, switch: true, scope: 'viewport' })
f.tick(15000); assert.equal(f.root.hidden, true); assert.ok(f.classes.has('loaded')); assert.equal(f.timers.size, 0)
loader.show('navigation'); assert.equal(f.root.style.left, undefined, 'viewport loading must not inherit content bounds')
f.document.hidden = true; f.document.emit('visibilitychange'); assert.equal(f.root.dataset.paused, 'true')
loader.vanish(); assert.equal(f.timers.size, 0)
f = fixture({ reduced: true }); loader = f.loader({ start: false, switch: true })
loader.hide(loader.show('navigation')); f.tick(100); assert.equal(f.root.hidden, true)
f = fixture(); loader = f.loader({ start: false, switch: false })
loader.hide(loader.show('navigation')); assert.equal(f.root.hidden, true); assert.equal(f.timers.size, 0)

for (const rise of [false, true]) {
  f = fixture(); f.entry(rise)
  assert.equal(f.animations.length, 3, 'article, brand and active sidebar enter as separate regions')
  assert.equal('transform' in f.animations[0].frames[0], rise, 'hash/history entry must keep article geometry stable')
  assert.equal(f.page.dataset.entering === 'true', rise)
  f.tick(600); assert.ok(f.animations.every(a => a.cancelled)); assert.equal(f.window.count() + f.document.count(), 0)
  assert.equal(f.page.dataset.entering, undefined)
}
for (const event of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'pagehide']) {
  f = fixture(); f.entry(true); f.window.emit(event)
  assert.ok(f.animations.every(a => a.cancelled)); assert.equal(f.timers.size, 0); assert.equal(f.window.count() + f.document.count(), 0)
}
f = fixture(); f.entry(true); f.entry(false)
assert.ok(f.animations.slice(0, 3).every(a => a.cancelled), 'rapid navigation cancels old entrance animations')
f.document.hidden = true; f.document.emit('visibilitychange'); assert.equal(f.timers.size, 0)
f = fixture({ reduced: true }); f.entry(true)
assert.ok(f.animations.every(a => a.options.duration === 120 && !('transform' in a.frames[0])))
console.log('Page transition: independent flags, region bounds, immediate usability, stale finishes, deadlines, cancellation, hidden/reduced motion and stable anchor geometry passed.')
