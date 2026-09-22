import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await fs.readFile(new URL('../source/js/_app/components/footer-visitors.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { formatVisitorCount: format } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

for (const [value, expected] of [
  [0, '0'], [42, '42'], [999, '999'], [1000, '1k'], [1234, '1.2k'],
  [51468, '51.5k'], [99949, '99.9k'], [99950, '100k'], [100000, '100k'],
  [999499, '999k'], [999500, '1M'], [1000000, '1M'], [1250000, '1.3M'],
  [999500000, '1B'], [1000000000000, '1T'],
  [-1, '—'], [NaN, '—'], [Infinity, '—'], [1.5, '—'], [Number.MAX_SAFE_INTEGER + 1, '—']
]) assert.equal(format(value), expected, String(value))

console.log('Footer visitor formatting: 20 boundary cases passed.')
