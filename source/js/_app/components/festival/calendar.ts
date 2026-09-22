import { solarTerms, solarTermDate, type SolarTerm } from './solar-terms'

const holidays = ['lantern', 'spring', 'dragon_boat', 'qixi', 'mid_autumn', 'chongyang', 'laba'] as const
export type Scene = 'daily' | typeof holidays[number] | SolarTerm | 'none'
type Holiday = { enable?: boolean; calendar?: string; month?: number; day?: number; before?: number; after?: number; label?: string; word1?: string; word2?: string }
export interface FestivalOptions {
  enable?: boolean
  theme?: string
  mobile?: boolean
  table?: {
    timezone?: string
    priority?: string[]
    items?: Partial<Record<Scene, Holiday>>
  }
}

const dayMs = 86400000
const windowDays = (value: number | undefined, fallback: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(30, Math.floor(value))) : fallback

export function selectFestival(options: FestivalOptions, now = new Date()): Scene {
  if (!options.enable) return 'none'
  const items = options.table?.items || {}
  const daily = items.daily?.enable === false ? 'none' : 'daily'
  const scenes: Scene[] = ['daily', ...holidays, ...solarTerms]
  if (options.theme === 'none') return 'none'
  if (scenes.includes(options.theme as Scene)) return items[options.theme as Scene]?.enable === false ? 'none' : options.theme as Scene
  try {
    const timeZone = options.table?.timezone || 'Asia/Shanghai'
    const local = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(now)
    const part = (type: string) => Number(local.find(p => p.type === type)?.value)
    const today = Date.UTC(part('year'), part('month') - 1, part('day'), 12)
    // Initialize only for lunar entries: unsupported Chinese calendars must not
    // disable Gregorian holidays or the independently sourced solar-term table.
    let lunar: Intl.DateTimeFormat | null | undefined
    const lunarParts = (candidate: Date) => {
      try {
        if (lunar === undefined) {
          lunar = new Intl.DateTimeFormat('en-US-u-ca-chinese', {
            timeZone: 'UTC', month: 'numeric', day: 'numeric'
          })
          if (lunar.resolvedOptions().calendar !== 'chinese') lunar = null
        }
        return lunar?.formatToParts(candidate)
      } catch {
        lunar = null
        return undefined
      }
    }
    for (const name of options.table?.priority || [...holidays, ...solarTerms]) {
      if (name === 'daily' || !scenes.includes(name as Scene)) continue
      const config = items[name as Scene]
      if (!config || config.enable === false) continue
      if (config.calendar !== 'solar_term' && (!config.month || !config.day)) continue
      const before = windowDays(config.before, 0)
      const after = windowDays(config.after, 0)
      for (let offset = -after; offset <= before; offset++) {
        const candidate = new Date(today + offset * dayMs)
        if (config.calendar === 'solar_term') {
          const term = solarTermDate(candidate.getUTCFullYear(), name)
          if (term && candidate.getUTCMonth() + 1 === term.month && candidate.getUTCDate() === term.day) return name as Scene
          continue
        }
        if (config.calendar === 'solar') {
          if (candidate.getUTCMonth() + 1 === config.month && candidate.getUTCDate() === config.day) return name as Scene
          continue
        }
        const parts = lunarParts(candidate)
        if (!parts) continue
        // Exact month matching excludes leap months such as "5bis".
        if (parts.find(p => p.type === 'month')?.value === String(config.month) &&
            parts.find(p => p.type === 'day')?.value === String(config.day)) return name as Scene
      }
    }
  } catch {
    // Invalid dates/timezones retain the daily decoration.
  }
  return daily
}
