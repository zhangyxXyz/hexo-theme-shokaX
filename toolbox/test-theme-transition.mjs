import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const bundle = await build({
  stdin: {
    contents: "export * from './runner'; export * from './index'",
    resolveDir: fileURLToPath(new URL('../source/js/_app/components/theme-transition/', import.meta.url))
  }, bundle: true, platform: 'node', format: 'cjs', write: false
})

let time = 0, nextId = 0
const timers = new Map(), mounted = new Set(), animations = new Set(), frames = new Map()
function element() {
  const classes = new Set()
  return {
    style: { setProperty() {} }, setAttribute() {}, append() {},
    animate(keyframes, options) {
      let resolve, reject
      const animation = {
        keyframes, options,
        finished: new Promise((yes, no) => { resolve = yes; reject = no }),
        complete() { resolve() },
        cancel() { animations.delete(animation); reject(new Error('cancelled')) }
      }
      animations.add(animation)
      return animation
    },
    classList: { add(name) { classes.add(name) }, toggle(name, on) { if (on) classes.add(name); else classes.delete(name) } },
    remove() { mounted.delete(this) }
  }
}
const sandbox = {
  exports: {}, document: { createElement: element, body: { append(node) { mounted.add(node) } } },
  window: { innerWidth: 390, innerHeight: 844 },
  setTimeout(callback, delay) { const id = ++nextId; timers.set(id, { callback, at: time + delay }); return id },
  clearTimeout(id) { timers.delete(id) },
  requestAnimationFrame(callback) { const id = ++nextId; frames.set(id, callback); return id },
  cancelAnimationFrame(id) { frames.delete(id) }
}
const module = { exports: {} }
vm.runInNewContext(bundle.outputFiles[0].text, { ...sandbox, module })
const { createThemeTransitionRunner, resolveThemeEffect } = module.exports
const origin = { x: 360, y: 25 }
const applied = []
const runner = createThemeTransitionRunner(mode => applied.push(mode))
function advance(ms) {
  const end = time + ms
  while (true) {
    const item = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0]
    if (!item || item[1].at > end) break
    time = item[1].at
    timers.delete(item[0])
    item[1].callback()
  }
  time = end
}
function clean() {
  assert.equal(runner.running, false)
  assert.equal(mounted.size, 0)
  assert.equal(timers.size, 0)
  assert.equal(animations.size, 0)
  assert.equal(frames.size, 0)
}
async function finishAnimation() {
  assert.equal(animations.size, 1)
  animations.values().next().value.complete()
  await Promise.resolve()
}
function paint() {
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach(callback => callback())
}
for (const invalid of [undefined, '', 'typo', '__proto__', 'constructor']) {
  assert.equal(resolveThemeEffect(invalid), resolveThemeEffect('sunrise'))
}
for (const name of ['sunrise', 'moon-stars']) {
  for (const to of ['dark', 'light']) {
    const from = to === 'dark' ? 'light' : 'dark'
    const before = applied.length
    runner.run(resolveThemeEffect(name), from, to, origin, false)
    runner.run(resolveThemeEffect(name), from, to, origin, false)
    assert.equal(mounted.size, 1, 'rapid clicks must not duplicate overlays')
    if (name === 'sunrise') {
      advance(409)
      assert.equal(applied.length, before)
      advance(1)
    } else {
      // Simulate a busy/throttled browser: elapsed time is NOT animation progress.
      advance(5000)
      assert.equal(applied.length, before, 'never change color before actual full reveal')
      assert.equal(mounted.size, 1, 'never remove an unfinished reveal on a timer')
      await finishAnimation()
      assert.equal([...mounted][0].style.clipPath, 'none', 'full coverage survives releasing the reveal animation')
      assert.equal(animations.size, 0, 'fading must wait for a covered paint')
      paint()
      assert.equal(animations.size, 0)
      paint()
      assert.equal(animations.size, 1)
      advance(5000)
      assert.equal(mounted.size, 1, 'fading must also finish before cleanup')
      await finishAnimation()
    }
    assert.equal(applied.at(-1), to)
    advance(4000)
    assert.equal(applied.length, before + 1, 'finish must not double commit')
    clean()
  }
  runner.run(resolveThemeEffect(name), 'light', 'dark', origin, false)
  runner.cancel() // PJAX, pagehide or reduced motion changed mid-flight.
  await Promise.resolve()
  assert.equal(applied.at(-1), 'dark')
  clean()
  const beforeCancel = applied.length
  runner.run(resolveThemeEffect(name), 'dark', 'light', origin, false)
  runner.cancel(false) // A system color update supersedes pending manual animation.
  await Promise.resolve()
  advance(5000)
  assert.equal(applied.length, beforeCancel)
  clean()
  runner.run(resolveThemeEffect(name), 'dark', 'light', origin, true)
  assert.equal(applied.at(-1), 'light')
  clean()
}
runner.run(resolveThemeEffect('moon-stars'), 'light', 'dark', origin, false)
await finishAnimation()
runner.cancel() // Cancel between commit and the covered paint.
paint()
clean()
runner.run(resolveThemeEffect('moon-stars'), 'dark', 'light', origin, false)
await finishAnimation()
paint()
paint()
runner.cancel() // Cancel the fade, with no late callback touching another run.
await Promise.resolve()
clean()
runner.run(context => { context.mount(element()); throw new Error('broken effect') }, 'light', 'dark', origin, false)
assert.equal(applied.at(-1), 'dark')
clean()
runner.run(context => context.after(10, () => { throw new Error('broken timer') }), 'dark', 'light', origin, false)
advance(10)
assert.equal(applied.at(-1), 'light')
clean()
console.log('Theme transition tests passed: both directions, fallback, rapid clicks, reduced motion, cancellation and failures')
