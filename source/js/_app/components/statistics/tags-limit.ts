import { enhanceSelect } from '../select-picker'
import type { Labels, Point } from './types'
import type { Panel } from './panel'

export function tagsLimit(panel: Panel, labels: Labels, signal: AbortSignal, render: () => void) {
  const control = document.createElement('div'), select = document.createElement('select')
  control.className = 'statistics-posts-range'
  select.setAttribute('aria-label', labels.content_limit)
  for (const value of ['10', '20', '50', 'all']) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = value === 'all' ? labels.tags_all : `TOP ${value}`
    select.append(option)
  }
  select.value = '10'
  control.append(select)
  panel.header.append(control)
  enhanceSelect(select, { signal, variant: 'statistics' })
  select.onchange = render
  return (data: Point[]) => select.value === 'all' ? data : data.slice(0, Number(select.value))
}
