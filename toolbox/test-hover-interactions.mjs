import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

let now = 0, serial = 0
const timers = new Map()
const setTimeout = (callback, delay) => { const id = ++serial; timers.set(id, { callback, at: now + delay }); return id }
const clearTimeout = id => timers.delete(id)
const tick = duration => {
  now += duration
  for (const [id, task] of [...timers]) if (task.at <= now) { timers.delete(id); task.callback() }
}
function load(name, globals = {}) {
  const module = { exports: {} }
  const code = transformSync(readFileSync(new URL(`../source/js/_app/components/${name}.ts`, import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code
  vm.runInNewContext(code, { module, exports: module.exports, setTimeout, clearTimeout, ...globals })
  return module.exports
}

const { createRewardHover } = load('reward-hover')
const changes = [], bounds = { left: 100, right: 500, top: 100, bottom: 350 }
const hover = createRewardHover(value => changes.push(value))
const move = (x, y = 200) => hover.update({ x, y }, bounds)
move(101)
for (let i = 0; i < 20; i++) { move(i % 2 ? 99 : 101); tick(150) }
assert.deepEqual(changes, [true], 'Small movements at the edge cannot repeatedly flip the card')
move(80); tick(100); move(101); tick(100)
assert.deepEqual(changes, [true], 'Returning before the leave delay cancels closing')
move(80); tick(120)
assert.deepEqual(changes, [true, false])
move(200); hover.dismiss(); move(201); tick(500)
assert.deepEqual(changes, [true, false, true], 'Explicit return stays closed until the pointer leaves')
move(80); move(200)
assert.deepEqual(changes, [true, false, true, true])
move(80); hover.pause(); tick(200)
assert.equal(changes.at(-1), true, 'Opening the QR dialog cancels pending closure')
hover.destroy(); tick(200)
assert.equal(timers.size, 0)

class Element {
  listeners = new Map()
  classes = new Set()
  classList = { add: (...names) => names.forEach(name => this.classes.add(name)), remove: (...names) => names.forEach(name => this.classes.delete(name)) }
  style = { removeProperty() {} }
  addEventListener(name, callback, options) {
    const list = this.listeners.get(name) || []
    list.push({ callback, signal: options?.signal }); this.listeners.set(name, list)
  }
  fire(name, event = {}) { for (const item of this.listeners.get(name) || []) if (!item.signal?.aborted) item.callback({ type: name, target: this, pointerType: 'mouse', clientX: 120, clientY: 100, ...event }) }
  closest() { return null }
  contains(node) { return node === this }
  querySelector() { return null }
  querySelectorAll() { return [] }
  getBoundingClientRect() { return { left: 100, right: 500, top: 100, bottom: 140, width: 400 } }
  append() {}
  remove() {}
}
function article() {
  const row = new Element(), preview = new Element(), content = new Element(), toggle = new Element(), link = new Element()
  content.offsetHeight = 150
  preview.open = false
  preview.closest = selector => selector === '.article-preview-row' ? row : null
  preview.querySelector = selector => selector === 'summary' ? toggle : selector === '.article-preview-content' ? content : null
  row.querySelector = () => link
  row.contains = node => [row, preview, content, toggle, link].includes(node)
  preview.contains = node => [preview, content, toggle].includes(node)
  return { row, preview, content, toggle }
}
const a = article(), b = article(), body = new Element(), document = new Element(), window = new Element()
document.body = body
document.createElement = () => new Element()
body.querySelectorAll = () => [a.preview, b.preview]
window.setTimeout = setTimeout
const { refreshArticlePreviews, isPreviewTitleTruncated } = load('article-preview', {
  document, window, Element, Node: Element, HTMLDetailsElement: Element, AbortController,
  Date: class extends Date { static now() { return now } },
  getComputedStyle: element => ({ opacity: '0', ...element.computedStyle }),
  requestAnimationFrame: callback => setTimeout(callback, 16), cancelAnimationFrame: clearTimeout,
  matchMedia: () => ({ matches: true }), innerWidth: 1200, innerHeight: 800,
  require: () => ({ closeSelectPicker() {}, articlePreviewTarget() {}, refreshSummarySwitch() {} })
})
const graphAnchor = new Element(), graphText = new Element()
graphAnchor.querySelector = () => graphText
graphText.getAttribute = () => 'An article with a complete title'
graphText.textContent = 'An article…'
assert.equal(isPreviewTitleTruncated(graphAnchor), true, 'SVG labels use the original title rather than the shortened visible text')
graphText.textContent = graphText.getAttribute()
assert.equal(isPreviewTitleTruncated(graphAnchor), false, 'A complete SVG title is not repeated')
const clippedAnchor = new Element(), clippedTitle = new Element()
clippedAnchor.querySelectorAll = () => [clippedTitle]
Object.assign(clippedTitle, { textContent: 'A long article title', clientWidth: 120, scrollWidth: 260, clientHeight: 24, scrollHeight: 24, computedStyle: { overflowX: 'hidden' } })
assert.equal(isPreviewTitleTruncated(clippedAnchor), true, 'Nested CSS ellipsis titles are detected')
clippedTitle.scrollWidth = 120
assert.equal(isPreviewTitleTruncated(clippedAnchor), false, 'An uncut HTML title is not repeated')
Object.assign(clippedTitle, { scrollHeight: 48, computedStyle: { overflowY: 'hidden' } })
assert.equal(isPreviewTitleTruncated(clippedAnchor), true, 'Line-clamped titles also need the full title')
clippedTitle.computedStyle.overflowY = 'visible'
assert.equal(isPreviewTitleTruncated(clippedAnchor), false, 'Unclipped wrapping is not truncation')
assert.equal(isPreviewTitleTruncated(null), false)
refreshArticlePreviews()
a.row.fire('pointerenter'); tick(249)
assert.equal(a.preview.open, false, 'Initial hover retains the intent delay')
tick(1)
assert.equal(a.preview.open, true)
a.row.fire('pointerleave'); b.row.fire('pointerenter')
assert.equal(a.preview.open, false, 'The old summary closes as soon as a different row is entered')
assert.equal(a.row.classes.has('is-previewing'), false, 'The old highlight clears at the same time')
assert.equal(b.preview.open, true, 'An adjacent summary opens without another 250ms delay')
tick(300)
assert.equal(b.preview.open, true, 'The old leave timer cannot close the new summary')
b.row.fire('pointerleave'); tick(160)
assert.equal(b.preview.open, false)
tick(501)
a.row.fire('pointerenter'); tick(250)
a.row.fire('pointerleave', { clientX: 40, relatedTarget: body })
assert.equal(a.preview.classes.has('is-leaving'), true, 'Moving into whitespace starts fading immediately')
assert.equal(a.row.classes.has('is-previewing'), false, 'The previous row stops being highlighted immediately')
tick(60)
a.row.fire('pointerenter')
assert.equal(a.preview.classes.has('is-leaving'), false, 'Returning during fade reverses the transition without hiding')
assert.equal(a.preview.classes.has('is-entering'), false, 'Returning does not restart the initial fade from zero')
tick(160)
assert.equal(a.preview.open, true, 'The cancelled fade timer cannot close a returned preview')
a.row.fire('pointerleave', { clientX: 40, relatedTarget: body })
tick(300)
b.row.fire('pointerenter')
assert.equal(b.preview.open, true, 'Crossing whitespace between sections does not restart the intent delay')
const position = { left: b.content.style.left, top: b.content.style.top }
document.fire('pointermove', { target: b.row, clientX: 450 })
assert.deepEqual({ left: b.content.style.left, top: b.content.style.top }, position, 'Movement waits for the next animation frame')
tick(16)
assert.notEqual(b.content.style.left, position.left, 'The preview follows the pointer on the next frame')
b.row.fire('pointerleave', { clientX: 300, clientY: 150, relatedTarget: body })
assert.equal(b.preview.open, true, 'The small gap into the summary remains traversable')
document.fire('pointermove', { target: b.content })
tick(150)
assert.equal(b.preview.open, true, 'Entering the summary cancels its gap timer')
document.fire('pointermove', { target: body, clientX: 40 })
assert.equal(b.preview.classes.has('is-leaving'), true)
tick(80)
a.row.fire('pointerenter')
assert.equal(b.preview.open, false, 'Switching to another row does not wait for the old fade to finish')
assert.equal(a.preview.open, true)
a.row.fire('pointerleave', { clientX: 40, relatedTarget: body })
tick(160)
tick(501)
a.row.fire('pointerenter')
assert.equal(a.preview.open, false, 'A new interaction after the warm interval retains the intent delay')
tick(250)
a.toggle.fire('click', { preventDefault() {} })
document.fire('pointermove', { target: body, clientX: 40 })
assert.equal(a.preview.open, true, 'Explicitly pinned previews remain open')
document.fire('keydown', { key: 'Escape' })
assert.equal(a.preview.open, false)
a.row.fire('pointerenter'); refreshArticlePreviews(); tick(300)
assert.equal(a.preview.open, false, 'Reinitialization cancels pending previews')
console.log('Hover regressions: reward edge tolerance, leave cancellation, explicit return, dialog pause, immediate summary handoff and lifecycle passed.')
