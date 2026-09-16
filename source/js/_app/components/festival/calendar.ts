export type Scene = 'daily' | 'spring' | 'dragon_boat' | 'mid_autumn' | 'none'
type Holiday = { enable?: boolean; calendar?: string; month?: number; day?: number; before?: number; after?: number }
export interface FestivalOptions {
  enable?: boolean
  theme?: string
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
  const scenes: Scene[] = ['daily', 'spring', 'dragon_boat', 'mid_autumn']
  if (options.theme === 'none') return 'none'
  if (scenes.includes(options.theme as Scene)) return items[options.theme as Scene]?.enable === false ? 'none' : options.theme as Scene
  try {
    const timeZone = options.table?.timezone || 'Asia/Shanghai'
    const local = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(now)
    const part = (type: string) => Number(local.find(p => p.type === type)?.value)
    const today = Date.UTC(part('year'), part('month') - 1, part('day'), 12)
    const lunar = new Intl.DateTimeFormat('en-US-u-ca-chinese', {
      timeZone: 'UTC', month: 'numeric', day: 'numeric'
    })
    if (lunar.resolvedOptions().calendar !== 'chinese') return daily
    for (const name of options.table?.priority || Object.keys(items)) {
      if (name === 'daily' || !scenes.includes(name as Scene)) continue
      const config = items[name as Scene]
      if (!config || config.enable === false || !config.month || !config.day) continue
      const before = windowDays(config.before, 0)
      const after = windowDays(config.after, 0)
      for (let offset = -after; offset <= before; offset++) {
        const candidate = new Date(today + offset * dayMs)
        if (config.calendar === 'solar') {
          if (candidate.getUTCMonth() + 1 === config.month && candidate.getUTCDate() === config.day) return name as Scene
          continue
        }
        const parts = lunar.formatToParts(candidate)
        // Exact month matching excludes leap months such as "5bis".
        if (parts.find(p => p.type === 'month')?.value === String(config.month) &&
            parts.find(p => p.type === 'day')?.value === String(config.day)) return name as Scene
      }
    }
  } catch {
    // Older browsers without the Chinese calendar retain the daily decoration.
  }
  return daily
}
