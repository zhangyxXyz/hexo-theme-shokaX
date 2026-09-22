import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { build, transform } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const formatterSource = await fs.readFile(new URL('../source/js/_app/components/comment-time.ts', import.meta.url), 'utf8')
const { code } = await transform(formatterSource, { loader: 'ts', format: 'esm' })
const { formatCommentTime } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const adapter = await build({ entryPoints: [fileURLToPath(new URL('../scripts/utils/waline-time.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false })
const module = { exports: {} }
new Function('require', 'module', 'exports', adapter.outputFiles[0].text)(require, module, module.exports)
const { adaptWalineTime } = module.exports
const original = await fs.readFile(new URL('../vendor/waline-fork/waline.js', import.meta.url), 'utf8')

// Extract the actual pinned client's formatter and its date-padding helpers.
// This catches drift from Waline's rounded seconds and configurable day cutoff.
const cutoff = original.indexOf('a<8?`${a} ${n.days}`:')
assert.ok(cutoff >= 0)
const declaration = [...original.slice(0, cutoff).matchAll(/([\w$]+)=\(e,t,n\)=>\{/g)].at(-1)
assert.ok(declaration)
const name = declaration[1]
const body = original.slice(declaration.index, original.indexOf('(r)}', cutoff) + 4)
const isString = /let r=([\w$]+)\(e\)/.exec(body)[1]
const absolute = /:\s*([\w$]+)\(r\)\}$/.exec(body)[1]
const absoluteStart = original.lastIndexOf(`${absolute}=e=>{`, declaration.index)
assert.ok(absoluteStart >= 0)
const absoluteSource = original.slice(absoluteStart, original.indexOf('},', absoluteStart) + 1)
const pad = /let t=([\w$]+)\(e\.getDate\(\),2\)/.exec(absoluteSource)[1]
const padStart = original.lastIndexOf(`${pad}=(e,t)=>{`, absoluteStart)
assert.ok(padStart >= 0)
const padSource = original.slice(padStart, original.indexOf('},', padStart) + 1)
const oracle = days => {
  const patched = adaptWalineTime(original, days)
  const start = patched.indexOf(`${name}=(e,t,n)=>`)
  const ending = `:${absolute}(r)}`
  const end = patched.indexOf(ending, start) + ending.length
  return new Function(isString, `let ${padSource},${absoluteSource},${patched.slice(start, end)}; return ${name}`)(value => typeof value === 'string')
}

const now = new Date(2026, 8, 22, 12, 0, 0).getTime()
const locales = [
  { seconds: 'seconds ago', minutes: 'minutes ago', hours: 'hours ago', days: 'days ago', now: 'now' },
  { seconds: '秒前', minutes: '分钟前', hours: '小时前', days: '天前', now: '刚刚' }
]
const ages = [
  -86400001, -1, 0, 1, 499, 500, 1499, 1500, 59499, 59500, 59999,
  60000, 60001, 3599999, 3600000, 3600001, 86399999, 86400000, 86400001,
  7 * 86400000, 8 * 86400000, 59 * 86400000, 60 * 86400000 - 1, 60 * 86400000,
  365 * 86400000, now
]
let checked = 0
for (const days of [0, 1, 8, 60, 365]) {
  const reference = oracle(days)
  for (const locale of locales) {
    for (const age of ages) {
      const timestamp = now - age
      assert.equal(formatCommentTime(timestamp, now, days, locale), reference(new Date(timestamp), new Date(now), locale), `days=${days}, age=${age}`)
      checked++
    }
    for (const value of ['2026-09-21T18:30:00+08:00', '2026-09-21 18:30:00', '2023-05-25T00:24:35Z']) {
      assert.equal(formatCommentTime(value, now, days, locale), reference(value, new Date(now), locale), `days=${days}, date=${value}`)
      checked++
    }
  }
}
for (const value of ['', 'invalid', NaN, Infinity, 9e20]) assert.equal(formatCommentTime(value, now, 60, locales[0]), '')
assert.equal(formatCommentTime(now, NaN, 60, locales[0]), '')
for (const days of [-1, NaN, Infinity, 1.5]) assert.equal(formatCommentTime(now, now, days, locales[0]), '')
assert.equal(formatCommentTime(now - 59500, now, 60, locales[0]), '60 seconds ago')
assert.equal(formatCommentTime(now - 60000, now, 60, locales[0]), '1 minutes ago')
console.log(`Comment time: ${checked} comparisons with the pinned Waline formatter plus invalid-input boundaries passed.`)
