import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await fs.readFile(new URL('../scripts/utils/waline-preview.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'esm' })
const { adaptWalinePreview } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
for (const entry of ['slim', 'waline']) {
  const bundle = await fs.readFile(new URL(`../node_modules/@waline/client/dist/${entry}.js`, import.meta.url), 'utf8')
  const patched = adaptWalinePreview(bundle)
  const dependency = patched.match(/\(\)=>\[([\w$]+)\.value,([\w$]+)\.value.map\],\(\[e\]\)=>\{let\{highlighter/)
  assert.ok(dependency, `${entry}: native preview watches both draft and emoji map`)
  const draft = { value: ':bb_bizui.png: unchanged draft' }
  const emoji = { value: { map: {} } }
  const read = new Function(dependency[1], dependency[2], `return [${dependency[1]}.value,${dependency[2]}.value.map]`)
  const before = read(draft, emoji)
  emoji.value = { map: { 'bb_bizui.png': '/emoji/bb_bizui.png' } }
  const after = read(draft, emoji)
  assert.equal(after[0], before[0], 'draft is not changed to force a preview')
  assert.notEqual(after[1], before[1], 'async emoji readiness invalidates the preview')
  await transform(patched, { loader: 'js' })
  assert.throws(() => adaptWalinePreview(patched), /expects/, 'guard against double adaptation')
}
assert.throws(() => adaptWalinePreview('changed upstream bundle'), /expects/)
console.log('Waline preview: full/slim draft restoration, async emoji dependencies and upstream guards passed.')
