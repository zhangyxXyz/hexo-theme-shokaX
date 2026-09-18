import { calendarRange, dateKey } from './dates'
import type { Labels, Point } from './types'

export const calendarColors = ['#d7dbe2', '#fdcdec', '#fc9bd9', '#fa6ac5', '#f838b2', '#f5089f', '#c4067e', '#92055e', '#540336', '#48022f']
export const normalizeDay = (value: string) => value.replace(/[/\-]/g, '')
export const displayDay = (value: string) => normalizeDay(value).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1/$2/$3')

export function calendarTotals(data: Point[], now = new Date()) {
  const { today, calendarStart } = calendarRange(now)
  return [undefined, 30, 7].map(days => {
    const start = new Date(days ? today : calendarStart)
    if (days) start.setDate(start.getDate() - days + 1)
    const from = dateKey(start), to = dateKey(today)
    const values = data.filter(item => normalizeDay(item.name) >= from && normalizeDay(item.name) <= to && Number.isFinite(item.value))
    return { from, to, total: values.length ? values.reduce((sum, item) => sum + item.value, 0) : null }
  })
}

export function calendarDetails(data: Point[], labels: Labels) {
  const content = document.createElement('div')
  content.className = 'statistics-calendar-details'
  const footer = document.createElement('div')
  footer.className = 'statistics-calendar-footer'
  const source = document.createElement('span')
  source.textContent = `${labels.data_source} `
  const link = document.createElement('a')
  link.href = 'https://tongji.baidu.com/'
  link.textContent = labels.baidu
  source.append(link)
  const legend = document.createElement('div')
  legend.className = 'statistics-calendar-scale'
  const less = document.createElement('span'), more = document.createElement('span')
  less.textContent = 'Less'
  more.textContent = 'More'
  legend.append(less)
  for (const index of [0, 2, 4, 6, 8]) {
    const swatch = document.createElement('i')
    swatch.style.backgroundColor = calendarColors[index]
    swatch.setAttribute('aria-hidden', 'true')
    legend.append(swatch)
  }
  legend.append(more)
  footer.append(source, legend)
  const cards = document.createElement('div')
  cards.className = 'statistics-calendar-totals'
  calendarTotals(data).forEach((item, index) => {
    const card = document.createElement('div')
    const title = document.createElement('span')
    title.textContent = labels[['year_visits', 'month_visits', 'week_visits'][index]]
    const value = document.createElement('strong')
    value.textContent = item.total === null ? '—' : item.total.toLocaleString()
    const range = document.createElement('small')
    range.textContent = `${displayDay(item.from)} – ${displayDay(item.to)}`
    card.append(title, value, range)
    cards.append(card)
  })
  content.append(footer, cards)
  return content
}
