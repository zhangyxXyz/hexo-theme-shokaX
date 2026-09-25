import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const result = await build({
  entryPoints: [fileURLToPath(new URL('../source/js/_app/components/tooltip-content.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'cjs', write: false
})
const module = { exports: {} }
new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
const { parseTooltipContent, tooltipPlainText, renderTooltipContent } = module.exports

const hint = '通过 {icon:i-desktop-lyrics-on} 桌面歌词按钮开启'
assert.deepEqual(parseTooltipContent(hint), [
  { text: '通过 ' }, { icon: 'i-desktop-lyrics-on' }, { text: ' 桌面歌词按钮开启' }
])
assert.deepEqual(parseTooltipContent('{icon:i-audio-visualizer|#8fcfc8}{icon:i-play|#ABC}'), [
  { icon: 'i-audio-visualizer', color: '#8fcfc8' }, { icon: 'i-play', color: '#ABC' }
])
assert.equal(tooltipPlainText(hint), '通过 桌面歌词按钮开启')
assert.equal(tooltipPlainText('播放\n{icon:i-play} 按钮'), '播放\n 按钮')
assert.deepEqual(parseTooltipContent(''), [])
for (const literal of [
  '<img src=x onerror=alert(1)>', '{icon:i-play other-class}',
  '{icon:i-play|red}', '{icon:i-play|#1234}', '{icon:i-play|url(https://example.com)}',
  '{icon:i-play\" onclick=\"alert(1)}'
]) assert.deepEqual(parseTooltipContent(literal), [{ text: literal }])

// A minimal DOM fixture makes node creation and mutation count observable.
const ownerDocument = {
  createTextNode: text => ({ type: 'text', text }),
  createElement: tag => ({ tag, style: {}, attrs: {}, setAttribute(key, value) { this.attrs[key] = value } })
}
let mutations = 0
const target = { ownerDocument, nodes: [], replaceChildren(...nodes) { this.nodes = nodes; mutations++ } }
assert.equal(renderTooltipContent(target, hint), true)
assert.equal(target.nodes[1].className, 'ic tooltip-inline-icon i-desktop-lyrics-on')
assert.equal(target.nodes[1].attrs['aria-hidden'], 'true')
assert.deepEqual(target.nodes[1].style, {})
for (let i = 0; i < 10; i++) assert.equal(renderTooltipContent(target, hint), false)
assert.equal(mutations, 1, 'observer callbacks must not re-render identical icon content')
renderTooltipContent(target, '{icon:i-play|#8fcfc8}')
assert.equal(target.nodes[0].style.color, '#8fcfc8')
renderTooltipContent(target, '<b>plain text</b>')
assert.deepEqual(target.nodes, [{ type: 'text', text: '<b>plain text</b>' }])
renderTooltipContent(target, '')
assert.deepEqual(target.nodes, [])
console.log('Tooltip content tests passed')
