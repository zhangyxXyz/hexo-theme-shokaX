import type { BaiduSettings, MapMode, Point } from './types'
import { calendarRange, dateKey } from './dates'

// The endpoint and site identity belong to the site configuration, never this module.
export function createBaiduSource(settings: BaiduSettings = {}, lifecycle: AbortSignal) {
  const { today, yearAgo } = calendarRange()
  const start = settings.start_date || dateKey(yearAgo)
  async function request(method: string, startDate: string, gran?: string, cancellation?: AbortSignal): Promise<Point[]> {
    if (!settings.api || !settings.site_id) throw new Error('unconfigured')
    const url = new URL(settings.api)
    Object.entries({ site_id: settings.site_id, method, start_date: startDate, end_date: dateKey(today), metrics: 'pv_count', ...(gran ? { gran } : {}) }).forEach(([key, value]) => url.searchParams.set(key, value))
    const timeout = new AbortController()
    const timer = window.setTimeout(() => timeout.abort(), settings.timeout ?? 20000)
    const signal = AbortSignal.any([lifecycle, timeout.signal, ...(cancellation ? [cancellation] : [])])
    try {
      signal.throwIfAborted()
      const response = await fetch(url, { signal, credentials: 'omit' })
      if (!response.ok) throw new Error('http')
      const data = await response.json()
      if (Number(data.error_code) === 111) throw new Error('expired')
      if (Number(data.error_code) > 0 || !Array.isArray(data.result?.items?.[0]) || !Array.isArray(data.result?.items?.[1])) throw new Error('response')
      return data.result.items[0].map((row: any[], index: number) => ({
        name: String(row[0]?.name ?? row[0]),
        value: Number(data.result.items[1][index]?.[0]) || 0,
      }))
    } finally {
      clearTimeout(timer)
    }
  }
  return {
    calendar: () => request('overview/getTimeTrendRpt', dateKey(yearAgo)),
    trends: () => request('trend/time/a', start, 'month'),
    sources: () => request('source/all/a', start),
    regions: (mode: MapMode, cancellation?: AbortSignal) => request(mode === 'world' ? 'visit/world/a' : 'visit/district/a', start, undefined, cancellation),
  }
}

export type BaiduSource = ReturnType<typeof createBaiduSource>
