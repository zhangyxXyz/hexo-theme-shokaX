import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await fs.readFile(new URL('../source/js/_app/components/comment-pagination.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { createCommentPagination: create } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
globalThis.window = Object.assign(new EventTarget(), { innerHeight: 1000 })
globalThis.document = new EventTarget()
let frame
globalThis.requestAnimationFrame = callback => { frame = callback; return 1 }
globalThis.cancelAnimationFrame = () => { frame = undefined }
const flush = () => { const callback = frame; frame = undefined; callback?.() }
let clicks = 0, position = 1100, count = 10, loading = false, blocked = false
const button = { disabled: false, click: () => clicks++, getBoundingClientRect: () => ({ top: position, bottom: position + 40, width: 100, height: 40 }) }
const comments = Object.assign(new EventTarget(), {
  querySelector: selector => selector === '.wl-cards + .wl-loading' ? loading : selector === '.wl-loading' ? {} : button,
  querySelectorAll: () => Array.from({ length: count }, (_, id) => ({ id: String(id) }))
})
const dialog = Object.assign(new EventTarget(), { open: true, getBoundingClientRect: () => ({ top: 0, bottom: 800 }) })
const control = create(comments, dialog, () => blocked)
const wheel = (deltaY = 100) => { dialog.dispatchEvent(Object.assign(new Event('wheel'), { deltaY })); flush() }
dialog.dispatchEvent(new Event('scroll')); flush()
assert.equal(clicks, 0, 'programmatic scroll cannot load')
wheel(); assert.equal(clicks, 0, 'far from button')
position = 959 // 800px viewport + 160px threshold
wheel(); assert.equal(clicks, 1)
wheel(); assert.equal(clicks, 1, 'same page cannot request twice')
count = 20
dialog.dispatchEvent(new Event('scroll')); flush()
assert.equal(clicks, 1, 'new rows alone cannot chain another request')
wheel(-100); assert.equal(clicks, 1)
loading = true; wheel(); loading = false
dialog.dispatchEvent(new Event('scroll')); flush()
assert.equal(clicks, 1, 'input during loading must not queue another request')
wheel(); assert.equal(clicks, 2)
count = 30; blocked = true; wheel(); assert.equal(clicks, 2)
blocked = false; dialog.open = false; wheel(); assert.equal(clicks, 2)
dialog.open = true; control.reset()
dialog.dispatchEvent(new Event('scroll')); flush(); assert.equal(clicks, 2)
control.destroy(); wheel(); assert.equal(clicks, 2)
const bottom = create(comments, null, () => false)
position = 1199
window.dispatchEvent(Object.assign(new Event('wheel'), { deltaY: 100 })); flush()
assert.equal(clicks, 3, 'bottom layout uses window viewport')
bottom.destroy()
console.log('Comment pagination: threshold, direction, single request, failure guard, programmatic scroll, loading, close, cleanup and bottom layout passed.')
