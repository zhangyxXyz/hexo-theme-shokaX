import { loadCharts } from './assets'
import { chartOptions } from './options'
import { createLegend } from './legend'
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
    const chart = echarts.init(panel.body)
    const legend = key === 'sources' || key === 'categories' ? createLegend(panel, [...data].sort((a, b) => b.value - a.value), chart) : undefined
    const render = () => {
      const option = chartOptions(key, data, config.labels, root, panel.body, echarts)
      legend?.(option)
      chart.setOption(option, true)
    }
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
