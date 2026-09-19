import type { ChartKey, Labels } from './types'

const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
const dateLabel = (value: unknown) => String(value ?? '').replace(/^(\d{4})(\d{2})(\d{2})?$/, (_, year, month, day) => `${year}-${month}${day ? '-' + day : ''}`)

// HTML is needed for backdrop blur. Never interpolate unescaped API or post names.
export function tooltipContent(key: ChartKey, input: any, labels: Labels) {
  const item = Array.isArray(input) ? input[0] : input
  if (!item) return ''
  const rawValue = key === 'calendar' ? item.value?.[1] : item.value
  const value = Number.isFinite(rawValue) ? rawValue : labels.empty
  const name = key === 'calendar' ? dateLabel(item.value?.[0]) : key === 'posts' || key === 'trends' ? dateLabel(item.axisValueLabel ?? item.axisValue ?? item.name) : item.axisValueLabel ?? item.name
  const metric = key === 'posts' || key === 'tags' || key === 'categories' || key === 'clock' ? labels.count : labels.visits
  if (key === 'clock') {
    const days = labels.weekdays.split(',')
    const detail = (item.data?.breakdown || []).map((count: number, day: number) => count > 0 ? `<div>${escape(days[day])}: ${escape(count)}</div>` : '').join('')
    return `<div>${escape(name)}</div><div>${escape(metric)}: ${escape(value)}</div>${detail}`
  }
  if (key === 'map') {
    const detail = Number.isFinite(rawValue) ? `${escape(metric)}: ${escape(rawValue.toLocaleString())}` : escape(labels.map_no_record)
    return `<div class="statistics-map-tooltip-title">${escape(name)}</div><div>${detail}</div>`
  }
  const percent = (key === 'categories' || key === 'sources') && Number.isFinite(item.percent) ? ` (${item.percent}%)` : ''
  return `<div style="font-weight:500;margin-bottom:3px">${escape(name)}</div><div>${escape(metric)}: ${escape(value)}${escape(percent)}</div>`
}
