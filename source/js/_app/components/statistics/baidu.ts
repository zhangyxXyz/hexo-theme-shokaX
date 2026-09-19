import type { BaiduSettings, MapMode, Point } from './types'
import { calendarRange, dateKey } from './dates'

// The endpoint and site identity belong to the site configuration, never this module.
export function createBaiduSource(settings: BaiduSettings = {}, lifecycle: AbortSignal) {
  const { today, yearAgo, calendarStart } = calendarRange()
  const start = settings.start_date || dateKey(yearAgo)
  async function fetchReport(url: URL, cancellation?: AbortSignal) {
    const active = AbortSignal.any([lifecycle, ...(cancellation ? [cancellation] : [])])
    active.throwIfAborted()
    const timeout = new AbortController()
    const timer = window.setTimeout(() => timeout.abort(), settings.timeout ?? 20000)
    try {
        const response = await fetch(url, { signal: AbortSignal.any([active, timeout.signal]), credentials: 'omit' })
        if (!response.ok) throw new Error(response.status >= 500 || [408, 429].includes(response.status) ? 'temporary' : 'http')
        const data = await response.json()
        if (Number(data.error_code) === 111) throw new Error('expired')
        if (Number(data.error_code) === 18) throw new Error('temporary')
        if (Number(data.error_code) > 0 || !Array.isArray(data.result?.items?.[0]) || !Array.isArray(data.result?.items?.[1])) throw new Error('response')
        return data.result
    } catch (error) {
      active.throwIfAborted()
      throw timeout.signal.aborted ? new Error('timeout') : error instanceof TypeError ? new Error('network') : error
    } finally { clearTimeout(timer) }
  }
  async function request(method: string, startDate: string, gran?: string, cancellation?: AbortSignal, endDate = dateKey(today)): Promise<Point[]> {
    if (!settings.api || !settings.site_id) throw new Error('unconfigured')
    const url = new URL(settings.api)
    Object.entries({ site_id: settings.site_id, method, start_date: startDate, end_date: endDate, metrics: 'pv_count', max_results: '0', ...(gran ? { gran } : {}) }).forEach(([key, value]) => url.searchParams.set(key, value))
    const points: Point[] = []
    const pages = method === 'visit/toppage/a'
    if (pages) url.searchParams.set('max_results', '1000')
    let previousBatch = ''
    do {
      if (pages) url.searchParams.set('start_index', String(points.length))
      const result = await fetchReport(url, cancellation)
      const batch = JSON.stringify(result.items[0])
      if (pages && batch === previousBatch) throw new Error('response')
      previousBatch = batch
      points.push(...result.items[0].map((row: any[], index: number) => ({
        name: String(row[0]?.name ?? row[0]),
        value: typeof result.items[1][index]?.[0] === 'number' ? result.items[1][index][0] : /^\d+(\.\d+)?$/.test(String(result.items[1][index]?.[0])) ? Number(result.items[1][index][0]) : NaN,
      })))
      if (!pages || points.length >= Number(result.total ?? points.length)) return points
      if (!result.items[0].length || points.length >= 100000) throw new Error('response')
    } while (true)
  }
  return {
    pages: (startDate: string, endDate: string, cancellation: AbortSignal) => request('visit/toppage/a', startDate, undefined, cancellation, endDate),
    daily: (startDate: string, endDate: string, cancellation: AbortSignal) => request('trend/time/a', startDate, 'day', cancellation, endDate),
    calendar: () => request('overview/getTimeTrendRpt', dateKey(calendarStart)),
    trends: () => request('trend/time/a', start, 'month'),
    sources: () => request('source/all/a', start),
    regions: (mode: MapMode, cancellation?: AbortSignal) => request(mode === 'world' ? 'visit/world/a' : 'visit/district/a', start, undefined, cancellation),
  }
}

export type BaiduSource = ReturnType<typeof createBaiduSource>
