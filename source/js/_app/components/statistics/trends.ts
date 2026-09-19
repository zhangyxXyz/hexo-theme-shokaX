import { loadCharts } from './assets'
import { dateKey, calendarRange } from './dates'
import { chartPalette } from './palette'
import type { BaiduSource } from './baidu'
import type { Panel } from './panel'
import type { Point, RegisterChart, Settings } from './types'

export function trendPeriods(data: Point[], days: number, today = calendarRange().today) {
  const values = new Map(data.map(item => [item.name.replace(/[-/]/g, ''), item.value]))
  const dates = Array.from({ length: days * 2 }, (_, index) => {
    const day = new Date(today)
    day.setDate(day.getDate() - days * 2 + index)
    return dateKey(day)
  })
  const points = dates.map(date => {
    const value = values.get(date)
    return value !== undefined && Number.isFinite(value) && value >= 0 ? value : null
  })
  return { current: points.slice(days), previous: points.slice(0, days), dates: dates.slice(days), previousDates: dates.slice(0, days) }
}

export async function mountTrends(panel: Panel, source: BaiduSource, config: Settings, signal: AbortSignal, register: RegisterChart) {
  const labels = config.labels
  const controls = document.createElement('div')
  controls.className = 'statistics-trend-controls'
  controls.setAttribute('role', 'group')
  controls.setAttribute('aria-label', labels.trend_range)
  panel.header.append(controls)
  const summary = document.createElement('div')
  summary.className = 'statistics-trend-summary'
  summary.hidden = true
  panel.body.before(summary)
  const metrics = ['trend_total', 'trend_average', 'trend_change'].map(key => {
    const cell = document.createElement('div')
    const name = document.createElement('span')
    name.textContent = labels[key]
    const value = document.createElement('strong')
    cell.append(name, value)
    summary.append(cell)
    return value
  })
  const range = document.createElement('p')
  range.className = 'statistics-trend-range'
  panel.element.append(range)
  let chart: any
  let period = 30
  let sequence = 0
  let request: AbortController | undefined
  let endPending: (() => void) | undefined
  let result: ReturnType<typeof trendPeriods> | undefined
  const date = (key: string) => key.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
  const render = () => {
    if (!chart || !result) return
    const palette = chartPalette(document.documentElement.getAttribute('data-theme') === 'dark')
    chart.setOption({
      color: ['#49b1f5', palette.axis],
      tooltip: { trigger: 'axis', confine: true, backgroundColor: palette.surface, textStyle: { color: palette.text }, formatter: (items: any[]) => items.map(item => {
        const key = item.seriesIndex === 0 ? result!.dates[item.dataIndex] : result!.previousDates[item.dataIndex]
        return `${date(key)}: ${typeof item.value === 'number' ? item.value.toLocaleString() : '\u2014'}`
      }).join('<br>') },
      legend: { data: [labels.trend_current, labels.trend_previous], textStyle: { color: palette.text }, bottom: 0 },
      grid: { top: 20, left: 12, right: 16, bottom: 60, containLabel: true },
      xAxis: { type: 'category', boundaryGap: false, data: result.dates.map(date), axisLabel: { color: palette.text, formatter: (value: string) => value.slice(5), hideOverlap: true }, axisLine: { lineStyle: { color: palette.axis } } },
      yAxis: { type: 'value', min: 0, minInterval: 1, axisLabel: { color: palette.text }, splitLine: { lineStyle: { color: palette.grid, type: 'dashed' } } },
      series: [
        { name: labels.trend_current, type: 'line', data: result.current, smooth: false, connectNulls: false, showSymbol: false, lineStyle: { width: 2 }, areaStyle: { opacity: .12 } },
        { name: labels.trend_previous, type: 'line', data: result.previous, smooth: false, connectNulls: false, showSymbol: false, lineStyle: { width: 1.5, type: 'dashed' } },
      ],
    }, true)
  }
  const buttons = [7, 30, 90, 365].map(days => {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = labels[`trend_days_${days}`]
    button.onclick = () => { void update(days) }
    controls.append(button)
    return button
  })
  async function update(days = period) {
    period = days
    const current = ++sequence
    request?.abort()
    endPending?.()
    request = new AbortController()
    const done = endPending = panel.begin()
    summary.hidden = panel.body.hidden = true
    range.textContent = ''
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String([7, 30, 90, 365][index] === days)))
    try {
      const today = calendarRange().today
      const start = new Date(today)
      start.setDate(start.getDate() - days * 2)
      const end = new Date(today)
      end.setDate(end.getDate() - 1)
      const data = await source.daily(dateKey(start), dateKey(end), request.signal)
      const echarts = await loadCharts(config.assets?.echarts)
      if (signal.aborted || current !== sequence) return
      result = trendPeriods(data, days, today)
      if (!result.current.some(value => value !== null)) { panel.empty(); return }
      panel.ready()
      if (!chart) { chart = echarts.init(panel.body); register(chart, panel.body, render) }
      chart.resize()
      const sum = (points: (number | null)[]) => points.reduce<number>((total, value) => total + (value ?? 0), 0)
      const complete = result.current.every(value => value !== null)
      const previousComplete = result.previous.every(value => value !== null)
      const total = sum(result.current)
      const previous = sum(result.previous)
      metrics[0].textContent = complete ? total.toLocaleString() : '\u2014'
      metrics[1].textContent = complete ? (total / days).toLocaleString(undefined, { maximumFractionDigits: 1 }) : '\u2014'
      metrics[2].textContent = complete && previousComplete && previous > 0 ? `${total >= previous ? '+' : ''}${((total - previous) / previous * 100).toFixed(1)}%` : '\u2014'
      range.textContent = `${date(result.dates[0])} \u2013 ${date(result.dates[days - 1])} \u00b7 ${labels.trend_daily}${!complete || !previousComplete ? ` \u00b7 ${labels.trend_incomplete}` : ''}`
      summary.hidden = false
      render()
    } catch (error) {
      if (!signal.aborted && current === sequence) panel.fail(error)
    } finally { done() }
  }
  signal.addEventListener('abort', () => request?.abort(), { once: true })
  panel.button.onclick = () => { void update() }
  await update()
}
