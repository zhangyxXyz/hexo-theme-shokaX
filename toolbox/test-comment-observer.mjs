import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { transform } from 'esbuild'

const frames = new Map()
let nextFrame = 0
globalThis.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame }
globalThis.cancelAnimationFrame = id => frames.delete(id)
let nativeObserver
globalThis.MutationObserver = class {
  active = false
  constructor(callback) { this.callback = callback; nativeObserver = this }
  observe() { this.active = true }
  disconnect() { this.active = false }
  mutate() { if (this.active) this.callback() }
}
const source = await fs.readFile(new URL('../source/js/_app/components/comment-observer.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { observeCommentDecorations } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
let calls = 0
const control = observeCommentDecorations({}, () => { calls++; nativeObserver.mutate() })
for (let i = 0; i < 100; i++) nativeObserver.mutate()
assert.equal(frames.size, 1, 'coalesce native rendering mutations')
const flush = () => { const batch = [...frames.values()]; frames.clear(); batch.forEach(callback => callback()) }
flush()
assert.equal(calls, 1)
assert.equal(frames.size, 0, 'decoration writes cannot schedule themselves')
nativeObserver.mutate()
flush()
assert.equal(calls, 2, 'later native updates are still observed')
nativeObserver.mutate()
control.disconnect()
flush()
assert.equal(calls, 2, 'PJAX teardown cancels queued work')
console.log('Comment observer: coalescing, self-mutation isolation, later updates and cleanup passed.')
