import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const utilityBuild = await build({ entryPoints: [fileURLToPath(new URL('../scripts/utils/waline-time.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false })
const code = utilityBuild.outputFiles[0].text
const module = { exports: {} }
new Function('require', 'module', 'exports', code)(require, module, module.exports)
const { adaptWalineTime, walineTimePlugin } = module.exports
const now = new Date(2026, 8, 20, 12)
const locale = { seconds: 'seconds ago', minutes: 'minutes ago', hours: 'hours ago', days: 'days ago', now: 'now' }
const dateLabel = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

for (const entry of ['waline', 'slim', 'fork']) {
const bundle = await fs.readFile(new URL(entry === 'fork' ? '../vendor/waline-fork/waline.js' : `../node_modules/@waline/client/dist/${entry}.js`, import.meta.url), 'utf8')
// Locate the formatter by its behavior, since minified names change on rebuild.
const cutoff = bundle.indexOf('a<8?`${a} ${n.days}`:')
assert.ok(cutoff >= 0, 'relative-day formatter must exist')
const declaration = [...bundle.slice(0, cutoff).matchAll(/([\w$]+)=\(e,t,n\)=>\{/g)].at(-1)
assert.ok(declaration, 'formatter declaration must exist')
const name = declaration[1]
const originalBody = bundle.slice(declaration.index, bundle.indexOf('(r)}', cutoff) + 4)
const isString = /let r=([\w$]+)\(e\)/.exec(originalBody)[1]
const absolute = /:\s*([\w$]+)\(r\)\}$/.exec(originalBody)[1]
for (const threshold of [0, 8, 30, 60, 365]) {
  const patched = adaptWalineTime(bundle, threshold)
  const start = patched.indexOf(`${name}=(e,t,n)=>`)
  const end = patched.indexOf(`:${absolute}(r)}`, start) + `:${absolute}(r)}`.length
  const body = patched.slice(start, end)
  const format = new Function(isString, absolute, `let ${body}; return ${name}`)(v => typeof v === 'string', dateLabel)
  for (const days of [0, 1, 7, 8, 29, 30, 59, 60, 364, 365]) {
    const date = new Date(now.getTime() - (days * 86400 + 120) * 1000)
    const expected = threshold === 0 || days >= threshold ? dateLabel(date) : days === 0 ? '2 minutes ago' : `${days} days ago`
    assert.equal(format(date, now, locale), expected, `threshold=${threshold}, age=${days}`)
  }
}
}
// Exercise the real public import: it resolves to slim.js, not waline.js.
const output = await build({
  stdin: { contents: "export { init } from '@waline/client'", resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
  bundle: true, write: false, format: 'esm', platform: 'browser',
  plugins: [walineTimePlugin(60)]
})
assert.ok(/\b\w+ < 60 \? `\$\{\w+\} \$\{\w+\.days\}`/.test(output.outputFiles[0].text), 'real client import must contain the configured relative-day cutoff')
for (const invalid of [-1, 1.5, '30', Infinity]) assert.throws(() => walineTimePlugin(invalid))
assert.throws(() => adaptWalineTime('unexpected upgraded bundle', 30))
console.log('Waline time: 100 full/slim boundary cases, real package import, invalid values and upstream guard passed.')
