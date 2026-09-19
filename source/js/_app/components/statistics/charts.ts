import { loadCharts } from './assets'
import { chartOptions } from './options'
import { createLegend } from './legend'
import { calendarDetails } from './calendar'
import { calendarScroll } from './calendar-scroll'
import { postsRange } from './posts-range'
import { tagsLimit } from './tags-limit'
import type { Panel } from './panel'
import type { ChartKey, Point, RegisterChart, Settings } from './types'

export async function mountDataChart(key: ChartKey, panel: Panel, getData: () => Promise<Point[]>, config: Settings, root: HTMLElement, signal: AbortSignal, register: RegisterChart) {
  const finish = panel.begin()
  try {
    const data = await getData()
    if (signal.aborted) return
    if (!data.length) { panel.empty(); return }
    const echarts = await loadCharts(config.assets?.echarts)
    if (signal.aborted) return
    panel.ready()
    if (key === 'calendar') {
      calendarScroll(panel.body, config.labels, signal)
      panel.element.append(calendarDetails(data, config.labels))
    }
    const chart = echarts.init(panel.body)
    const legend = key === 'sources' || key === 'categories' ? createLegend(panel, [...data].sort((a, b) => b.value - a.value), chart, config.labels, signal) : undefined
    const render = () => {
      const displayed = limit ? limit(data) : data
      const option = chartOptions(key, displayed, config.labels, root, panel.body, echarts)
      if (key === 'tags' && displayed.length > 10) {
        option.grid.bottom = 65
        option.dataZoom = [{ type: 'slider', start: 0, end: 100, bottom: 5, height: 20, fillerColor: 'rgba(225,120,153,.15)', handleStyle: { color: option.series[0].lineStyle.color } }]
      }
      legend?.(option)
      range?.(option)
      chart.setOption(option, true)
    }
    const range = key === 'posts' ? postsRange(panel, data, chart, config.labels, signal, render) : undefined
    const limit = key === 'tags' ? tagsLimit(panel, config.labels, signal, render) : undefined
    register(chart, panel.body, render)
    render()
  } catch (error) {
    if (!signal.aborted) {
      panel.fail(error)
      panel.button.onclick = () => { void mountDataChart(key, panel, getData, config, root, signal, register) }
    }
  } finally {
    finish()
  }
}
