export const calendarColors = ['#d7dbe2', '#fdcdec', '#fc9bd9', '#fa6ac5', '#f838b2', '#f5089f', '#c4067e', '#92055e', '#540336', '#48022f']

const resolvedColors = new Map<string, string>()
let colorContext: CanvasRenderingContext2D | null | undefined

// ECharts 4 parses rgb/hex itself and cannot consume CSS color-mix/color(srgb).
// Let the browser resolve modern CSS colors once, then pass plain sRGB to it.
export function resolveChartColor(value: string, fallback: string): string {
  if (!value) return fallback
  if (/^(?:#[\da-f]{3,8}|rgba?\([\d.,\s]+\))$/i.test(value)) return value
  const cached = resolvedColors.get(value)
  if (cached) return cached
  if (colorContext === undefined) {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    colorContext = canvas.getContext('2d', { willReadFrequently: true })
  }
  if (!colorContext) return fallback
  colorContext.clearRect(0, 0, 1, 1)
  colorContext.fillStyle = fallback
  colorContext.fillStyle = value
  colorContext.fillRect(0, 0, 1, 1)
  const [red, green, blue, alpha] = colorContext.getImageData(0, 0, 1, 1).data
  const color = `rgba(${red},${green},${blue},${alpha / 255})`
  if (resolvedColors.size >= 128) resolvedColors.clear()
  resolvedColors.set(value, color)
  return color
}

export function statisticsColors(root: HTMLElement) {
  const styles = getComputedStyle(root)
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  const read = (key: string, fallback: string) => resolveChartColor(styles.getPropertyValue(key).trim(), fallback)
  const low = read('--statistics-scale-low', '#fce9ee'), start = read('--statistics-bar-start', '#f3b3c5')
  const mid = read('--statistics-scale-mid', '#f1acc0'), high = read('--statistics-scale-high', '#df5d82')
  return {
    scale: [low, mid, high], bar: [start, high],
    calendar: calendarColors.map((color, index) => read(`--statistics-calendar-${index}`, color)),
    zoom: read('--statistics-zoom-fill', 'rgba(225,120,153,.15)'),
    rankHover: read('--statistics-rank-hover', 'rgba(236,140,105,.65)'),
    trend: [read('--statistics-trend-current', '#49b1f5'), read('--statistics-trend-previous', dark ? '#7f94a7' : '#9aaebf')],
    mapFill: read('--statistics-map-fill', dark ? '#435767' : '#e8eff3'),
    mapBorder: read('--statistics-map-border', dark ? '#819baa' : '#a7b8c2'),
    mapHover: read('--statistics-map-hover', dark ? 'rgba(244,174,148,.4)' : 'rgba(236,140,105,.3)'),
    mapLabel: read('--statistics-map-label', dark ? '#f3fbff' : '#23465e'),
    mapLabelOutline: read('--statistics-map-label-outline', dark ? '#234057' : '#f7fcff'),
    mapEmphasisBorder: read('--statistics-map-emphasis-border', dark ? '#e7ad91' : '#c98b70'),
    mapLines: read('--statistics-map-lines', dark ? '#a2bfd0' : '#839eaf')
  }
}

// Canvas charts cannot inherit CSS colors automatically; resolve a complete theme per render.
export function chartPalette(dark: boolean) {
  return dark ? {
    text: '#dce5ee', axis: '#7f94a7', grid: '#394856', surface: '#283440',
    border: '#53687a', line: '#60c9df', average: '#54d9ca',
    areaTop: 'rgba(96,201,223,.38)', areaBottom: 'rgba(96,201,223,.03)',
    barTop: '#f0a1b8', barBottom: '#b87a8e', calendar: ['#344553', '#529cbc', '#8ed8e4'],
    series: ['#efa1b9', '#7fbbb5', '#9eaccb', '#d9b87f', '#dba291', '#acbe92', '#cb91ab', '#81aec6', '#b5a1b8', '#aab5ad'],
  } : {
    text: '#46586a', axis: '#9aaebf', grid: '#e3ebf1', surface: '#ffffff',
    border: '#d3dfe8', line: '#2799bb', average: '#20cbbf',
    areaTop: 'rgba(39,153,187,.28)', areaBottom: 'rgba(39,153,187,.02)',
    barTop: '#df5d82', barBottom: '#f3b3c5', calendar: ['#edf3f7', '#94c9da', '#318eac'],
    series: ['#df7899', '#6fa8a1', '#899bbb', '#c6a466', '#cd927f', '#91a77c', '#b96f8d', '#6f9fb8', '#a18ba5', '#95a398'],
  }
}
