import { solarTermDate } from '../festival/solar-terms'

type Text = string | string[]
export type HolidayDay = { name: string; date: string; isOffDay: boolean }
export type CalendarTips = {
  timezone?: string
  solarTerms?: Record<string, { name: string; text: Text }>
  solarTermEve?: Text
  holiday?: Partial<Record<'eve' | 'first' | 'day' | 'last' | 'workday' | 'workdayEve' | 'upcoming', Text>>
  upcomingDays?: number
}
export type CalendarTip = { message: string; name: string }

const dayMs = 86400000
const cachePrefix = 'shokax.holiday-cn.'
const pick = (text: Text | undefined) => {
  const list = (Array.isArray(text) ? text : [text]).filter((item): item is string => typeof item === 'string' && item !== '')
  return list[Math.floor(Math.random() * list.length)]
}

// Civil dates in the configured zone, as UTC noon so day arithmetic never crosses DST.
function civilToday(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now)
  const part = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return Date.UTC(part('year'), part('month') - 1, part('day'), 12)
}
const dateKey = (time: number) => new Date(time).toISOString().slice(0, 10)

export function calendarYears(now: Date, calendar: CalendarTips) {
  const today = new Date(civilToday(now, calendar.timezone || 'Asia/Shanghai'))
  const year = today.getUTCFullYear()
  // Holidays early next year are announced late in the current one.
  return today.getUTCMonth() === 11 ? [year, year + 1] : [year]
}

export function selectCalendarTip(calendar: CalendarTips, days: HolidayDay[], now = new Date()): CalendarTip | undefined {
  let today: number
  try { today = civilToday(now, calendar.timezone || 'Asia/Shanghai') } catch { return }
  const byDate = new Map(days.map(day => [day.date, day]))
  const at = (offset: number) => byDate.get(dateKey(today + offset * dayMs))
  const tip = (text: Text | undefined, name: string, days?: number) => {
    const message = pick(text)
    return message ? { message: days === undefined ? message : message.replace('{days}', String(days)), name } : undefined
  }
  const holiday = calendar.holiday || {}
  const current = at(0)
  const tomorrow = at(1)
  const sameOff = (day: HolidayDay | undefined, name: string) => day?.isOffDay === true && day.name === name

  let result: CalendarTip | undefined
  if (current && !current.isOffDay) result = tip(holiday.workday, current.name)
  else if (current) {
    const key = !sameOff(tomorrow, current.name) ? 'last' : !sameOff(at(-1), current.name) ? 'first' : 'day'
    result = tip(holiday[key], current.name)
  }
  if (result) return result
  if (tomorrow && !tomorrow.isOffDay) result = tip(holiday.workdayEve, tomorrow.name)
  else if (tomorrow) result = tip(holiday.eve, tomorrow.name)
  if (result) return result

  const termOn = (offset: number) => {
    const date = new Date(today + offset * dayMs)
    return Object.entries(calendar.solarTerms || {}).find(([key]) => {
      const term = solarTermDate(date.getUTCFullYear(), key)
      return term && term.month === date.getUTCMonth() + 1 && term.day === date.getUTCDate()
    })?.[1]
  }
  const term = termOn(0)
  if (term && (result = tip(term.text, term.name))) return result
  const eve = termOn(1)
  if (eve && (result = tip(calendar.solarTermEve, eve.name))) return result

  const limit = Math.max(0, Math.min(30, Math.floor(calendar.upcomingDays ?? 7)))
  for (let offset = 2; offset <= limit; offset++) {
    const day = at(offset)
    if (day?.isOffDay && !sameOff(at(offset - 1), day.name)) return tip(holiday.upcoming, day.name, offset)
  }
}

const validDays = (value: unknown): value is HolidayDay[] => Array.isArray(value) && value.every(day =>
  day && typeof day.name === 'string' && typeof day.isOffDay === 'boolean' && typeof day.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day.date))

// An empty year is unpublished, not "no holidays": recheck it sooner.
async function holidayYear(base: string, year: number, signal: AbortSignal): Promise<HolidayDay[]> {
  const key = cachePrefix + year
  let cached: { at: number; days: HolidayDay[] } | undefined
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    if (value && typeof value.at === 'number' && validDays(value.days)) cached = value
  } catch {}
  const ttl = cached?.days.length ? 3 * dayMs : dayMs / 4
  if (cached && Date.now() - cached.at < ttl) return cached.days
  try {
    const response = await fetch(`${base}${year}.json`, { signal })
    if (!response.ok) throw new Error('Holiday data unavailable')
    const data = await response.json()
    if (data?.year !== year || !validDays(data.days)) throw new Error('Holiday data malformed')
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), days: data.days })) } catch {}
    return data.days
  } catch {
    return cached?.days || []
  }
}

export async function loadHolidayDays(base: string, years: number[]) {
  if (!base) return []
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const root = base.replace(/\/?$/, '/')
    return (await Promise.all(years.map(year => holidayYear(root, year, controller.signal)))).flat()
  } finally { clearTimeout(timeout) }
}
