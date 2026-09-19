export function statisticsColors(root: HTMLElement) {
  const styles = getComputedStyle(root)
  const read = (key: string, fallback: string) => styles.getPropertyValue(key).trim() || fallback
  const low = read('--statistics-scale-low', '#fce9ee'), start = read('--statistics-bar-start', '#f3b3c5')
  const pink = read('--statistics-scale-mid', '#f1acc0'), high = read('--statistics-scale-high', '#df5d82')
  return { scale: [low, pink, high], bar: [start, high] }
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
