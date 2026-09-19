import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await fs.readFile(new URL('../source/js/_app/components/comment-media.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { waitCommentImage: wait, createCommentMedia } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
class Image extends EventTarget {
  complete = false
  naturalWidth = 0
  decode = () => Promise.resolve()
}
const controller = new AbortController()
const cached = new Image()
cached.complete = true
cached.naturalWidth = 48
assert.equal(await wait(cached, controller.signal), true)
const broken = new Image()
broken.complete = true
assert.equal(await wait(broken, controller.signal), false)
const delayed = new Image()
let decoded
delayed.decode = () => new Promise(resolve => { decoded = resolve })
let done = false
const loading = wait(delayed, controller.signal).then(value => { done = true; return value })
delayed.naturalWidth = 48
delayed.dispatchEvent(new Event('load'))
await Promise.resolve()
assert.equal(done, false, 'must wait for decoding, not just load')
decoded()
assert.equal(await loading, true)
const failed = new Image()
const error = wait(failed, controller.signal)
failed.dispatchEvent(new Event('error'))
assert.equal(await error, false)
assert.equal(await wait(new Image(), controller.signal, 5), false, 'slow image must time out')
const cancelled = new AbortController()
const cancel = wait(new Image(), cancelled.signal)
cancelled.abort()
assert.equal(await cancel, false)
assert.equal(await wait(new Image(), cancelled.signal), false)
console.log('Comment media: cached, decode, broken, error, timeout and cancellation passed.')

class PreviewImage extends Image {
  srcset = ''
  classes = new Set()
  classList = {
    add: (...names) => names.forEach(name => this.classes.add(name)),
    remove: (...names) => names.forEach(name => this.classes.delete(name))
  }
  constructor(src) { super(); this.src = src; this.complete = true; this.naturalWidth = 48 }
}
let images = [new PreviewImage('https://example.com/emoji.png')]
let pickerImages = []
images[0].complete = false
const media = createCommentMedia({
  contains: image => images.includes(image),
  querySelectorAll: selector => selector === '.wl-emoji-popup img' ? pickerImages : images
})
const settle = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
media.sync()
assert.ok(images[0].classes.has('comment-media-pending'))
images[0].dispatchEvent(new Event('load'))
await settle()
assert.ok(images[0].classes.has('comment-media-ready'), 'first successful load reveals')
images = [new PreviewImage('https://example.com/emoji.png')]
media.sync()
await settle()
assert.equal(images[0].classes.size, 0, 'replaced preview node must not blur or replay')
images[0].src = 'https://example.com/new.png'
images[0].complete = false
media.sync()
assert.ok(images[0].classes.has('comment-media-pending'), 'new resource still loads with a reveal')
images[0].dispatchEvent(new Event('load'))
await settle()
assert.ok(images[0].classes.has('comment-media-ready'))
images = [new PreviewImage('https://example.com/retry.png')]
images[0].naturalWidth = 0
media.sync()
await settle()
images = [new PreviewImage('https://example.com/retry.png')]
images[0].complete = false
media.sync()
assert.ok(images[0].classes.has('comment-media-pending'), 'failed resources must not count as revealed')
images[0].dispatchEvent(new Event('load'))
await settle()
images = [new PreviewImage('https://example.com/cached.png')]
media.sync()
assert.equal(images[0].classes.size, 0, 'already loaded cache hit must never blur')
pickerImages = [new PreviewImage('https://example.com/picker.png')]
images = [new PreviewImage('https://example.com/picker.png')]
images[0].complete = false
media.sync()
assert.equal(images[0].classes.size, 0, 'loaded picker emoji must not replay when inserted in preview')
media.destroy()
assert.equal(images[0].classes.size, 0)
console.log('Comment media: preview replacement, changed source, failed retry and cleanup passed.')
