import type { ChartKey, Labels, Point } from './types'
import { effectiveReducedMotion } from '../motion'
import { dateKey, calendarRange } from './dates'
import { mapAspects, mapLines } from './assets'
import { chartPalette, statisticsColors } from './palette'
import { tooltipContent } from './tooltip-content'
import { chartTooltip } from './tooltip'
import { normalizeDay } from './calendar'

export function chartOptions(key: ChartKey, data: Point[], labels: Labels, root: HTMLElement, body: HTMLElement, echarts: any, mapMode = 'china') {
  const { today, calendarStart } = calendarRange()
  const styles = getComputedStyle(root)
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  const palette = chartPalette(dark)
  const colors = statisticsColors(root)
  const color = palette.text
  const axisColor = palette.axis
  const { mapFill, mapBorder, mapHover, mapLabel } = colors
  const gradient = new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: colors.bar[1] }, { offset: 1, color: colors.bar[0] }])
  const option: any = {
    animationDuration: effectiveReducedMotion() ? 0 : 450,
    color: palette.series,
    textStyle: { color, fontFamily: styles.fontFamily },
    tooltip: { ...chartTooltip(root), trigger: 'item', formatter: (items: any) => tooltipContent(key, items, labels) },
  }
  if (key === 'map') {
    const aspect = mapAspects.get(mapMode) || 1
    const desktop = body.clientWidth > 600
    const reserve = desktop ? Math.min(240, body.clientWidth * .3) : 0
    const available = body.clientWidth - reserve
    const layout = { map: `statistics-${mapMode}`, layoutCenter: [available / 2, '50%'], layoutSize: (aspect >= 1 ? available : available / aspect) * .94, roam: false }
    option.visualMap = { show: false, seriesIndex: 0, min: 0, max: Math.max(1, ...data.map(item => item.value)), inRange: { color: colors.scale } }
    option.geo = { ...layout, show: false }
    option.series = [{ ...layout, roam: true, scaleLimit: { min: 1, max: 5 }, type: 'map', name: labels.visits, showLegendSymbol: false,
      itemStyle: { areaColor: mapFill, borderColor: mapBorder, borderWidth: .75 },
      emphasis: { label: { show: true, color: mapLabel, fontWeight: 'normal', textBorderColor: colors.mapLabelOutline, textBorderWidth: 1.5 }, itemStyle: { areaColor: mapHover, borderColor: colors.mapEmphasisBorder, borderWidth: 1 } },
      tooltip: { ...option.tooltip }, data,
    }]
    if (mapLines.get(mapMode)?.length) option.series.push({ type: 'lines', coordinateSystem: 'geo', polyline: true, silent: true, lineStyle: { color: colors.mapLines, width: 1.25, opacity: 1 }, data: mapLines.get(mapMode)!.map(coords => ({ coords })) })
  } else if (key === 'calendar') {
    const dated = data.map(item => [normalizeDay(item.name).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'), item.value])
    const format = (date: Date) => dateKey(date).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
    const cell = (body.clientWidth - 32) / 54
    const compact = root.clientWidth <= 600
    option.calendar = { top: compact ? 26 : 30, left: 26, right: 6, cellSize: ['auto', cell], range: [format(calendarStart), format(today)], splitLine: { show: false }, yearLabel: { show: false }, dayLabel: { color, firstDay: 0, nameMap: labels.weekdays.split(','), fontSize: compact ? 10 : 12 }, monthLabel: { color, nameMap: labels.months.split(','), fontSize: compact ? 10 : 11 }, itemStyle: { color: dark ? '#39434e' : '#f2f3f5', borderColor: 'transparent', borderWidth: 0 } }
    option.visualMap = { type: 'piecewise', show: false, pieces: [{ value: 0, color: colors.calendar[0] }, ...colors.calendar.slice(1).map((shade, index) => ({ gt: index === 0 ? 0 : (index + 1) * 20 - 1, ...(index < 8 ? { lte: (index + 2) * 20 - 1 } : {}), color: shade }))] }
    option.series = [{ type: 'heatmap', coordinateSystem: 'calendar', data: dated }]
    option.series[0].itemStyle = { borderColor: dark ? '#22272e' : '#fff', borderWidth: Math.max(2, cell * .2) }
  } else if (key === 'clock') {
    option.polar = { center: ['50%', '50%'], radius: '72%' }
    option.angleAxis = { type: 'category', data: data.map(item => item.name), startAngle: 90, clockwise: true,
      axisTick: { show: false }, axisLabel: { color, fontSize: 10, interval: 2 },
      axisLine: { lineStyle: { color: palette.grid } }, splitLine: { show: true, lineStyle: { color: palette.grid } } }
    option.radiusAxis = { type: 'value', minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { lineStyle: { color: palette.grid, type: 'dashed' } } }
    option.series = [{ type: 'bar', coordinateSystem: 'polar', name: labels.count, data,
      barWidth: '65%', itemStyle: { color: colors.scale[2], opacity: .85 }, emphasis: { itemStyle: { color: mapHover, opacity: 1 } } }]
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
    option.series = [{ type: key === 'tags' ? 'bar' : 'line', name: key === 'trends' ? labels.visits : labels.count, data: ordered.map(item => item.value), smooth: false, showSymbol: false, barCategoryGap: '35%', itemStyle: { color: gradient, barBorderRadius: [3, 3, 0, 0] }, lineStyle: { color: colors.scale[2], width: 2 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: colors.bar[0] }, { offset: 1, color: colors.scale[0] }]), opacity: dark ? .2 : .35 }, markLine: { silent: true, symbol: 'none', lineStyle: { color: colors.scale[2], opacity: .55, width: 1, type: 'dashed' }, emphasis: { lineStyle: { width: 1, type: 'dashed' } }, label: { color, position: 'insideEndTop' }, data: [{ type: 'average', name: labels.average }] } }]
  }
  return option
}
