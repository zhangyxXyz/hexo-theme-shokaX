import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const result = await build({
  entryPoints: [fileURLToPath(new URL('../scripts/utils/icon-baselines.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'cjs', write: false
})
const module = { exports: {} }
new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
const { iconBaselineCSS } = module.exports
const config = { font: 'fixture', default: .02, icons: { 'i-up': -.08, 'i-down': .05, 'i-zero': 0 } }
const css = iconBaselineCSS(config, 'fixture')
assert.match(css, /--icon-baseline-default:0.02em/)
assert.match(css, /\.ic\.i-up\{--icon-baseline:-0.08em\}/)
assert.match(css, /\.ic\.i-down\{--icon-baseline:0.05em\}/)
assert.match(css, /\.ic\.i-zero\{--icon-baseline:0em\}/)
assert.equal(iconBaselineCSS(config, 'different-font'), '', 'font updates must not reuse old glyph corrections')
for (const value of [null, undefined, [], 'text', { icons: {} }]) assert.equal(iconBaselineCSS(value, 'fixture'), '')
assert.equal(iconBaselineCSS({ font: 'fixture', default: '1em', icons: {
  'i-invalid-color': 'red', 'i-infinite': Infinity, 'i-nan': NaN, 'i-object': {},
  'i-large': .51, 'i-small': -.51, 'i-attack}</style><script>': .1
} }, 'fixture'), ':root{--icon-baseline-default:0em}')
assert.equal(iconBaselineCSS({ font: 'fixture', icons: [] }, 'fixture'), ':root{--icon-baseline-default:0em}')
console.log('Icon baseline config: defaults, overrides, zero, signs, font version and invalid values passed.')
