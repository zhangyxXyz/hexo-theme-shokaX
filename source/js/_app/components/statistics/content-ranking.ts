import { loadCharts } from './assets'
import { calendarRange, dateKey } from './dates'
import { chartPalette, statisticsColors } from './palette'
import { enhanceSelect } from '../select-picker'
import { chartTooltip } from './tooltip'
import type { BaiduSource } from './baidu'
import type { Panel } from './panel'
import type { ContentItem, Point, RegisterChart, Settings } from './types'

function canonical(value: string) {
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    return url.host + decodeURI(url.pathname).replace(/\/index\.html$/, '/').replace(/\/$/, '')
  } catch { return '' }
}

export function contentRanking(data: Point[], content?: ContentItem[]) {
  if (!Array.isArray(content)) throw new Error('content_manifest')
  const known = new Map(content.map(item => [canonical(item.url), item]))
  const totals = new Map<string, ContentItem & { value: number }>()
  for (const point of data) {
    const key = canonical(point.name)
    const item = key && known.get(key)
    if (!item || !Number.isFinite(point.value) || point.value < 0) continue
    const previous = totals.get(key)
    totals.set(key, { ...item, value: (previous?.value ?? 0) + point.value })
  }
  return [...totals.values()].sort((a, b) => b.value - a.value || a.title.localeCompare(b.title))
}

export function rankingLabelWidth(titles: string[], available: number, measure: (title: string) => number) {
  return Math.min(available < 500 ? 115 : 300, available * .4, Math.ceil(Math.max(48, ...titles.map(measure))) + 8)
}

export async function mountContentRanking(panel: Panel, source: BaiduSource, config: Settings, signal: AbortSignal, register: RegisterChart) {
  const labels = config.labels
  let metric = 'views'
  let kind: ContentItem['kind'] = 'article'
  let limit = 10
  let sequence = 0
  let request: AbortController | undefined
  let endPending: (() => void) | undefined
  let chart: any
  const cache = new Map<string, ReturnType<typeof contentRanking>>()
  const controls = (items: [string, string][], change: (value: string) => void, parent: HTMLElement) => {
    const group = document.createElement('div')
    group.className = 'statistics-content-controls'
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', items.map(([, label]) => label).join(' / '))
    const buttons = items.map(([value, label]) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.textContent = label
      button.onclick = () => change(value)
      group.append(button)
      return button
    })
    parent.append(group)
    return (value: string) => buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(items[index][0] === value)))
  }
  const toolbar = document.createElement('div')
  toolbar.className = 'statistics-content-toolbar'
  panel.header.append(toolbar)
  const kindState = controls([['article', labels.content_articles], ['page', labels.content_pages]], value => { kind = value as ContentItem['kind']; render() }, toolbar)
  const actions = document.createElement('div')
  actions.className = 'statistics-content-actions'
  toolbar.append(actions)
  const metricState = controls([['views', labels.content_views], ['growth', labels.content_growth]], value => { metric = value; void update() }, actions)
  const select = document.createElement('select')
  select.setAttribute('aria-label', labels.content_limit)
  for (const count of [10, 20]) {
    const option = document.createElement('option')
    option.value = String(count)
    option.textContent = `TOP ${count}`
    select.append(option)
  }
  select.onchange = () => { limit = Number(select.value); render() }
  const picker = document.createElement('div')
  picker.className = 'statistics-content-picker'
  picker.append(select)
  actions.append(picker)
  enhanceSelect(select, { variant: 'statistics', signal })
  const plot = document.createElement('div'), links = document.createElement('div')
  plot.className = 'statistics-content-plot'
  links.className = 'statistics-content-links'
  panel.body.before(plot)
  plot.append(panel.body, links)
  const range = document.createElement('p')
  range.className = 'statistics-trend-range'
  panel.element.append(range)
  const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!))
  const date = (key: string) => key.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
  function render() {
    kindState(kind)
    metricState(metric)
    const data = cache.get(metric)
    if (!chart || !data) return
    const rows = data.filter(item => item.kind === kind).slice(0, limit)
    links.replaceChildren()
    if (!rows.length) { panel.body.hidden = true; panel.empty(); return }
    panel.ready()
    panel.body.style.height = `${Math.max(230, rows.length * 42 + 50)}px`
    chart.resize()
    const palette = chartPalette(document.documentElement.getAttribute('data-theme') === 'dark')
    const colors = statisticsColors(panel.element)
    const fontFamily = getComputedStyle(panel.element).fontFamily
    const measure = document.createElement('canvas').getContext('2d')
    const labelStyles = getComputedStyle(links)
    if (measure) measure.font = `${labelStyles.fontWeight} ${labelStyles.fontSize} ${labelStyles.fontFamily}`
    const width = rankingLabelWidth(rows.map(row => row.title), panel.body.clientWidth, title => measure?.measureText(title).width ?? title.length * 12)
    links.style.width = `${width}px`
    links.style.gridTemplateRows = `repeat(${rows.length}, minmax(0, 1fr))`
    for (const row of rows) {
      const link = document.createElement('a'), text = document.createElement('span')
      link.href = new URL(row.url).pathname
      link.title = row.title
      text.textContent = row.title
      link.append(text)
      links.append(link)
    }
    const number = (value: number) => `${metric === 'growth' ? '+' : ''}${value.toLocaleString()}`
    chart.setOption({
      animationDuration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250,
      textStyle: { fontFamily },
      grid: { top: 10, bottom: 35, left: width + 12, right: 65 },
      tooltip: { ...chartTooltip(panel.element), trigger: 'item', formatter: (item: any) => `<div style="font-weight:400;margin-bottom:5px">${escape(rows[item.dataIndex].title)}</div><div><span style="opacity:.75">${escape(labels.visits)}</span> <span style="color:var(--statistics-ui-accent);margin-left:8px;font-variant-numeric:tabular-nums">${number(rows[item.dataIndex].value)}</span></div>` },
      xAxis: { type: 'value', minInterval: 1, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: palette.text }, splitLine: { lineStyle: { color: palette.grid, type: 'dashed' } } },
      yAxis: { type: 'category', inverse: true, data: rows.map(item => item.title), axisTick: { show: false }, axisLine: { show: false }, axisLabel: { show: false } },
      series: [{ type: 'bar', data: rows.map(item => item.value), barWidth: 18,
        itemStyle: { barBorderRadius: [0, 9, 9, 0], color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: colors.bar.map((color, index) => ({ offset: index / (colors.bar.length - 1), color })) } },
        emphasis: { itemStyle: { color: 'rgba(236,140,105,.65)' } },
        label: { show: true, position: 'right', color: palette.text, formatter: (item: any) => number(item.value) },
      }],
    }, true)
  }
  async function update() {
    const current = ++sequence
    const selected = metric
    request?.abort()
    endPending?.()
    request = new AbortController()
    const done = endPending = panel.begin()
    panel.body.hidden = true
    links.replaceChildren()
    metricState(metric)
    kindState(kind)
    range.textContent = ''
    try {
      const { today, yearAgo } = calendarRange()
      const end = new Date(today)
      end.setDate(end.getDate() - 1)
      const start = new Date(today)
      start.setDate(start.getDate() - 30)
      const from = selected === 'growth' ? dateKey(start) : config.baidu?.start_date || dateKey(yearAgo)
      if (!Array.isArray(config.data.content)) throw new Error('content_manifest')
      if (!cache.has(selected)) cache.set(selected, contentRanking(await source.pages(from, dateKey(end), request.signal), config.data.content))
      const echarts = await loadCharts(config.assets?.echarts)
      if (signal.aborted || current !== sequence) return
      panel.ready()
      if (!chart) { chart = echarts.init(panel.body); register(chart, panel.body, render) }
      const attribution = document.createElement('a')
      attribution.href = 'https://tongji.baidu.com/'
      attribution.textContent = labels.baidu
      range.replaceChildren(`${date(from)} \u2013 ${date(dateKey(end))} \u00b7 `, attribution, ` \u00b7 ${labels.content_period}`)
      render()
    } catch (error) { if (!signal.aborted && current === sequence) panel.fail(error) }
    finally { done() }
  }
  signal.addEventListener('abort', () => request?.abort(), { once: true })
  void document.fonts.ready.then(() => { if (!signal.aborted) render() })
  panel.button.onclick = () => { void update() }
  await update()
}
