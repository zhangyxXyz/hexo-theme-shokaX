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
  style = { setProperty(key, value) { this[key] = value } }
  addEventListener() {}
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
  const calendarContext = { module: { exports: {} }, Date }
  vm.runInNewContext(buildSync({ entryPoints: [path.join(__dirname, '../source/js/_app/components/statistics/calendar.ts')], bundle: true, write: false, format: 'cjs' }).outputFiles[0].text, calendarContext)
  const { calendarTotals } = calendarContext.module.exports
  const summary = calendarTotals([
    { name: '2025/09/14', value: 100 }, { name: '2026-08-19', value: 50 },
    { name: '20260820', value: 20 }, { name: '2026/09/11', value: 10 },
    { name: '2026/09/12', value: 3 }, { name: '2026/09/18', value: 2 },
    { name: '2026/09/19', value: 999 },
  ], new Date(2026, 8, 18))
  assert.equal(JSON.stringify(summary.map(item => item.total)), '[185,35,5]', 'Rolling totals include both boundaries and exclude future data')
  assert.equal(summary[0].from, '20250914', 'Year grid starts on Sunday, matching the deployed calendar')
  assert.equal(summary[1].from, '20260820')
  assert.equal(summary[2].from, '20260912')
  assert.equal(calendarTotals([], new Date(2026, 8, 18))[0].total, null, 'Missing data is not a measured zero')
  assert.equal(calendarTotals([{ name: '20240229', value: 4 }], new Date(2024, 2, 1))[2].total, 4, 'Leap day belongs to the trailing week')
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
      const chart = { body, actions: [], handlers: {}, on(type, handler) { this.handlers[type] = handler }, getZr() { return { on() {} } }, getOption() { return this.option }, setOption(option, replace) { this.option = replace ? option : { ...this.option, ...option } }, resize() {}, dispatchAction(action) { this.action = action; this.actions.push(action) }, convertToPixel(_, point) { return [point[0], -point[1]] }, dispose() { this.disposed = true } }
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
    exports: {}, module: { exports: {} }, URL, Date, Intl, AbortController, AbortSignal, clearTimeout, setTimeout,
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
  assert.equal(map.option.series[0].roam, true, 'Maps support wheel zoom and pan')
  assert.equal(map.option.series[0].scaleLimit.max, 5, 'Zoom is bounded')
  const aside = map.body.parentElement.children.find(node => node.className === 'statistics-map-aside')
  const ranking = aside.children.find(node => node.className === 'statistics-map-ranking')
  const zoomControls = aside.children.find(node => node.className === 'statistics-map-zoom')
  zoomControls.children[0].onclick()
  assert.equal(map.action.type, 'geoRoam')
  assert.equal(map.action.zoom, 1.25)
  zoomControls.children[2].onclick()
  assert.equal(zoomControls.children[1].disabled, true, 'Reset returns to minimum zoom')
  assert.equal(ranking.hidden, true, 'Pending ranking does not prematurely show an empty state')
  assert.equal(ranking.children.length, 0)
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
  assert.equal(map.option.visualMap.show, false, 'HTML scale replaces the triangular ECharts handles')
  assert.equal(map.option.visualMap.max, 12)
  assert.equal(ranking.hidden, false, 'Ranking appears once the request succeeds')
  assert.equal(ranking.children[0].children[0].children[1].textContent, '四川')
  assert.equal(ranking.children[0].children[0].children[2].children[0].textContent, '12')
  ranking.children[0].children[0].onmouseenter()
  assert.equal(map.action.name, '四川', 'Ranking hover opens the matching region tooltip')
  assert.equal(JSON.stringify(map.option.visualMap.inRange.color), JSON.stringify(['#92d0f9', '#49b1f5']), 'Old map ramp runs from low light blue to high blue')
  assert.equal(map.option.series[0].emphasis.label.fontWeight, 'normal')
  world.onclick()
  await flush()
  respond(requests.at(-1), { result: { items: [Array.from({ length: 13 }, (_, index) => [{ name: index ? `测试长国家名称${index}` : '美国' }]), Array.from({ length: 13 }, (_, index) => [index ? 1 : 7])] } })
  await flush()
  assert.equal(maps.get('statistics-world').geoJson.features[0].properties.name, '美国')
  assert.equal(map.option.series[0].data[0].value, 7)
  assert.equal(ranking.children.length, 10, 'Only the top ten regions are rendered')
  assert.equal(ranking.children[1].children[0].children[1].textContent, '测试长国…', 'Long names are limited to four characters plus an ellipsis')
  assert.equal(ranking.children[1].children[0].children[1].title, '测试长国家名称1', 'Full names remain available')
  assert.equal(charts.length, 4, 'Mode changes reuse the map instance')
  assert(map.option.series[0].layoutSize > 500, 'Map sizing reserves space for the overlay ranking')
  map.handlers.mouseover({ seriesIndex: 0, name: '美国' })
  map.handlers.georoam()
  await new Promise(resolve => setTimeout(resolve, 190))
  assert.equal(map.actions.at(-2).type, 'highlight', 'Zoom completion restores the hovered label')
  assert.equal(map.action.name, '美国')
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
