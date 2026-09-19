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
  removeEventListener() {}
  get selectedOptions() { return this.children.filter(child => child.value === this.value) }
  get options() { return this.children }
  scrollLeft = 0
  scrollBy({ left }) { this.scrollLeft = Math.max(0, Math.min(this.scrollWidth - this.clientWidth, this.scrollLeft + left)) }
  setPointerCapture() {}
  get parentElement() { return this.parent }
  append(...nodes) { this.children.push(...nodes); nodes.forEach(node => { node.parent = this }) }
  before(node) { this.parent.children.splice(this.parent.children.indexOf(this), 0, node); node.parent = this.parent }
  after(node) { this.parent.children.splice(this.parent.children.indexOf(this) + 1, 0, node); node.parent = this.parent }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes) }
  setAttribute(key, value) { this.attributes[key] = value }
  getAttribute(key) { return this.attributes[key] ?? null }
  remove() {}
  querySelectorAll() { return this.children.filter(node => node.dataset.statisticsChart) }
}

async function main() {
  const rankingContext = { module: { exports: {} }, URL, Date }
  vm.runInNewContext(buildSync({ entryPoints: [path.join(__dirname, '../source/js/_app/components/statistics/content-ranking.ts')], bundle: true, write: false, format: 'cjs' }).outputFiles[0].text, rankingContext)
  const ranked = rankingContext.module.exports.contentRanking([
    { name: 'https://example.test/posts/1.html?from=home', value: 4 },
    { name: 'http://example.test/posts/1.html#anchor', value: 2 },
    { name: 'https://spam.example.test/posts/1.html', value: 9999 },
    { name: 'https://example.test/unknown/', value: 999 },
    { name: 'https://example.test/about/index.html', value: 8 },
    { name: 'https://example.test/about/', value: NaN },
  ], [
    { title: 'Article', url: 'https://example.test/posts/1.html', kind: 'article' },
    { title: 'About', url: 'https://example.test/about/', kind: 'page' },
  ])
  assert.equal(JSON.stringify(ranked.map(item => [item.title, item.kind, item.value])), '[["About","page",8],["Article","article",6]]', 'Only known content on the exact host is ranked; URL variants aggregate without mixing categories')
  assert.throws(() => rankingContext.module.exports.contentRanking([{ name: 'https://example.test/about', value: 9 }]), /content_manifest/, 'A stale generated manifest is an initialization error, never an empty ranking')
  const measureTitle = title => title.length * 12
  assert.equal(rankingContext.module.exports.rankingLabelWidth(['Short'], 800, measureTitle), 68, 'Short page titles shrink the label gutter')
  assert.equal(rankingContext.module.exports.rankingLabelWidth(['Long article title'.repeat(4)], 800, measureTitle), 300, 'Long article titles remain capped')
  assert.equal(rankingContext.module.exports.rankingLabelWidth(['Long article title'], 300, measureTitle), 115, 'Mobile leaves enough room for bars')
  const apiRequests = []
  const apiContext = { module: { exports: {} }, URL, Date, AbortController, AbortSignal, window: { setTimeout }, clearTimeout,
    fetch: async url => {
      apiRequests.push(new URL(url))
      const index = Number(url.searchParams.get('start_index'))
      return { ok: true, json: async () => ({ result: { total: 2, items: [[[{ name: `https://example.test/${index}` }]], [[index + 1]]] } }) }
    },
  }
  vm.runInNewContext(buildSync({ entryPoints: [path.join(__dirname, '../source/js/_app/components/statistics/baidu.ts')], bundle: true, write: false, format: 'cjs' }).outputFiles[0].text, apiContext)
  const api = apiContext.module.exports.createBaiduSource({ api: 'https://example.test/api', site_id: 'site' }, new AbortController().signal)
  const pages = await api.pages('20260820', '20260918', new AbortController().signal)
  assert.equal(pages.length, 2, 'Page rankings fetch every page, not only the default first 20')
  assert.deepEqual(apiRequests.map(url => url.searchParams.get('start_index')), ['0', '1'])
  apiContext.fetch = async () => ({ ok: true, json: async () => ({ result: { total: 2, items: [[[{ name: 'same' }]], [[1]]] } }) })
  await assert.rejects(() => api.pages('20260820', '20260918', new AbortController().signal), /response/, 'An ignored pagination offset must not silently duplicate rankings')
  let attempts = 0
  apiContext.fetch = async () => ++attempts === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ result: { total: 1, items: [[[{ name: 'https://example.test/about/' }]], [[9]]] } }) }
  await assert.rejects(() => api.pages('20260820', '20260918', new AbortController().signal), /temporary/, 'Backend failure is classified rather than hidden by retries')
  assert.equal(attempts, 1)
  attempts = 0
  apiContext.fetch = async () => { attempts++; return { ok: true, json: async () => ({ error_code: 111 }) } }
  await assert.rejects(() => api.pages('20260820', '20260918', new AbortController().signal), /expired/)
  assert.equal(attempts, 1, 'Expired credentials are not retried')
  const cancelled = new AbortController()
  apiContext.fetch = async () => { cancelled.abort(); return { ok: false, status: 503 } }
  await assert.rejects(() => api.pages('20260820', '20260918', cancelled.signal), /abort/i, 'Leaving or switching cancels retry work')
  const trendContext = { module: { exports: {} }, Date }
  vm.runInNewContext(buildSync({ entryPoints: [path.join(__dirname, '../source/js/_app/components/statistics/trends.ts')], bundle: true, write: false, format: 'cjs' }).outputFiles[0].text, trendContext)
  const trend = trendContext.module.exports.trendPeriods([
    { name: '2026/09/18', value: 0 }, { name: '20260917', value: NaN },
    { name: '2026-09-16', value: 5 }, { name: '20260919', value: 999 },
  ], 2, new Date(2026, 8, 19))
  assert.equal(JSON.stringify(trend.current), '[null,0]', 'Unknown days stay missing and measured zero is retained')
  assert.equal(JSON.stringify(trend.previous), '[null,5]')
  assert.equal(JSON.stringify(trend.dates), '["20260917","20260918"]', 'Periods exclude the incomplete current day')
  assert.equal(JSON.stringify(trend.previousDates), '["20260915","20260916"]', 'Comparison uses an equally long preceding period')
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
  Object.assign(labels, { map_summary_china: '{total} visits / {regions} provinces', map_summary_world: '{total} visits / {regions} countries', ranking_top: 'TOP {count}', map_no_record: 'No regional records' })
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
      chart.off = type => { delete chart.handlers[type] }
      return chart
    }
  }
  const head = new Element()
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this) }
    observe() {}
    disconnect() { this.disconnected = true }
  }
  const drawerMedia = { matches: false, addEventListener(_, listener) { this.change = listener } }
  const context = {
    exports: {}, module: { exports: {} }, URL, Date, Intl, AbortController, AbortSignal, clearTimeout, setTimeout,
    window: { echarts, setTimeout, matchMedia: query => query.includes('max-width') ? drawerMedia : { matches: false, addEventListener() {} } },
    document: { head, documentElement: new Element(), addEventListener() {}, querySelector: () => active ? configNode : null, getElementById: () => active ? root : null, createElement: () => new Element(), createElementNS: () => new Element() },
    getComputedStyle: () => ({ color: '#333', getPropertyValue: key => key.startsWith('--statistics-scale-') || key === '--statistics-bar-start' ? '' : '#ccc' }),
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
  const postsChart = charts.find(chart => chart.option?.dataZoom)
  assert.equal(postsChart.option.dataZoom[0].type, 'slider', 'Publishing chart exposes a draggable range')
  postsChart.handlers.datazoom({ start: 0, end: 100 })
  assert.equal(postsChart.option.series[0].markLine.data[0].yAxis, 1, 'Average is recomputed for visible months')
  const categoryPanel = root.children.find(node => node.dataset.chart === 'categories')
  const legendFrame = categoryPanel.children.find(node => node.className === 'statistics-legend-frame')
  const legend = legendFrame.children.find(node => node.className === 'statistics-legend')
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
  legend.clientWidth = 300
  legend.scrollWidth = 900
  const legendArrows = legendFrame.children.filter(node => node.className.startsWith('statistics-calendar-arrow'))
  legendArrows[1].onclick()
  assert.equal(legend.scrollLeft, 265, 'Legend arrow advances by three quarters of the viewport')
  assert.equal(root.attributes['aria-busy'], 'true')
  const map = charts.find(chart => chart.option.series[0].type === 'map')
  assert.equal(map.option.series[0].map, 'statistics-china')
  assert.equal(map.option.series[1].type, 'lines', 'Boundary lines are preserved separately from filled regions')
  assert.equal(map.option.visualMap.show, false, 'Empty map must not imply zero measured visits')
  assert.equal(map.option.series[0].roam, true, 'Maps support wheel zoom and pan')
  assert.equal(map.option.series[0].scaleLimit.max, 5, 'Zoom is bounded')
  const aside = map.body.parentElement.children.find(node => node.className === 'statistics-map-aside')
  const ranking = aside.children.find(node => node.className === 'statistics-map-ranking')
  const header = map.body.parentElement.parentElement.children.find(node => node.className === 'statistics-header')
  const detail = header.children.find(node => node.className === 'statistics-map-detail')
  const toolbar = header.children.find(node => node.className === 'statistics-map-toolbar')
  const toggle = map.body.parentElement.children.find(node => node.className === 'statistics-map-toggle')
  drawerMedia.matches = true
  drawerMedia.change()
  assert.equal(aside.hidden, true, 'Narrow maps default to a collapsed ranking')
  toggle.onclick()
  assert.equal(aside.hidden, false)
  assert.equal(toggle.getAttribute('aria-expanded'), 'true')
  toggle.onclick()
  assert.equal(aside.hidden, true)
  drawerMedia.matches = false
  drawerMedia.change()
  assert.equal(aside.hidden, false, 'Desktop ranking remains visible after resizing')
  assert.equal(toggle.hidden, true)
  const zoomControls = toolbar.children.find(node => node.className === 'statistics-map-zoom')
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
  assert.match(map.option.series[0].tooltip.formatter({ name: '南海诸岛', value: NaN }), /南海诸岛<\/div><div>No regional records/)
  assert.match(map.option.series[0].tooltip.formatter({ name: 'Test', value: 0 }), /visits: 0/, 'Measured zero is distinct from missing records')
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
  const controls = toolbar.children.find(node => node.className === 'statistics-map-controls')
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
  assert.equal(JSON.stringify(map.option.visualMap.inRange.color), JSON.stringify(['#fce9ee', '#f1acc0', '#df5d82']), 'Map uses a sequential cherry-pink to rose ramp')
  assert.equal(map.option.series[0].emphasis.label.fontWeight, 'normal')
  world.onclick()
  await flush()
  respond(requests.at(-1), { result: { items: [Array.from({ length: 13 }, (_, index) => [{ name: index ? `测试长国家名称${index}` : '美国' }]), Array.from({ length: 13 }, (_, index) => [index ? 1 : 7])] } })
  await flush()
  assert.equal(maps.get('statistics-world').geoJson.features[0].properties.name, '美国')
  assert.equal(map.option.series[0].data[0].value, 7)
  const mapSummary = detail.children.find(node => node.className === 'statistics-map-summary')
  assert.equal(mapSummary.children.map(node => node.textContent).join(''), '19 visits / 1 countries', 'Summary includes all records, but only counts named map regions')
  assert.equal(aside.children.find(node => node.className === 'statistics-map-ranking-title').textContent, 'TOP 10')
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
  const scrollContext = { ...context, module: { exports: {} } }
  vm.runInNewContext(buildSync({ entryPoints: [path.join(__dirname, '../source/js/_app/components/statistics/calendar-scroll.ts')], bundle: true, write: false, format: 'cjs' }).outputFiles[0].text, scrollContext)
  const scrollPanel = new Element(), scrollBody = new Element(), scrollLifecycle = new AbortController()
  scrollPanel.append(scrollBody)
  scrollContext.module.exports.calendarScroll(scrollBody, { calendar: 'Calendar', scroll_left: 'Left', scroll_right: 'Right' }, scrollLifecycle.signal)
  const frame = scrollPanel.children[0], scroller = frame.children[0]
  scroller.clientWidth = 300; scroller.scrollWidth = 640
  const resizeScroll = observers[observers.length - 1]
  resizeScroll.callback()
  assert.equal(frame.children[1].hidden, true)
  assert.equal(frame.children[2].hidden, false)
  frame.children[2].onclick()
  assert.equal(scroller.scrollLeft, 225, 'Arrow scrolls by three quarters of the viewport')
  scroller.onpointerdown({ pointerType: 'mouse', button: 0, clientX: 100 })
  scroller.onpointermove({ clientX: 50, pointerId: 1, preventDefault() {} })
  scroller.onpointerup()
  assert.equal(scroller.scrollLeft, 275, 'Calendar supports mouse drag')
  scroller.clientWidth = 800
  resizeScroll.callback()
  assert.equal(frame.children[1].hidden, true)
  assert.equal(frame.children[2].hidden, true, 'Arrows disappear when the calendar fits')
  scrollLifecycle.abort()
  assert.equal(resizeScroll.disconnected, true)
  console.log('PASS: independent base maps, expired token, country data, switch races and PJAX cleanup')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
