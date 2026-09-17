import type { ChartKey, Labels, Point } from './types'
import { dateKey, calendarRange } from './dates'
import { mapAspects, mapLines } from './assets'
import { chartPalette } from './palette'
import { tooltipContent } from './tooltip-content'

export function chartOptions(key: ChartKey, data: Point[], labels: Labels, root: HTMLElement, body: HTMLElement, echarts: any, mapMode = 'china') {
  const { today, yearAgo } = calendarRange()
  const styles = getComputedStyle(root)
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  const palette = chartPalette(dark)
  const color = palette.text
  const axisColor = palette.axis
  const borderColor = palette.border
  const mapFill = styles.getPropertyValue('--statistics-map-fill').trim() || (dark ? '#435767' : '#e8eff3')
  const mapBorder = styles.getPropertyValue('--statistics-map-border').trim() || (dark ? '#819baa' : '#a7b8c2')
  const mapHover = styles.getPropertyValue('--statistics-map-hover').trim() || (dark ? 'rgba(98,168,209,.72)' : 'rgba(126,189,224,.72)')
  const mapLabel = styles.getPropertyValue('--statistics-map-label').trim() || (dark ? '#f3fbff' : '#23465e')
  const gradient = new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: palette.barTop }, { offset: 1, color: palette.barBottom }])
  const option: any = {
    animationDuration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450,
    color: palette.series,
    textStyle: { color, fontFamily: styles.fontFamily },
    tooltip: { trigger: 'item', renderMode: 'html', formatter: (items: any) => tooltipContent(key, items, labels), extraCssText: 'backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);border-radius:8px;line-height:1.45;max-width:calc(100vw - 24px);overflow-wrap:anywhere;box-sizing:border-box;', confine: true, backgroundColor: styles.getPropertyValue('--tooltip-bg').trim() || palette.surface, borderColor: styles.getPropertyValue('--tooltip-border').trim() || borderColor, borderWidth: 1, borderRadius: 8, padding: [6, 10], shadowBlur: 14, shadowOffsetY: 4, shadowColor: dark ? 'rgba(0,0,0,.28)' : 'rgba(35,62,83,.14)', textStyle: { color: styles.getPropertyValue('--tooltip-text').trim() || color, fontSize: 12 }, axisPointer: { lineStyle: { color: palette.axis, type: 'dashed' }, shadowStyle: { color: dark ? 'rgba(150,190,220,.10)' : 'rgba(80,130,170,.08)' } } },
  }
  if (key === 'map') {
    const aspect = mapAspects.get(mapMode) || 1
    const layout = { map: `statistics-${mapMode}`, layoutCenter: ['50%', '50%'], layoutSize: (aspect >= 1 ? body.clientWidth : body.clientWidth / aspect) * .94, roam: false }
    option.visualMap = { show: data.length > 0, seriesIndex: 0, min: 0, max: Math.max(1, ...data.map(item => item.value)), left: 0, bottom: 0, itemWidth: 10, itemHeight: 90, textStyle: { color }, calculable: true, inRange: { color: ['#92d0f9', '#49b1f5'] } }
    option.geo = { ...layout, show: false }
    option.series = [{ ...layout, type: 'map', name: labels.visits, showLegendSymbol: false,
      itemStyle: { areaColor: mapFill, borderColor: mapBorder, borderWidth: .75 },
      emphasis: { label: { show: true, color: mapLabel, fontWeight: 'normal', textBorderColor: dark ? '#234057' : '#f7fcff', textBorderWidth: 1.5 }, itemStyle: { areaColor: mapHover, borderColor: dark ? '#a2d1eb' : '#639dbf', borderWidth: 1 } },
      tooltip: { ...option.tooltip }, data,
    }]
    if (mapLines.get(mapMode)?.length) option.series.push({ type: 'lines', coordinateSystem: 'geo', polyline: true, silent: true, lineStyle: { color: dark ? '#a2bfd0' : '#839eaf', width: 1.25, opacity: 1 }, data: mapLines.get(mapMode)!.map(coords => ({ coords })) })
  } else if (key === 'calendar') {
    const dated = data.map(item => [item.name.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3').replace(/\//g, '-'), item.value])
    const format = (date: Date) => dateKey(date).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
    option.calendar = { top: 20, left: 45, right: 15, cellSize: ['auto', 18], range: [format(yearAgo), format(today)], yearLabel: { show: false }, dayLabel: { color }, monthLabel: { color }, itemStyle: { color: palette.calendar[0], borderColor: palette.surface, borderWidth: 2 } }
    option.visualMap = { min: 0, max: Math.max(1, ...data.map(item => item.value)), orient: 'horizontal', bottom: 0, left: 'center', textStyle: { color }, inRange: { color: palette.calendar } }
    option.series = [{ type: 'heatmap', coordinateSystem: 'calendar', data: dated }]
  } else if (key === 'sources' || key === 'categories') {
    const narrow = body.clientWidth < 520
    option.legend = { show: false }
    option.series = [{ type: 'pie', name: key === 'categories' ? labels.count : labels.visits, roseType: 'area', radius: narrow ? [24, 66] : [30, 80], center: ['50%', '46%'], label: { color, formatter: narrow ? '{b}: {c}' : '{b} : {c} ({d}%)', fontSize: narrow ? 10 : 12 }, labelLine: { length: narrow ? 8 : 15, length2: narrow ? 6 : 15 }, data: [...data].sort((a, b) => b.value - a.value) }]
  } else {
    const ordered = key === 'tags' ? data : [...data].sort((a, b) => a.name.localeCompare(b.name))
    option.tooltip.trigger = 'axis'
    option.grid = { top: 40, left: 16, right: 58, bottom: 30, containLabel: true }
    const axis = { nameTextStyle: { color }, axisLabel: { color, fontSize: 11, margin: 10 }, axisTick: { show: false }, axisLine: { lineStyle: { color: axisColor } }, splitLine: { show: false } }
    option.xAxis = { ...axis, name: key === 'tags' ? labels.tag_axis : labels.date, type: 'category', boundaryGap: key === 'tags', data: ordered.map(item => item.name) }
    option.yAxis = { ...axis, name: key === 'trends' ? labels.visits : labels.count, type: 'value', minInterval: 1 }
    option.yAxis.splitLine = { show: true, lineStyle: { color: palette.grid, type: 'dashed', opacity: 1 } }
    option.series = [{ type: key === 'tags' ? 'bar' : 'line', name: key === 'trends' ? labels.visits : labels.count, data: ordered.map(item => item.value), smooth: true, showSymbol: false, barCategoryGap: '20%', itemStyle: { color: gradient, barBorderRadius: [3, 3, 0, 0] }, lineStyle: { color: palette.barBottom, width: 1 }, areaStyle: { color: gradient, opacity: 1 }, markLine: { symbol: ['circle', 'arrow'], lineStyle: { color: palette.average, width: 1, type: 'dashed' }, label: { color, position: key === 'tags' ? 'end' : 'insideEndTop' }, data: [{ type: 'average', name: labels.average }] } }]
  }
  return option
}
