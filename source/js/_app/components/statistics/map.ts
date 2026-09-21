import { loadCharts, loadMap, mapAspects } from './assets'
import { chartOptions } from './options'
import { mapInteractions } from './map-interactions'
import { createMapRanking } from './map-ranking'
import { createMapScale } from './map-scale'
import { mapDrawer } from './map-drawer'
import type { BaiduSource } from './baidu'
import type { Panel } from './panel'
import type { MapMode, Point, RegisterChart, Settings } from './types'

export async function mountMap(panel: Panel, source: Pick<BaiduSource, 'regions'>, config: Settings, root: HTMLElement, signal: AbortSignal, register: RegisterChart) {
  const finish = panel.begin()
  try {
    const echarts = await loadCharts(config.assets?.echarts)
    await loadMap(config.assets?.maps?.china, echarts)
    if (signal.aborted) return
    panel.ready()
    panel.body.style.aspectRatio = String(mapAspects.get('china') || 1)
    const chart = echarts.init(panel.body)
    let mode: MapMode = 'china'
    let data: Point[] = []
    let view: { zoom?: number; center?: number[] } = {}
    let hovered: string | undefined
    let hoverTimer: ReturnType<typeof setTimeout> | undefined
    let leaveTimer: ReturnType<typeof setTimeout> | undefined
    const clearHover = () => {
      if (hovered) chart.dispatchAction({ type: 'downplay', seriesIndex: 0, name: hovered })
      hovered = undefined
      clearTimeout(hoverTimer)
      hoverTimer = undefined
    }
    chart.on('mouseover', (event: any) => {
      if (event.seriesIndex !== 0) return
      if (hovered !== event.name) clearHover()
      hovered = event.name
    })
    chart.getZr().on('globalout', clearHover)
    chart.on('mouseout', (event: any) => {
      clearTimeout(leaveTimer)
      leaveTimer = setTimeout(() => {
        if (!hoverTimer && hovered === event.name) clearHover()
      }, 0)
    })
    signal.addEventListener('abort', () => { clearTimeout(hoverTimer); clearTimeout(leaveTimer) }, { once: true })
    const ranking = createMapRanking(config.labels, chart, signal)
    const scale = createMapScale(config.labels)
    const layout = document.createElement('div')
    layout.className = 'statistics-map-layout'
    panel.body.before(layout)
    layout.append(panel.body, ranking.element, scale.element)
    const aside = document.createElement('div')
    aside.className = 'statistics-map-aside'
    layout.append(aside)
    mapDrawer(layout, aside, config.labels, signal)
    const rankingTitle = document.createElement('div')
    rankingTitle.className = 'statistics-map-ranking-title'
    rankingTitle.hidden = true
    aside.append(rankingTitle)
    const summary = document.createElement('p')
    summary.className = 'statistics-map-summary'
    summary.hidden = true
    const detail = document.createElement('div')
    detail.className = 'statistics-map-detail'
    detail.append(summary)
    panel.header.append(detail)
    const zoomControls = document.createElement('div')
    zoomControls.className = 'statistics-map-zoom'
    zoomControls.setAttribute('role', 'group')
    zoomControls.setAttribute('aria-label', config.labels.map_zoom)
    aside.append(ranking.element)
    const zoomButtons = ['zoom_in', 'zoom_out', 'zoom_reset'].map((key, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.title = config.labels[key]
      button.setAttribute('aria-label', config.labels[key])
      const icon = document.createElement('i')
      icon.className = `ic i-${['plus-circle-outline', 'minus-circle-outline', 'reset'][index]}`
      icon.setAttribute('aria-hidden', 'true')
      button.append(icon)
      button.onclick = () => {
        if (index === 2) {
          clearHover()
          hit.reset()
          view = {}
          render()
        } else {
          const center = chart.getOption().series[0].layoutCenter
          chart.dispatchAction({ type: 'geoRoam', seriesIndex: 0, zoom: index === 0 ? 1.25 : .8, originX: Number(center[0]), originY: panel.body.clientHeight / 2 })
        }
      }
      zoomControls.append(button)
      return button
    })
    const updateZoomButtons = () => {
      zoomButtons[0].disabled = (view.zoom || 1) >= 5
      zoomButtons[1].disabled = (view.zoom || 1) <= 1
    }
    ranking.update(data, true)
    scale.update(data)
    const hit = mapInteractions(chart, panel, config.labels, () => mode, signal)
    const render = () => {
      panel.body.style.aspectRatio = String((mapAspects.get(mode) || 1) * (panel.body.clientWidth > 600 ? 1.35 : 1))
      const option = chartOptions('map', data, config.labels, root, panel.body, echarts, mode)
      Object.assign(option.series[0], view)
      Object.assign(option.geo, view)
      chart.setOption(option, true)
      hit.update()
      updateZoomButtons()
    }
    chart.on('georoam', () => {
      const series = chart.getOption().series[0]
      view = { zoom: series.zoom, center: series.center }
      chart.setOption({ geo: view })
      hit.update()
      updateZoomButtons()
      clearTimeout(hoverTimer)
      hoverTimer = setTimeout(() => {
        hoverTimer = undefined
        if (!hovered || signal.aborted) return
        chart.dispatchAction({ type: 'highlight', seriesIndex: 0, name: hovered })
        chart.dispatchAction({ type: 'showTip', seriesIndex: 0, name: hovered })
      }, 160)
    })
    register(chart, panel.body, render)
    render()
    let sequence = 0
    let requestedMode: MapMode = mode
    let cancellation: AbortController | undefined
    let previousFinish: (() => void) | undefined
    const controls = document.createElement('div')
    controls.className = 'statistics-map-controls'
    controls.setAttribute('role', 'group')
    controls.setAttribute('aria-label', config.labels.map)
    const modes: MapMode[] = ['china', 'world']
    const buttons = modes.map(value => {
      const button = document.createElement('button')
      button.type = 'button'
      button.title = value === 'china' ? config.labels.provinces : config.labels.countries
      button.setAttribute('aria-label', button.title)
      button.setAttribute('aria-pressed', String(value === mode))
      const icon = document.createElement('i')
      icon.className = value === 'china' ? 'ic i-china' : 'ic i-global'
      icon.setAttribute('aria-hidden', 'true')
      button.append(icon)
      button.onclick = () => { void update(value) }
      controls.append(button)
      return button
    })
    const toolbar = document.createElement('div')
    toolbar.className = 'statistics-map-toolbar'
    toolbar.append(controls, zoomControls)
    panel.header.append(toolbar)
    async function update(value: MapMode = requestedMode) {
      requestedMode = value
      const current = ++sequence
      cancellation?.abort()
      previousFinish?.()
      const request = cancellation = new AbortController()
      const done = previousFinish = panel.begin()
      ranking.update([], true)
      summary.hidden = rankingTitle.hidden = true
      try {
        await loadMap(config.assets?.maps?.[value], echarts, value)
        if (signal.aborted || current !== sequence) return
        mode = value
        hovered = undefined
        clearTimeout(hoverTimer)
        view = {}
        hit.reset()
        panel.body.style.aspectRatio = String(mapAspects.get(mode) || 1)
        chart.resize()
        panel.element.dataset.mapMode = mode
        data = []
        ranking.update(data, true)
        scale.update(data)
        buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(modes[index] === mode)))
        render()
        const result = await source.regions(mode, request.signal)
        if (signal.aborted || current !== sequence) return
        const aliases: Record<string, string> = mode === 'world'
          ? Object.fromEntries(echarts.getMap('statistics-world').geoJson.features.flatMap((feature: any) => [feature.properties.name_en, feature.properties.name_alias].filter(Boolean).map(name => [name, feature.properties.name]))) : {}
        data = result.map(item => ({ ...item, name: aliases[item.name] || item.name }))
        const recorded = data.filter(item => Number.isFinite(item.value) && item.value >= 0)
        const regions = new Set(echarts.getMap(`statistics-${mode}`).geoJson.features.map((feature: any) => feature.properties.name))
        const values: Record<string, string> = {
          total: recorded.reduce((total, item) => total + item.value, 0).toLocaleString(),
          regions: new Set(recorded.filter(item => regions.has(item.name)).map(item => item.name)).size.toLocaleString(),
        }
        summary.replaceChildren()
        for (const part of config.labels[`map_summary_${mode}`].split(/(\{total\}|\{regions\})/)) {
          const value = values[part.slice(1, -1)]
          const segment = document.createElement(value === undefined ? 'span' : 'strong')
          segment.textContent = value === undefined ? part : value
          summary.append(segment)
        }
        summary.hidden = recorded.length === 0
        rankingTitle.textContent = config.labels.ranking_top.replace('{count}', String(Math.min(10, recorded.length)))
        rankingTitle.hidden = recorded.length === 0
        ranking.update(data)
        scale.update(data)
        render()
        if (data.length) panel.success()
        else panel.empty()
      } catch (error) {
        if (!signal.aborted && current === sequence) panel.fail(error)
      } finally { done() }
    }
    panel.button.onclick = () => { void update() }
    void update()
  } catch (error) {
    if (!signal.aborted) {
      panel.fail(error)
      panel.button.onclick = () => { void mountMap(panel, source, config, root, signal, register) }
    }
  } finally { finish() }
}
