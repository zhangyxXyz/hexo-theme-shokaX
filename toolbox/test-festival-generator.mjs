import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { load } from 'js-yaml'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
// Resolve the renderer's own Pug dependency under pnpm's strict dependency tree.
const rendererRequire = createRequire(require.resolve('hexo-renderer-pug'))
const pug = rendererRequire('pug')
const defaults = load(await fs.readFile(new URL('../_festivals.yml', import.meta.url), 'utf8'))
const expectedScenes = [
  'dragon_boat', 'mid_autumn', 'lantern', 'qixi', 'chongyang', 'laba',
  'lichun', 'yushui', 'jingzhe', 'chunfen', 'qingming', 'guyu',
  'lixia', 'xiaoman', 'mangzhong', 'xiazhi', 'xiaoshu', 'dashu',
  'liqiu', 'chushu', 'bailu', 'qiufen', 'hanlu', 'shuangjiang',
  'lidong', 'xiaoxue', 'daxue', 'dongzhi', 'xiaohan', 'dahan'
].sort()
const filters = []
const generators = new Map()
let renderCalls = 0
let pages = []
const previousHexo = globalThis.hexo
globalThis.hexo = {
  theme_dir: root,
  theme: { config: {} },
  locals: { get: name => name === 'pages' ? { toArray: () => pages } : undefined },
  extend: {
    filter: { register: (name, callback, priority) => filters.push({ name, callback, priority }) },
    generator: { register: (name, callback) => generators.set(name, callback) }
  },
  render: {
    render: async (input, locals) => {
      assert.equal(input.engine, 'pug')
      renderCalls++
      return pug.renderFile(input.path, { ...locals, cache: true })
    }
  }
}

try {
  const { outputFiles } = await build({
    stdin: {
      contents: "import './scripts/generaters/festival'; export { normalizeFestivalLabel } from './scripts/utils/festival-label'",
      resolveDir: root, loader: 'ts'
    },
    bundle: true, write: false, format: 'esm', platform: 'node'
  })
  const { normalizeFestivalLabel } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`)
  assert.equal(normalizeFestivalLabel('  团圆吉祥  '), '团圆')
  assert.equal(normalizeFestivalLabel('  𠮷福春  '), '𠮷福', 'truncate code points without splitting surrogate pairs')
  assert.equal(normalizeFestivalLabel('', '立春'), '', 'explicit empty labels do not use a fallback')
  assert.equal(normalizeFestivalLabel('   ', '立春'), '')
  assert.equal(normalizeFestivalLabel(undefined, '立春'), '立春')
  assert.equal(normalizeFestivalLabel(null), '')
  assert.equal(normalizeFestivalLabel({}), '')
  assert.equal(filters.length, 1)
  assert.equal(filters[0].name, 'before_generate')
  assert.equal(filters[0].priority, 20, 'artwork renders after the default-priority configuration merge')
  assert.equal(generators.size, 1)
  const generateRoutes = generators.get('festival-artwork')
  assert.equal(typeof generateRoutes, 'function')

  async function generate({ festival = {}, editTable = () => {}, preview = false } = {}) {
    const table = structuredClone(defaults)
    editTable(table)
    const config = {
      festival: { enable: true, theme: 'auto', ...festival }, festival_table: table,
      festival_artwork: { stale: 'must-be-removed.svg' },
      festival_preview_enabled: globalThis.hexo.theme.config.festival_preview_enabled
    }
    pages = preview ? [{ type: 'page' }, { type: 'festival-preview' }] : [{ type: 'page' }]
    globalThis.hexo.theme.config = config
    const before = renderCalls
    await filters[0].callback()
    const routes = generateRoutes()
    assert.ok(Array.isArray(routes))
    assert.equal(Object.keys(config.festival_artwork).length, routes.length)
    assert.equal(config.festival_artwork.stale, undefined, 'old build mappings are cleared')
    assert.equal(config.festival_preview_enabled, preview, 'preview shell support follows the current page collection')
    return {
      routes, artwork: { ...config.festival_artwork }, rendered: renderCalls - before,
      previewEnabled: config.festival_preview_enabled
    }
  }

  function inspectSvg(route) {
    const match = /^images\/festival\/([a-z_]+)\.([a-f\d]{12})\.svg$/.exec(route.path)
    assert.ok(match, `versioned asset path: ${route.path}`)
    const [, scene, hash] = match
    const svg = route.data
    assert.equal(typeof svg, 'string')
    assert.equal(createHash('sha256').update(svg).digest('hex').slice(0, 12), hash, `${scene}: content hash`)
    assert.match(svg, /^<svg\s/)
    assert.match(svg, /<\/svg>$/)
    assert.equal([...svg.matchAll(/<svg(?:\s|>)/g)].length, 1, `${scene}: one SVG root`)
    assert.equal([...svg.matchAll(/\sxmlns="http:\/\/www\.w3\.org\/2000\/svg"/g)].length, 1, `${scene}: namespace`)
    assert.doesNotMatch(svg, /(?:undefined|NaN)/, `${scene}: no missing template values`)
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
    assert.ok(ids.length > 0, `${scene}: actual paint definitions rendered`)
    const uniqueIds = new Set(ids)
    assert.equal(uniqueIds.size, ids.length, `${scene}: no duplicate SVG IDs`)
    const references = [
      ...[...svg.matchAll(/url\(\s*["']?#([^\s)'"<>]+)["']?\s*\)/g)].map(match => match[1]),
      ...[...svg.matchAll(/(?:\bhref|\bxlink:href)=["']#([^"']+)["']/g)].map(match => match[1])
    ]
    assert.ok(references.length > 0, `${scene}: actual paint references rendered`)
    for (const id of references) assert.ok(uniqueIds.has(id), `${scene}: unresolved SVG reference #${id}`)
    return scene
  }

  function inscription(svg) {
    const labels = [...svg.matchAll(/<text\b[^>]*\bdata-festival-label(?:="[^"]*")?[^>]*>([\s\S]*?)<\/text>/g)]
    assert.equal(labels.length, 1, 'each generated scene retains exactly one editable inscription node')
    return labels[0][1]
  }

  const baseline = await generate()
  assert.equal(baseline.rendered, 30)
  assert.equal(baseline.routes.length, 30, 'six separate festival assets plus 24 solar terms')
  assert.deepEqual(baseline.routes.map(inspectSvg).sort(), expectedScenes)
  assert.equal(new Set(baseline.routes.map(route => route.path)).size, 30, 'asset paths are unique')
  for (const route of baseline.routes) {
    const scene = /^images\/festival\/([a-z_]+)\./.exec(route.path)[1]
    assert.equal(baseline.artwork[scene], route.path, `${scene}: page mapping points to generated route`)
    assert.equal(Array.from(defaults.items[scene].label).length, 2, `${scene}: two-character default`)
    assert.equal(inscription(route.data), defaults.items[scene].label, `${scene}: configured default is rendered`)
  }
  assert.equal(baseline.artwork.spring, undefined, 'Spring Festival keeps its existing markup')
  assert.equal(baseline.artwork.daily, undefined, 'the daily fallback keeps its existing markup')

  const repeated = await generate()
  assert.deepEqual(repeated, baseline, 'identical inputs retain stable hashes, mapping and SVG data')

  for (const festival of [{ enable: false }, { theme: 'none' }]) {
    const disabled = await generate({ festival })
    assert.equal(disabled.rendered, 0, 'global disabling avoids rendering')
    assert.deepEqual(disabled.routes, [], 'global disabling clears previously generated routes')
    assert.deepEqual(disabled.artwork, {})
    assert.equal(disabled.previewEnabled, false)
  }

  // A preview page needs every asset even when normal site decorations are off.
  for (const festival of [{}, { enable: false }, { theme: 'none' }, { enable: false, theme: 'none' }]) {
    const preview = await generate({ preview: true, festival, editTable: table => {
      for (const item of Object.values(table.items)) item.enable = false
    } })
    assert.equal(preview.previewEnabled, true, 'preview pages retain the decoration shell')
    assert.equal(preview.rendered, 30, 'preview overrides all global and per-item generation switches')
    assert.deepEqual(preview.routes, baseline.routes, 'preview provides all original assets')
    assert.deepEqual(preview.artwork, baseline.artwork)
    assert.equal(globalThis.hexo.theme.config.festival.enable, festival.enable ?? true, 'preview does not change global configuration')
    assert.equal(globalThis.hexo.theme.config.festival.theme, festival.theme ?? 'auto')
    assert.ok(Object.values(globalThis.hexo.theme.config.festival_table.items).every(item => item.enable === false), 'preview does not re-enable table entries')
  }
  const previewRemoved = await generate({ festival: { enable: false } })
  assert.equal(previewRemoved.previewEnabled, false, 'removing the preview page clears its previous flag')
  assert.equal(previewRemoved.rendered, 0)
  assert.deepEqual(previewRemoved.routes, [], 'removing preview support restores normal disabled behavior')
  assert.deepEqual(previewRemoved.artwork, {}, 'preview routes cannot leak into the next disabled build')

  const partial = await generate({ editTable: table => {
    table.items.qingming.enable = false
    table.items.lantern.enable = false
  } })
  assert.equal(partial.routes.length, 28)
  assert.equal(partial.rendered, 28)
  assert.equal(partial.artwork.qingming, undefined)
  assert.equal(partial.artwork.lantern, undefined)
  for (const [scene, path] of Object.entries(partial.artwork)) {
    assert.equal(path, baseline.artwork[scene], `${scene}: disabling another scene does not change its asset`)
  }

  const changedCalendar = await generate({ editTable: table => {
    table.items.qingming = { ...table.items.qingming, calendar: 'solar', month: 4, day: 5 }
  } })
  assert.deepEqual(changedCalendar, baseline, 'artwork selection depends on scene, not its calendar rule')

  const unknownItems = await generate({ editTable: table => {
    table.items.unregistered = { enable: true, calendar: 'solar_term' }
    table.items['../outside'] = { enable: true, calendar: 'solar_term' }
  } })
  assert.deepEqual(unknownItems, baseline, 'unsupported item names cannot choose arbitrary templates')

  const customLabels = await generate({ editTable: table => {
    table.items.mid_autumn.label = '  团圆佳节  '
    table.items.qingming.label = '<>'
    table.items.lantern.label = ''
    table.items.laba.label = '   '
    table.items.qixi.label = '  𠮷福春  '
  } })
  const changedLabels = new Map([
    ['mid_autumn', '团圆'], ['qingming', '&lt;&gt;'], ['lantern', ''], ['laba', ''], ['qixi', '𠮷福']
  ])
  assert.equal(customLabels.routes.length, 30, 'empty inscriptions do not remove their scene artwork')
  for (const route of customLabels.routes) {
    const scene = inspectSvg(route)
    if (changedLabels.has(scene)) {
      assert.equal(inscription(route.data), changedLabels.get(scene), `${scene}: normalize and escape custom text`)
      assert.notEqual(route.path, baseline.artwork[scene], `${scene}: changed text invalidates the SVG cache key`)
    } else {
      assert.equal(route.path, baseline.artwork[scene], `${scene}: unrelated labels retain the asset hash`)
    }
  }

  console.log('Festival generator: all 30 real Pug SVGs, hashes, references, preview overrides, calendar overrides and escaped/two-character/empty inscriptions passed.')
} finally {
  if (previousHexo === undefined) delete globalThis.hexo
  else globalThis.hexo = previousHexo
}
