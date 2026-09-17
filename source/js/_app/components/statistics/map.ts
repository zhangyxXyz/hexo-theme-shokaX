import { loadCharts, loadMap, mapAspects } from './assets'
import { chartOptions } from './options'
import { mapInteractions } from './map-interactions'
import type { BaiduSource } from './baidu'
import type { Panel } from './panel'
import type { MapMode, Point, RegisterChart, Settings } from './types'

export async function mountMap(panel: Panel, source: BaiduSource, config: Settings, root: HTMLElement, signal: AbortSignal, register: RegisterChart) {
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
    const hit = mapInteractions(chart, panel, config.labels, () => mode, signal)
    const render = () => { chart.setOption(chartOptions('map', data, config.labels, root, panel.body, echarts, mode), true); hit.update() }
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
    panel.body.before(controls)
    async function update(value: MapMode = requestedMode) {
      requestedMode = value
      const current = ++sequence
      cancellation?.abort()
      previousFinish?.()
      const request = cancellation = new AbortController()
      const done = previousFinish = panel.begin()
      try {
        await loadMap(config.assets?.maps?.[value], echarts, value)
        if (signal.aborted || current !== sequence) return
        mode = value
        hit.reset()
        panel.body.style.aspectRatio = String(mapAspects.get(mode) || 1)
        chart.resize()
        panel.element.dataset.mapMode = mode
        data = []
        buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(modes[index] === mode)))
        render()
        const result = await source.regions(mode, request.signal)
        if (signal.aborted || current !== sequence) return
        const aliases: Record<string, string> = mode === 'world'
          ? Object.fromEntries(echarts.getMap('statistics-world').geoJson.features.flatMap((feature: any) => [feature.properties.name_en, feature.properties.name_alias].filter(Boolean).map(name => [name, feature.properties.name]))) : {}
        data = result.map(item => ({ ...item, name: aliases[item.name] || item.name }))
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
