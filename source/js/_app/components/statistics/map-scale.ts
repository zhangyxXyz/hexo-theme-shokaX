import type { Labels, Point } from './types'

export function createMapScale(labels: Labels) {
  const element = document.createElement('div')
  element.className = 'statistics-map-scale'
  const high = document.createElement('span'), low = document.createElement('span')
  high.textContent = labels.high
  low.textContent = labels.low
  const bar = document.createElement('div')
  bar.className = 'statistics-map-scale-bar'
  const max = document.createElement('span'), min = document.createElement('span')
  max.className = 'statistics-map-scale-max'
  min.className = 'statistics-map-scale-min'
  min.textContent = '0'
  bar.append(max, min)
  element.append(high, bar, low)
  return {
    element,
    update(data: Point[]) {
      element.hidden = data.length === 0
      max.textContent = Math.max(0, ...data.map(item => item.value)).toLocaleString()
    },
  }
}
