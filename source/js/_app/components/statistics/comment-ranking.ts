import { tagsLimit } from './tags-limit'
import { loadCharts } from './assets'
import { rankingLabelWidth } from './content-ranking'
import { chartPalette, statisticsColors } from './palette'
import { commentContent, createCommentList } from './comment-list'
import type { CommentSource, CommentStatistics } from './comments'
import type { Panel } from './panel'
import type { RegisterChart, Settings } from './types'

export async function mountCommentRanking(panel: Panel, source: CommentSource, config: Settings, signal: AbortSignal, register: RegisterChart) {
  const labels = config.labels
  const open = createCommentList(config, signal)
  let data: CommentStatistics | undefined
  let chart: any
  let mode = 'author', kind = 'all'
  const toolbar = document.createElement('div')
  toolbar.className = 'statistics-content-toolbar'
  panel.header.append(toolbar)
  const controls = (items: [string, string][], value: () => string, change: (value: string) => void) => {
    const group = document.createElement('div')
    group.className = 'statistics-content-controls'
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', items.map(item => item[1]).join(' / '))
    const buttons = items.map(([key, text]) => {
      const button = document.createElement('button')
      button.type = 'button'; button.textContent = text
      button.onclick = () => { change(key); render() }
      group.append(button)
      return button
    })
    toolbar.append(group)
    return { group, sync: () => buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(value() === items[index][0]))) }
  }
  const modes = controls([['author', labels.comment_by_author], ['content', labels.comment_by_content]], () => mode, value => { mode = value })
  const kinds = controls([['all', labels.tags_all], ['article', labels.content_articles], ['page', labels.content_pages]], () => kind, value => { kind = value })
  const all = document.createElement('button')
  all.type = 'button'; all.textContent = labels.comment_list
  all.onclick = () => open(labels.comment_list)
  const note = document.createElement('p')
  note.className = 'statistics-trend-range statistics-comment-note'
  note.append(labels.comment_scope, ' · ', all, ' · ', labels.comment_privacy)
  panel.element.append(note)
  const plot = document.createElement('div'), links = document.createElement('div')
  plot.className = 'statistics-content-plot'
  links.className = 'statistics-content-links'
  panel.body.before(plot)
  plot.append(panel.body, links)
  const render = () => {
    modes.sync(); kinds.sync(); kinds.group.hidden = mode !== 'content'
    if (!data || !chart) return
    links.replaceChildren()
    const items = mode === 'author'
      ? data.ranking.map(item => ({ ...item, filter: { author: item.key } }))
      : data.content.flatMap(item => {
        const known = commentContent(config, item.name)
        return known && (kind === 'all' || kind === known.kind) ? [{ ...item, name: known.title, filter: { url: item.name } }] : []
      }).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    const visible = limit(items) as typeof items
    if (!visible.length) { panel.body.hidden = true; panel.empty(); return }
    panel.ready()
    panel.body.style.height = `${Math.max(230, visible.length * 42 + 50)}px`
    chart.resize()
    const palette = chartPalette(document.documentElement.getAttribute('data-theme') === 'dark')
    const colors = statisticsColors(panel.element)
    const fontFamily = getComputedStyle(panel.element).fontFamily
    const measure = document.createElement('canvas').getContext('2d')
    const style = getComputedStyle(links)
    if (measure) measure.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const names = visible.map(item => item.name || labels.comment_anonymous)
    const width = rankingLabelWidth(names, panel.body.clientWidth, name => measure?.measureText(name).width ?? name.length * 12)
    links.style.width = `${width}px`
    links.style.gridTemplateRows = `repeat(${visible.length}, minmax(0, 1fr))`
    visible.forEach((item, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      const name = document.createElement('span')
      name.textContent = names[index]
      button.title = `${names[index]} · ${labels.comment_total.replace('{count}', String(item.value))}`
      button.setAttribute('aria-label', button.title)
      button.append(name)
      button.onclick = () => open(name.textContent!, item.filter)
      links.append(button)
    })
    chart.setOption({
      animationDuration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 250,
      textStyle: { fontFamily },
      grid: { top: 10, bottom: 35, left: width + 12, right: 50 },
      xAxis: { type: 'value', minInterval: 1, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { color: palette.text }, splitLine: { lineStyle: { color: palette.grid, type: 'dashed' } } },
      yAxis: { type: 'category', inverse: true, data: names, axisTick: { show: false }, axisLine: { show: false }, axisLabel: { show: false } },
      series: [{ type: 'bar', data: visible.map(item => item.value), barWidth: 18,
        itemStyle: { barBorderRadius: [0, 9, 9, 0], color: { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: colors.bar.map((color, index) => ({ offset: index / (colors.bar.length - 1), color })) } },
        label: { show: true, position: 'right', color: palette.text },
      }],
    }, true)
    chart.off('click')
    chart.on('click', (event: { dataIndex: number }) => {
      const item = visible[event.dataIndex]
      if (item) open(names[event.dataIndex], item.filter)
    })
  }
  const limit = tagsLimit(panel, labels, signal, render)
  const update = async () => {
    const done = panel.begin()
    try {
      data = await source.load()
      const echarts = await loadCharts(config.assets?.echarts)
      if (signal.aborted) return
      panel.ready()
      if (!chart) { chart = echarts.init(panel.body); register(chart, panel.body, render) }
      render()
    } catch (error) { if (!signal.aborted) panel.fail(error) }
    finally { done() }
  }
  panel.button.onclick = () => { void update() }
  void document.fonts.ready.then(() => { if (!signal.aborted) render() })
  render()
  void update()
}
