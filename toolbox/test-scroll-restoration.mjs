import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundle = await build({ entryPoints: [fileURLToPath(new URL('../source/js/_app/pjax/scroll-restoration.ts', import.meta.url))], bundle: true, write: false, format: 'iife', globalName: 'scrollModule' })
function emitter() {
  const listeners = new Map()
  return {
    addEventListener(name, fn, options = {}) {
      const group = listeners.get(name) || new Set()
      group.add(fn); listeners.set(name, group)
      options.signal?.addEventListener('abort', () => group.delete(fn), { once: true })
    },
    emit(name, event = {}) { for (const fn of [...(listeners.get(name) || [])]) fn(event) },
    count() { return [...listeners.values()].reduce((count, group) => count + group.size, 0) }
  }
}
function fixture(destination = { left: 0, top: 600 }) {
  const frames = new Map(), timers = new Map(), observers = [], writes = []
  let id = 0, current = true, modal = false, height = 4000, contentTop = 680, anchorPresent = true, updates = 0, margin = 0
  const win = emitter(), fonts = emitter(), page = { ...emitter(), dataset: {}, isConnected: true, contains: element => element === content,
    getBoundingClientRect: () => ({ left: 0, width: 800 }) }
  const content = { isConnected: true, closest: () => null, getClientRects: () => [1], getBoundingClientRect: () => ({ top: contentTop - context.scrollY }) }
  const doc = { ...emitter(), fonts, hidden: false,
    getElementById: id => id === 'target' && anchorPresent ? content : null,
    querySelector: () => modal ? {} : null,
    elementFromPoint: () => ({ closest: () => content }) }
  const context = vm.createContext({ console, AbortController, document: doc, window: win, innerWidth: 1000, innerHeight: 800, scrollX: 0, scrollY: 0,
    getComputedStyle: () => ({ scrollMarginTop: String(margin) }),
    requestAnimationFrame: fn => { frames.set(++id, fn); return id }, cancelAnimationFrame: id => frames.delete(id),
    setTimeout: (fn, delay) => { timers.set(++id, { fn, delay }); return id }, clearTimeout: id => timers.delete(id),
    ResizeObserver: class { constructor(fn) { this.notify = fn; this.active = true; observers.push(this) } observe() {} disconnect() { this.active = false } }
  })
  win.scrollTo = ({ left, top, behavior }) => { assert.equal(behavior, 'instant'); context.scrollX = left; context.scrollY = Math.min(top, height - 800); writes.push(context.scrollY) }
  vm.runInContext(bundle.outputFiles[0].text, context)
  const controller = context.scrollModule.createScrollRestoration({ page, destination, isCurrent: () => current, offset: () => 56, onScroll: () => updates++ })
  const flush = () => { const callbacks = [...frames.values()]; frames.clear(); for (const fn of callbacks) fn() }
  return { context, controller, page, win, doc, fonts, frames, timers, observers, writes, flush,
    shift: amount => { contentTop += amount; observers.forEach(item => { if (item.active) item.notify() }) },
    setHeight: value => { height = value }, setAnchor: value => { anchorPresent = value }, setCurrent: value => { current = value }, setModal: value => { modal = value }, setMargin: value => { margin = value },
    updates: () => updates,
    assertClean() { assert.equal(frames.size, 0); assert.equal(timers.size, 0); assert.ok(observers.every(item => !item.active)); assert.equal(win.count() + doc.count() + fonts.count() + page.count(), 0) }
  }
}

let f = fixture()
f.controller.restore(); f.flush()
assert.equal(f.context.scrollY, 600)
assert.equal(f.updates(), 0, 'initial positioning must not duplicate the caller viewport update')
f.shift(180); f.shift(20); f.shift(0)
assert.equal(f.frames.size, 1, 'burst resizes must coalesce into one frame')
f.flush(); assert.equal(f.context.scrollY, 800, 'late content must preserve the visible paragraph')
const writes = f.writes.length
f.shift(0); f.flush(); assert.equal(f.writes.length, writes, 'stable layout must not keep scrolling')
// Simulate native scroll anchoring already compensating the same layout change.
f.context.scrollY += 100; f.shift(100); f.flush()
assert.equal(f.writes.length, writes, 'native anchoring must not be applied twice')
f.controller.cancel(); f.assertClean()

f = fixture(); f.controller.restore(); f.flush()
f.page.dataset.entering = 'true'; f.shift(48); f.flush()
assert.equal(f.context.scrollY, 600, 'a visual entrance must not be mistaken for a layout shift')
delete f.page.dataset.entering; f.shift(-48); f.page.emit('shokax:page-entered'); f.flush()
assert.equal(f.writes.length, 1, 'ending an entrance alone must not produce a second scroll')
f.controller.cancel(); f.assertClean()

f = fixture(); f.setHeight(1000); f.controller.restore(); f.flush()
assert.equal(f.context.scrollY, 200)
f.setHeight(4000); f.shift(0); f.flush()
assert.equal(f.context.scrollY, 600, 'a short document must retry the saved coordinate before pinning content')
f.controller.cancel(); f.assertClean()

f = fixture({ anchor: 'target' }); f.setAnchor(false); f.controller.restore(); f.flush()
assert.equal(f.writes.length, 0)
f.setAnchor(true); f.win.emit('hexo-blog-decrypt'); f.flush()
assert.equal(f.context.scrollY, 624, 'late anchors must account for navigation height')
f.shift(200); f.fonts.emit('loadingdone'); f.flush()
assert.equal(f.context.scrollY, 824)
f.controller.cancel(); f.assertClean()

f = fixture({ anchor: 'target' }); f.setMargin(100); f.controller.restore()
assert.equal(f.context.scrollY, 580, 'explicit CSS scroll margin must agree with native component positioning')
f.controller.cancel(); f.assertClean()

for (const event of ['load', 'pageshow', 'resize']) {
  f = fixture({ anchor: 'target' }); f.setMargin(64); f.controller.restore(); f.flush()
  f.context.scrollY = 680 // Native fragment positioning after application setup.
  f.win.emit(event); f.flush()
  assert.equal(f.context.scrollY, 616, `${event} must respect the heading offset`)
  f.controller.cancel(); f.assertClean()
}

for (const [event, detail] of [['wheel', {}], ['touchstart', {}], ['pointerdown', {}], ['keydown', { key: 'PageDown' }], ['keydown', { key: 'Tab' }], ['keydown', { key: 'Enter' }], ['popstate', {}], ['hashchange', {}], ['pagehide', {}]]) {
  f = fixture(); f.controller.restore(); f.shift(200)
  f.win.emit(event, detail); f.flush(); f.shift(200); f.flush()
  assert.equal(f.writes.length, 1, `${event} must cancel even a queued correction`); f.assertClean()
}
f = fixture(); f.win.emit('wheel'); f.controller.restore()
assert.equal(f.writes.length, 0, 'input during asynchronous setup must cancel initial positioning too'); f.assertClean()
f = fixture(); f.setCurrent(false); f.controller.restore()
assert.equal(f.writes.length, 0, 'a superseded initial restore must release its input listeners'); f.assertClean()

for (const invalidate of [f => f.setCurrent(false), f => { f.page.isConnected = false }, f => f.setModal(true)]) {
  f = fixture(); f.controller.restore(); invalidate(f); f.shift(200); f.flush(); f.assertClean()
  assert.equal(f.writes.length, 1)
}
f = fixture(); f.controller.restore(); f.doc.emit('pjax:send'); f.assertClean()
f = fixture(); f.controller.restore(); f.doc.hidden = true; f.doc.emit('visibilitychange'); f.assertClean()

f = fixture(); f.controller.restore()
assert.equal([...f.timers.values()][0].delay, 2500)
const staleCallback = f.observers[0].notify
;[...f.timers.values()][0].fn(); staleCallback(); f.flush(); f.assertClean()
assert.equal(f.writes.length, 1, 'expired callbacks cannot restart correction')

f = fixture(); f.controller.restore(); f.flush()
for (let i = 0; i < 100; i++) { f.shift(20); f.flush() }
assert.equal(f.updates(), 8, 'continuous resize/scroll feedback must stop after eight corrections')
assert.equal(f.writes.length, 9); f.assertClean()
f = fixture({ left: 0, top: 0 }); f.controller.restore(); f.assertClean()

const resolve = f.context.scrollModule.scrollDestination
assert.equal(resolve('#comments'), null)
assert.equal(resolve('#42'), null)
assert.equal(resolve('#%E5%BC%95%E8%A8%80').anchor, '引言')
assert.equal(resolve('#bad%').top, 0)
assert.equal(resolve('', undefined, NaN).top, 0)
assert.equal(resolve('#heading', [0, 900]).top, 900, 'history coordinates take precedence over an old hash')
console.log('Scroll restoration: late layout/fonts/anchors, clamping, native anchoring, frame coalescing, early/user input, page disposal, deadline and feedback cap passed.')
