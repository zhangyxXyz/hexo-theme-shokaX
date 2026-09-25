import assert from 'node:assert/strict'
import { build } from 'esbuild'

const result = await build({ entryPoints: [new URL('../source/js/_app/components/music-width.ts', import.meta.url).pathname.replace(/^\/(.:)/, '$1')], bundle: true, format: 'cjs', write: false })
const module = { exports: {} }
let now = 0, id = 0
const frames = new Map()
new Function('module', 'exports', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', result.outputFiles[0].text)(
  module, module.exports, { now: () => now }, fn => { frames.set(++id, fn); return id }, key => frames.delete(key))
let width
const motion = module.exports.createMusicWidth(value => { width = value })
const step = elapsed => {
  now += elapsed
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach(fn => fn(now))
}
motion.set(224, false)
motion.set(500, true)
assert.equal(width, 224, 'new target must not jump before the next frame')
step(16)
assert.ok(width > 224 && width < 500)
const middle = width
motion.set(300, true)
assert.equal(width, middle, 'retarget must preserve the current rendered width')
assert.equal(frames.size, 1, 'retarget must not start a second frame loop')
step(16)
assert.ok(width > middle && width < 300)
motion.set(224, true)
const turning = width
step(16)
assert.ok(width < turning && width > 224, 'interrupted expansion must smoothly reverse')
for (let index = 0; index < 100; index++) step(16)
assert.equal(width, 224)
assert.equal(frames.size, 0, 'settled animation must stop scheduling frames')
motion.set(500, true)
step(16)
motion.finish()
assert.equal(width, 500)
assert.equal(frames.size, 0, 'hidden documents must stop animation')
motion.set(224, false)
assert.equal(width, 224, 'reduced motion applies the target directly')
motion.set(500, true)
step(32)
const at32 = width
motion.set(224, false)
motion.set(500, true)
step(16); step(16)
assert.ok(Math.abs(width - at32) < 1e-9, 'damping must not depend on refresh rate')
console.log('Music width: interpolation, retargeting, reversal, settling, visibility and refresh rate passed.')
