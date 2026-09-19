import { enhanceSelect } from '../select-picker'
import type { Labels, Point } from './types'
import type { Panel } from './panel'

export function rangeIndices(length: number, start: number, end: number) {
  const last = Math.max(0, length - 1)
  return [Math.round(last * Math.max(0, Math.min(100, start)) / 100), Math.round(last * Math.max(0, Math.min(100, end)) / 100)]
}

export function postsRange(panel: Panel, data: Point[], chart: any, labels: Labels, signal: AbortSignal, render: () => void) {
  let start = 0, end = 100
  const control = document.createElement('div'), select = document.createElement('select')
  control.className = 'statistics-posts-range'
  select.setAttribute('aria-label', labels.posts_range)
  for (const value of ['6', '12', '24', 'all', 'custom']) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = labels[`posts_${value}`]
    option.disabled = value === 'custom'
    select.append(option)
  }
  select.value = 'all'
  control.append(select)
  panel.header.append(control)
  const picker = enhanceSelect(select, { signal, variant: 'statistics' })
  select.onchange = () => {
    start = select.value === 'all' ? 0 : Math.max(0, data.length - Number(select.value)) / Math.max(1, data.length - 1) * 100
    end = 100
    render()
  }
  const zoom = (event: any) => {
    const change = event.batch?.[0] || event
    if (!Number.isFinite(change.start) || !Number.isFinite(change.end)) return
    start = change.start
    end = change.end
    select.value = 'custom'
    picker.sync()
    render()
  }
  chart.on('datazoom', zoom)
  signal.addEventListener('abort', () => chart.off('datazoom', zoom), { once: true })
  return (option: any) => {
    const [first, last] = rangeIndices(data.length, start, end)
    const visible = data.slice(first, last + 1)
    const average = visible.reduce((sum, item) => sum + item.value, 0) / Math.max(1, visible.length)
    option.grid.bottom = 65
    const color = option.series[0].lineStyle.color
    option.dataZoom = [{ type: 'slider', xAxisIndex: 0, start, end, bottom: 5, height: 22, realtime: false,
      borderColor: 'transparent', backgroundColor: 'rgba(128,128,128,.06)', fillerColor: 'rgba(225,120,153,.15)',
      dataBackground: { lineStyle: { color, opacity: .5 }, areaStyle: { color, opacity: .08 } },
      handleStyle: { color }, textStyle: { color: option.textStyle.color }, showDetail: true,
    }]
    option.series[0].markLine.data = [{ yAxis: Number(average.toFixed(2)), name: labels.average }]
  }
}
