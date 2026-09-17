const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { buildSync } = require('esbuild')

class Element {
  children = []
  dataset = {}
  attributes = {}
  clientWidth = 800
  classList = { add() {}, remove() {}, toggle() {} }
  style = {}
  scrollLeft = 0
  setPointerCapture() {}
  get parentElement() { return this.parent }
  append(...nodes) { this.children.push(...nodes); nodes.forEach(node => { node.parent = this }) }
  before(node) { this.parent.children.splice(this.parent.children.indexOf(this), 0, node); node.parent = this.parent }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes) }
  setAttribute(key, value) { this.attributes[key] = value }
  getAttribute(key) { return this.attributes[key] ?? null }
  remove() {}
  querySelectorAll() { return this.children.filter(node => node.dataset.statisticsChart) }
}

async function main() {
  const root = new Element()
  for (const key of ['calendar', 'map', 'trends', 'sources', 'posts', 'tags', 'categories']) {
    const slot = new Element()
    slot.dataset.statisticsChart = key
    root.append(slot)
  }
  const configNode = new Element()
  const labels = Object.fromEntries(['loading', 'failed', 'expired', 'empty', 'retry', 'provinces', 'countries', 'south_sea', 'count', 'visits'].map(key => [key, key]))
  configNode.dataset.statisticsConfig = JSON.stringify({ baidu: { api: 'https://example.test/stats', site_id: 'test' }, assets: { echarts: '/echarts.js', maps: { china: '/china.json', world: '/world.json' } }, labels, data: { posts: [{ name: '2026-01', value: 1 }], tags: [{ name: 'Tag', value: 1 }], categories: [{ name: 'Category', value: 1 }] } })
  let active = true
  const requests = []
  const charts = []
  const observers = []
  const maps = new Map()
  const echarts = {
    graphic: { LinearGradient: class {} },
    getMap: name => maps.get(name),
    registerMap: (name, geoJson) => maps.set(name, { geoJson }),
    init: body => {
      assert(!charts.some(chart => chart.body === body && !chart.disposed), 'No duplicate live chart on a body')
      const chart = { body, actions: [], setOption(option) { this.option = option }, resize() {}, dispatchAction(action) { this.action = action; this.actions.push(action) }, convertToPixel(_, point) { return [point[0], -point[1]] }, dispose() { this.disposed = true } }
      charts.push(chart)
      return chart
    }
  }
  const head = new Element()
  class Observer {
    constructor() { observers.push(this) }
    observe() {}
    disconnect() { this.disconnected = true }
  }
  const context = {
    exports: {}, module: { exports: {} }, URL, Date, Intl, AbortController, AbortSignal, clearTimeout,
    window: { echarts, setTimeout, matchMedia: () => ({ matches: false }) },
    document: { head, documentElement: new Element(), addEventListener() {}, querySelector: () => active ? configNode : null, getElementById: () => active ? root : null, createElement: () => new Element(), createElementNS: () => new Element() },
    getComputedStyle: () => ({ color: '#333', getPropertyValue: () => '#ccc' }),
    ResizeObserver: Observer, MutationObserver: Observer,
    fetch: (url, options) => typeof url === 'string' ? Promise.resolve({ ok: true, json: async () => ({ type: 'FeatureCollection', features: [
      { properties: { name: '美国', name_en: 'United States of America' }, geometry: { type: 'Polygon', coordinates: [] } },
      { properties: { name: 'Boundary' }, geometry: { type: 'MultiLineString', coordinates: [[[0, 0], [1, 1]]] } },
      ...(url.includes('china') ? [{ properties: { name: '南海诸岛', displayOnly: true }, geometry: { type: 'MultiPolygon', coordinates: [[[[108, 4], [118, 4], [118, 17], [108, 4]]]] } }] : []),
    ] }) }) : new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      requests.push({ url, signal: options.signal, resolve })
    })
  }
  vm.runInNewContext(buildSync({ entryPoints: [path.join(__dirname, '../source/js/_app/components/statistics/index.ts')], bundle: true, write: false, format: 'cjs' }).outputFiles[0].text, context)
  const refresh = context.module.exports.refreshStatistics
  const flush = () => new Promise(resolve => setImmediate(resolve))
  const respond = (request, payload) => request.resolve({ ok: true, json: async () => payload })
  refresh()
  await flush()
  assert.equal(charts.length, 4, 'Three local charts and China render before remote requests finish')
  const categoryPanel = root.children.find(node => node.dataset.chart === 'categories')
  const legend = categoryPanel.children.find(node => node.className === 'statistics-legend')
  const pie = charts.find(chart => chart.body.parentElement === categoryPanel)
  const legendButton = legend.children[0]
  legendButton.onclick({ detail: 1 })
  assert.equal(legendButton.getAttribute('aria-pressed'), 'false', 'Legend click toggles category')
  assert.equal(pie.action.type, 'legendToggleSelect')
  assert.equal(pie.option.legend.selected.Category, false, 'Selection is retained for subsequent renders')
  legend.onpointerdown({ pointerType: 'mouse', button: 0, clientX: 100 })
  legend.onpointermove({ clientX: 60, pointerId: 1, preventDefault() {} })
  legend.onpointerup()
  assert.equal(legend.scrollLeft, 40, 'Mouse drag scrolls the legend')
  legendButton.onclick({ detail: 1 })
  assert.equal(legendButton.getAttribute('aria-pressed'), 'false', 'Drag release does not toggle a category')
  legendButton.onclick({ detail: 0 })
  assert.equal(legendButton.getAttribute('aria-pressed'), 'true', 'Keyboard activation still toggles category')
  assert.equal(root.attributes['aria-busy'], 'true')
  const map = charts.find(chart => chart.option.series[0].type === 'map')
  assert.equal(map.option.series[0].map, 'statistics-china')
  assert.equal(map.option.series[1].type, 'lines', 'Boundary lines are preserved separately from filled regions')
  assert.equal(map.option.visualMap.show, false, 'Empty map must not imply zero measured visits')
  const hit = map.body.children.find(node => node.className === 'statistics-map-hit')
  assert.equal(hit.hidden, false)
  hit.onclick()
  assert.equal(map.actions.at(-2).type, 'highlight')
  assert.equal(map.action.type, 'showTip', 'Expanded island hit area also opens the statistics tooltip')
  assert.equal(map.action.name, '南海诸岛')
  assert.match(map.option.series[0].tooltip.formatter({ name: '南海诸岛', value: NaN }), /南海诸岛<\/div><div>visits: empty/)
  assert(!map.option.series[0].tooltip.formatter({ name: '<img src=x onerror=alert(1)>', value: NaN }).includes('<img'), 'Remote labels are escaped in glass tooltips')
  const posts = charts.find(chart => chart.body.parentElement.dataset.chart === 'posts')
  const datedTip = posts.option.tooltip.formatter([{ axisValue: '202601', value: 0 }])
  assert.match(datedTip, /2026-01/)
  assert.match(datedTip, /count: 0/)
  hit.onmouseleave()
  assert.equal(map.action.type, 'showTip', 'Clicked tooltip remains pinned after pointer leaves')
  hit.onclick()
  assert.equal(map.action.type, 'hideTip')
  hit.onmouseenter()
  assert.equal(map.action.type, 'showTip')
  hit.onmouseleave()
  assert.equal(map.action.type, 'hideTip', 'Unpinned tooltip hides on pointer leave')
  requests.forEach(request => respond(request, { error_code: 111 }))
  await flush()
  assert.equal(charts.length, 4, 'Expired authorization keeps all local charts')
  assert.equal(root.attributes['aria-busy'], 'false')
  assert(root.children.every(node => node.children.find(child => child.className === 'statistics-feedback').children[0].hidden))
  const panel = root.children.find(node => node.dataset.chart === 'map')
  const feedback = panel.children.find(node => node.className === 'statistics-feedback')
  feedback.children[2].onclick()
  assert.equal(feedback.children[0].hidden, false, 'Retry immediately restores the local spinner')
  await flush()
  respond(requests.at(-1), { error_code: 111 })
  await flush()
  assert.equal(feedback.children[0].hidden, true, 'Failure stops the spinner')
  const controls = panel.children.find(node => node.className === 'statistics-map-controls')
  const [china, world] = controls.children
  world.onclick()
  await flush()
  assert.equal(map.option.series[0].map, 'statistics-world', 'World map renders without API data')
  assert.equal(hit.hidden, true, 'South Sea hit area is hidden in world mode')
  const pendingWorld = requests.at(-1)
  assert.equal(pendingWorld.url.searchParams.get('method'), 'visit/world/a')
  china.onclick()
  await flush()
  respond(pendingWorld, { result: { items: [[[{ name: '美国' }]], [[99]]] } })
  await flush()
  assert.equal(map.option.series[0].map, 'statistics-china', 'Late world response cannot overwrite selected China map')
  respond(requests.at(-1), { result: { items: [[[{ name: '四川' }]], [[12]]] } })
  await flush()
  assert.equal(map.option.series[0].data[0].value, 12)
  assert.equal(map.option.visualMap.show, true)
  assert.equal(map.option.visualMap.max, 12)
  assert.equal(JSON.stringify(map.option.visualMap.inRange.color), JSON.stringify(['#92d0f9', '#49b1f5']), 'Old map ramp runs from low light blue to high blue')
  assert.equal(map.option.series[0].emphasis.label.fontWeight, 'normal')
  world.onclick()
  await flush()
  respond(requests.at(-1), { result: { items: [[[{ name: '美国' }]], [[7]]] } })
  await flush()
  assert.equal(maps.get('statistics-world').geoJson.features[0].properties.name, '美国')
  assert.equal(map.option.series[0].data[0].value, 7)
  assert.equal(charts.length, 4, 'Mode changes reuse the map instance')
  assert(map.option.series[0].layoutSize > 700, 'Map sizing follows container width')
  china.onclick()
  await flush()
  active = false
  refresh()
  assert(requests.at(-1).signal.aborted, 'Leaving the page cancels pending requests')
  assert(charts.every(chart => chart.disposed), 'Leaving the page disposes all charts')
  assert(observers.every(observer => observer.disconnected), 'Leaving the page disconnects observers')
  await flush()
  root.replaceChildren(...['categories', 'posts'].map(key => {
    const slot = new Element(); slot.dataset.statisticsChart = key; return slot
  }))
  const requestCount = requests.length
  active = true
  refresh()
  await flush()
  assert.deepEqual(root.children.map(node => node.dataset.chart), ['categories', 'posts'], 'Markdown controls block selection and order')
  assert.equal(requests.length, requestCount, 'Local-only page makes no Baidu requests')
  active = false
  refresh()
  console.log('PASS: independent base maps, expired token, country data, switch races and PJAX cleanup')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
