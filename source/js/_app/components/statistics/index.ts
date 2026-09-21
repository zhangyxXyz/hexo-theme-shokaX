import { createBaiduSource } from './baidu'
import { siteData } from './site'
import { createPanel } from './panel'
import { mountDataChart } from './charts'
import { mountMap } from './map'
import { mountTrends } from './trends'
import { mountContentRanking } from './content-ranking'
import { createCommentSource, commentSettings } from './comments'
import { mountCommentRanking } from './comment-ranking'
import { chartKeys, siteCharts } from './types'
import type { BaiduChart, ChartKey, RegisterChart, Settings, SiteChart } from './types'

let cleanup: (() => void) | undefined

export function refreshStatistics() {
  cleanup?.()
  cleanup = undefined
  const configNode = document.querySelector<HTMLElement>('[data-statistics-config]')
  const root = document.getElementById('statistics_container')
  if (!configNode || !root) return
  const config: Settings = JSON.parse(configNode.dataset.statisticsConfig!)
  const controller = new AbortController()
  const charts: any[] = []
  const renderers: (() => void)[] = []
  const observers: ResizeObserver[] = []
  const register: RegisterChart = (chart, body, render) => {
    charts.push(chart)
    renderers.push(render)
    const observer = new ResizeObserver(() => { if (!controller.signal.aborted) { chart.resize(); render() } })
    observer.observe(body)
    observers.push(observer)
  }
  const themeObserver = new MutationObserver(() => renderers.forEach(render => render()))
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
  cleanup = () => {
    controller.abort()
    themeObserver.disconnect()
    observers.forEach(observer => observer.disconnect())
    charts.forEach(chart => chart.dispose())
  }
  let pending = 0
  root.setAttribute('aria-busy', 'false')
  const source = createBaiduSource(config.baidu, controller.signal)
  const comments = createCommentSource(config, controller.signal)
  const commentConfig = commentSettings(config)
  for (const element of root.querySelectorAll<HTMLElement>('[data-statistics-chart]')) {
    const key = element.dataset.statisticsChart as ChartKey
    if (!chartKeys.includes(key)) continue
    const panel = createPanel(element, key, config.labels, delta => {
      pending += delta
      root.setAttribute('aria-busy', String(pending > 0))
    })
    if (key === 'comment-map') {
      panel.element.dataset.chart = 'map'
      void mountMap(panel, comments, commentConfig, root, controller.signal, register)
    } else if (key === 'comment-trend') {
      panel.element.dataset.chart = 'posts'
      void mountDataChart('posts', panel, comments.trend, commentConfig, root, controller.signal, register)
    } else if (key === 'comment-ranking') {
      void mountCommentRanking(panel, comments, commentConfig, controller.signal, register)
    } else if (key === 'map') void mountMap(panel, source, config, root, controller.signal, register)
    else if (key === 'trends') void mountTrends(panel, source, config, controller.signal, register)
    else if (key === 'content') void mountContentRanking(panel, source, config, controller.signal, register)
    else {
      const getData = siteCharts.includes(key as SiteChart) ? () => siteData(config, key as SiteChart) : source[key as BaiduChart]
      void mountDataChart(key, panel, getData, config, root, controller.signal, register)
    }
  }
}
