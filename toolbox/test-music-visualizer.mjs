import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundle = await build({ entryPoints: [fileURLToPath(new URL('../source/js/_app/components/music-visualizer.ts', import.meta.url))], bundle: true, write: false, format: 'iife', globalName: 'visualizer' })
function fixture({ capture = true } = {}) {
  const document = new EventTarget(), window = new EventTarget(), motion = new EventTarget()
  const frames = new Map(), storage = new Map(), classes = new Set()
  let serial = 0, time = 0, captures = 0, stops = 0, disconnects = 0, spectrum = 0
  let intersection, size, canvas, dock, context, copies = 0
  const painter = { setTransform() {}, clearRect() {}, createLinearGradient: () => ({ addColorStop() {} }), beginPath() {}, moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {}, fill() {}, drawImage() { copies++ } }
  const waves = { append(element) { canvas = element }, getBoundingClientRect: () => ({ width: 1200, height: 120 }), classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name) } } }
  document.hidden = false
  document.getElementById = id => id === 'waves' ? waves : null
  document.body = { append(element) { dock = element } }
  document.createElement = () => {
    const names = new Set()
    return { className: '', dataset: {}, clientWidth: 1200, clientHeight: 72,
      classList: { contains: name => names.has(name), toggle(name, on) { if (on) names.add(name); else names.delete(name) } },
      setAttribute() {}, getContext: () => painter, remove() { if (this === canvas) canvas = undefined; if (this === dock) dock = undefined } }
  }
  motion.matches = false
  class Audio {
    paused = false
    ended = false
    readyState = 4
    closest() { return true }
    captureStream = capture ? () => {
      captures++
      const stream = new EventTarget()
      stream.active = true
      stream.getAudioTracks = stream.getTracks = () => [{ stop() { stops++ } }]
      return stream
    } : undefined
  }
  class Context {
    state = 'suspended'
    constructor() { context = this }
    resume() { this.state = 'running'; return Promise.resolve() }
    suspend() { this.state = 'suspended'; return Promise.resolve() }
    close() { this.state = 'closed'; return Promise.resolve() }
    createAnalyser() { return { getByteFrequencyData(data) { data.fill(spectrum) }, disconnect() {} } }
    createMediaStreamSource() { return { connect(node) { assert.ok(node.getByteFrequencyData, 'capture only connects to analyser, never audible destination') }, disconnect() { disconnects++ } } }
  }
  const scope = vm.createContext({ document, window, AudioContext: Context, HTMLAudioElement: Audio, AbortController, Float32Array, Uint8Array, performance: { now: () => time }, devicePixelRatio: 3, matchMedia: () => motion, localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, requestAnimationFrame: callback => { frames.set(++serial, callback); return serial }, cancelAnimationFrame: id => frames.delete(id), IntersectionObserver: class { constructor(callback) { intersection = callback } observe() {} disconnect() {} }, ResizeObserver: class { constructor(callback) { size = callback } observe() {} disconnect() {} } })
  vm.runInContext(bundle.outputFiles[0].text, scope)
  const controller = scope.visualizer.createMusicVisualizer()
  const audio = new Audio()
  function media(type) { const event = new Event(type); Object.defineProperty(event, 'target', { value: audio }); document.dispatchEvent(event) }
  function tick() { time += 40; const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)) }
  return { controller, document, window, motion, storage, frames, media, tick, audio, get canvas() { return canvas }, get dock() { return dock }, get copies() { return copies }, get context() { return context }, get captures() { return captures }, get stops() { return stops }, get disconnects() { return disconnects }, signal(value) { spectrum = value }, inView(value, ratio = value ? 1 : 0, below = false) { intersection([{ isIntersecting: value, intersectionRatio: ratio, boundingClientRect: { top: below ? 900 : -100, bottom: value ? 120 * ratio : below ? 1020 : -1 } }]) }, resize() { size() }, get active() { return classes.has('music-visualizer-active') } }
}

for (const capture of [true, false]) {
  const f = fixture({ capture })
  f.inView(true)
  f.media('playing')
  assert.equal(f.canvas, undefined, 'disabled by default and allocates no canvas')
  assert.equal(f.controller.toggle(), true)
  assert.equal(f.storage.get('shokax.music.visualizer'), 'on')
  assert.equal(f.frames.size, 1)
  assert.equal(f.canvas.width, 2400, 'DPR capped at two')
  for (let i = 0; i < 20; i++) f.media('playing')
  assert.equal(f.frames.size, 1, 'repeated playback events share one frame loop')
  assert.equal(f.captures, capture ? 1 : 0)
  f.tick()
  assert.equal(f.canvas.dataset.signal, 'ambient', 'missing or CORS-silent capture uses fallback')
  if (capture) {
    f.signal(160); f.tick()
    assert.equal(f.canvas.dataset.signal, 'audio')
  }
  f.inView(false)
  assert.equal(f.frames.size, 1, 'offscreen header transfers to dock using the existing loop')
  assert.equal(f.active, false)
  assert.equal(f.dock.classList.contains('is-visible'), true)
  assert.equal(f.dock.width, 2400)
  f.tick()
  assert.equal(f.dock.dataset.signal, f.canvas.dataset.signal, 'dock shares the same analysed frame')
  assert.equal(f.captures, capture ? 1 : 0, 'docking never captures the audio again')
  f.inView(true, .05)
  assert.equal(f.dock.classList.contains('is-visible'), true, 'small boundary movements keep dock stable')
  f.inView(true, .15)
  assert.equal(f.dock.classList.contains('is-visible'), false)
  assert.equal(f.active, true)
  const dockInstance = f.dock
  for (let i = 0; i < 20; i++) { f.inView(false); f.inView(true) }
  assert.equal(f.frames.size, 1)
  assert.equal(f.dock, dockInstance, 'rapid scrolling reuses one dock')
  assert.equal(f.captures, capture ? 1 : 0)
  for (let i = 0; i < 12; i++) f.tick()
  const copiesAfterFade = f.copies
  f.tick()
  assert.equal(f.copies, copiesAfterFade, 'hidden dock stops copying after its exit transition')
  f.inView(false, 0, true)
  assert.equal(f.dock.classList.contains('is-visible'), false, 'header below viewport must not trigger dock')
  f.inView(false)
  f.audio.paused = true; f.media('pause')
  assert.equal(f.dock.classList.contains('is-visible'), false, 'pause also hides bottom waves')
  f.audio.paused = false; f.media('playing')
  assert.equal(f.dock.classList.contains('is-visible'), true)
  f.inView(true)
  f.audio.paused = true; f.media('pause')
  assert.equal(f.frames.size, 0)
  assert.equal(f.active, false, 'pause restores SVG waves')
  f.audio.paused = false; f.media('playing')
  f.document.hidden = true; f.document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(f.frames.size, 0)
  f.document.hidden = false; f.document.dispatchEvent(new Event('visibilitychange'))
  f.motion.matches = true; f.motion.dispatchEvent(new Event('change'))
  assert.equal(f.frames.size, 0, 'reduced motion stops canvas')
  f.motion.matches = false; f.motion.dispatchEvent(new Event('change'))
  f.audio.readyState = 0; f.media('emptied')
  assert.equal(f.frames.size, 0)
  f.audio.readyState = 4; f.media('playing')
  assert.equal(f.captures, capture ? 2 : 0, 'new track reconnects capture')
  f.document.dispatchEvent(new Event('pjax:complete'))
  assert.equal(f.frames.size, 1, 'PJAX does not duplicate rendering')
  assert.equal(f.controller.toggle(), false)
  assert.equal(f.frames.size, 0)
  assert.equal(f.audio.paused, false, 'disabling never pauses music')
  if (capture) assert.equal(f.stops, 2)
  f.controller.toggle()
  f.window.dispatchEvent(new Event('pagehide'))
  assert.equal(f.frames.size, 0)
  f.window.dispatchEvent(new Event('pageshow'))
  assert.equal(f.frames.size, 1, 'BFCache restoration resumes rendering')
  f.controller.destroy()
  f.media('playing')
  assert.equal(f.frames.size, 0)
  assert.equal(f.canvas, undefined)
  assert.equal(f.dock, undefined)
  if (capture) assert.equal(f.context.state, 'closed')
}
console.log('Music visualizer: real/silent capture, single loop, DPR cap, top/bottom handoff, hysteresis, rapid scroll, pause/background/reduced motion, track changes, PJAX, storage and cleanup passed.')
