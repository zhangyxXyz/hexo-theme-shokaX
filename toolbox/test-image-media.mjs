import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await fs.readFile(new URL('../source/js/_app/components/image-media.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { createImageMedia } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

// Advance just the media timers; promise jobs still use the real microtask queue.
let now = 0
let nextTimer = 0
const timers = new Map()
globalThis.setTimeout = (callback, delay = 0) => {
  const id = ++nextTimer
  timers.set(id, { callback, at: now + delay })
  return id
}
globalThis.clearTimeout = id => timers.delete(id)
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }
const advance = async milliseconds => {
  const end = now + milliseconds
  while (true) {
    const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0]
    if (!next) break
    now = next[1].at
    timers.delete(next[0])
    next[1].callback()
    await settle()
  }
  now = end
  await settle()
}

const observers = []
globalThis.IntersectionObserver = class {
  targets = new Set()
  constructor(callback, options) { this.callback = callback; this.options = options; observers.push(this) }
  observe(image) { this.targets.add(image) }
  unobserve(image) { this.targets.delete(image) }
  disconnect() { this.targets.clear() }
  enter(image) { if (this.targets.has(image)) this.callback([{ target: image, isIntersecting: true }]) }
}

class Image extends EventTarget {
  complete = false
  naturalWidth = 0
  srcset = ''
  sizes = ''
  currentSrc = ''
  loading = 'eager'
  picture = null
  classes = new Set()
  classList = {
    add: (...names) => names.forEach(name => this.classes.add(name)),
    remove: (...names) => names.forEach(name => this.classes.delete(name))
  }
  decode = () => Promise.resolve()
  closest = () => this.picture
  constructor(name) { super(); this.src = `https://example.com/${name}.png` }
  load(selected = this.src) {
    this.complete = true
    this.naturalWidth = 48
    this.currentSrc = selected
    this.dispatchEvent(new Event('load'))
  }
}
const fixture = (images, warm = []) => {
  const container = {
    images, warm,
    contains(image) { return this.images.includes(image) },
    querySelectorAll(selector) { return selector === '.warm' ? this.warm : this.images }
  }
  const media = createImageMedia(container, { selector: 'img', warmSelector: '.warm' })
  return { container, media, observer: observers.at(-1) }
}
const noEffect = (image, message) => assert.equal(image.classes.size, 0, message)
const cached = new Image('cached-immediate')
cached.load()
const first = fixture([cached])
first.media.sync()
noEffect(cached, 'an already loaded resource must never gain a blur class')
assert.equal(timers.size, 0)
first.media.destroy()
const shared = new Image('cached-immediate')
const sharedFixture = fixture([shared])
sharedFixture.media.sync()
noEffect(shared, 'successful source memory survives a previous component teardown')
assert.equal(timers.size, 0)
sharedFixture.media.destroy()

const fast = new Image('fast-async')
const fastFixture = fixture([fast])
fastFixture.media.sync()
await advance(40)
fast.load()
await settle()
await advance(100)
noEffect(fast, 'quick asynchronous cache-like loads must not flash or replay')
fastFixture.media.destroy()

const slow = new Image('slow-decode')
let decode
slow.decode = () => new Promise(resolve => { decode = resolve })
const slowFixture = fixture([slow])
slowFixture.media.sync()
slow.load()
await advance(101)
assert.ok(slow.classes.has('comment-media-pending'), 'slow decoding still needs the loading treatment')
decode()
await settle()
assert.ok(slow.classes.has('comment-media-ready'))
assert.ok(!slow.classes.has('comment-media-pending'))
const animation = new Event('animationend')
Object.defineProperty(animation, 'animationName', { value: 'comment-media-reveal' })
slow.dispatchEvent(animation)
noEffect(slow, 'finished animations must not override ordinary image filters')
slowFixture.media.destroy()

const failed = new Image('error-retry')
const failedFixture = fixture([failed])
failedFixture.media.sync()
await advance(101)
failed.dispatchEvent(new Event('error'))
await settle()
noEffect(failed, 'failed loads must remove the veil')
failedFixture.media.destroy()
const retry = new Image('error-retry')
const retryFixture = fixture([retry])
retryFixture.media.sync()
await advance(101)
assert.ok(retry.classes.has('comment-media-pending'), 'failures cannot warm the successful-source cache')
retryFixture.media.destroy()
noEffect(retry, 'teardown removes pending styling')

const lazy = new Image('offscreen-lazy')
lazy.loading = 'lazy'
const lazyFixture = fixture([lazy])
lazyFixture.media.sync()
assert.ok(lazyFixture.observer.targets.has(lazy))
await advance(9000)
noEffect(lazy, 'offscreen waiting must not start a loading animation')
assert.equal(timers.size, 0, 'offscreen waiting must not consume the image timeout')
lazyFixture.observer.enter(lazy)
await advance(101)
assert.ok(lazy.classes.has('comment-media-pending'))
lazy.load()
await settle()
assert.ok(lazy.classes.has('comment-media-ready'), 'lazy loading still reveals after eventually entering view')
lazyFixture.media.destroy()
assert.equal(lazyFixture.observer.targets.size, 0)

const earlyLazy = new Image('lazy-before-observer')
earlyLazy.loading = 'lazy'
const earlyFixture = fixture([earlyLazy])
earlyFixture.media.sync()
earlyLazy.load()
await settle()
await advance(101)
noEffect(earlyLazy, 'a native lazy load may finish before the visibility callback')
assert.equal(earlyFixture.observer.targets.size, 0)
earlyFixture.media.destroy()

const failedLazy = new Image('lazy-error-before-observer')
failedLazy.loading = 'lazy'
const failedLazyFixture = fixture([failedLazy])
failedLazyFixture.media.sync()
failedLazy.dispatchEvent(new Event('error'))
failedLazyFixture.observer.callback([{ target: failedLazy, isIntersecting: true }])
await advance(101)
noEffect(failedLazy, 'queued visibility work cannot restart an already failed lazy image')
assert.equal(timers.size, 0)
failedLazyFixture.media.destroy()

const timedOut = new Image('timeout')
const timeoutFixture = fixture([timedOut])
timeoutFixture.media.sync()
await advance(8001)
noEffect(timedOut, 'a timed out load must not remain blurred')
timeoutFixture.media.destroy()

const changed = new Image('old-source')
let oldDecode
changed.decode = () => new Promise(resolve => { oldDecode = resolve })
const changedFixture = fixture([changed])
changedFixture.media.sync()
changed.load()
await advance(101)
changed.src = 'https://example.com/new-source.png'
changed.complete = false
changed.naturalWidth = 0
changed.decode = () => Promise.resolve()
changedFixture.media.sync()
oldDecode()
await settle()
noEffect(changed, 'an old decode completion must not reveal a replacement source')
await advance(101)
assert.ok(changed.classes.has('comment-media-pending'))
changed.load()
await settle()
assert.ok(changed.classes.has('comment-media-ready'))
changedFixture.media.destroy()

const warm = new Image('picker-warm')
warm.load()
const preview = new Image('picker-warm')
const warmFixture = fixture([preview], [warm])
warmFixture.media.sync()
assert.equal(timers.size, 0)
noEffect(preview, 'already loaded picker images must warm preview resources')
warmFixture.media.destroy()

const responsive = new Image('responsive-fallback')
responsive.srcset = 'small.png 1x, large.png 2x'
responsive.load('https://example.com/small.png')
const responsiveFixture = fixture([responsive])
responsiveFixture.media.sync()
responsive.complete = false
responsive.naturalWidth = 0
responsive.currentSrc = 'https://example.com/large.png'
responsiveFixture.media.sync()
await advance(101)
assert.ok(responsive.classes.has('comment-media-pending'), 'one responsive candidate cannot warm another')
responsive.load('https://example.com/large.png')
await settle()
assert.ok(responsive.classes.has('comment-media-ready'))
responsiveFixture.media.destroy()

const cancelled = new Image('destroyed')
const cancelledFixture = fixture([cancelled])
cancelledFixture.media.sync()
cancelledFixture.media.destroy()
cancelled.load()
await advance(9000)
noEffect(cancelled, 'late loads after destruction must never mutate image styling')
assert.equal(timers.size, 0, 'all lifecycle timers are cleaned up')
cancelledFixture.media.sync()
assert.equal(timers.size, 0, 'destroyed instances cannot restart')

console.log('Image media: cache/grace/decode/error/lazy/timeout/source/picker/responsive/animation/teardown passed.')
