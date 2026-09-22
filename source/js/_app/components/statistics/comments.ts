import type { MapMode, Point, Settings } from './types'

export type CommentStatistics = {
  version: 1
  total: number
  participants: number
  trend: Point[]
  ranking: (Point & { key: string })[]
  content: Point[]
  regions: Record<MapMode, Point[]>
}

const points = (value: unknown): value is Point[] => Array.isArray(value) && value.every(item =>
  typeof item?.name === 'string' && Number.isSafeInteger(item.value) && item.value >= 0)

// One aggregate request per page; failures can be retried by any of the panels.
export function createCommentSource(config: Settings, signal: AbortSignal) {
  let pending: Promise<CommentStatistics> | undefined
  const load = () => pending ??= (async () => {
    if (!config.comments?.api) throw new Error('comments_unavailable')
    const url = new URL(`${config.comments.api.replace(/\/+$/, '')}/api/comment`)
    url.searchParams.set('type', 'statistics')
    const request = new AbortController()
    const abort = () => request.abort()
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    const timer = setTimeout(abort, 15000)
    try {
      const response = await fetch(url, { signal: request.signal, credentials: 'omit' })
      if (!response.ok) throw new Error('comments_unavailable')
      const result = await response.json()
      const data = result.data
      if (result.errno !== 0 || data?.version !== 1 || !Number.isSafeInteger(data.total) || data.total < 0 ||
          !Number.isSafeInteger(data.participants) || data.participants < 0 || !points(data.trend) ||
          !points(data.ranking) || !data.ranking.every((item: { key?: string }) => /^[a-f0-9]{56,2048}$/.test(item.key || '')) || !points(data.content) || !points(data.regions?.china) || !points(data.regions?.world)) {
        throw new Error('comments_unavailable')
      }
      return data as CommentStatistics
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
    }
  })().catch(error => { pending = undefined; throw error })
  return {
    load,
    regions: async (mode: MapMode) => (await load()).regions[mode],
    trend: async () => (await load()).trend,
    ranking: async () => (await load()).ranking.map(item => ({ ...item, name: item.name || config.labels.comment_anonymous })),
  }
}

export type CommentSource = ReturnType<typeof createCommentSource>
export type CommentListItem = {
  id: string; url: string; nick: string; time: string; avatar?: string; link?: string; comment?: string;
  label?: string; labelColors?: { light?: Record<string, string>; dark?: Record<string, string> };
  levelColors?: { light?: Record<string, string>; dark?: Record<string, string> };
  level?: number; levelLabel?: string; addr?: string; browser?: string; os?: string; type?: string
}
export type CommentList = { total: number; page: number; hasMore: boolean; items: CommentListItem[] }

export async function loadCommentList(config: Settings, filter: { author?: string; url?: string }, page: number, signal: AbortSignal): Promise<CommentList> {
  if (!config.comments?.api) throw new Error('comments_unavailable')
  const url = new URL(`${config.comments.api.replace(/\/+$/, '')}/api/comment`)
  url.search = new URLSearchParams({ type: 'statistics-comments', ...filter, page: String(page), pageSize: '20' }).toString()
  const response = await fetch(url, { signal, credentials: 'omit' })
  if (!response.ok) throw new Error('comments_unavailable')
  const result = await response.json()
  const data = result.data
  if (result.errno !== 0 || !Number.isSafeInteger(data?.total) || data.total < 0 || data.page !== page || typeof data.hasMore !== 'boolean' ||
      !Array.isArray(data.items) || !data.items.every((item: any) => typeof item.id === 'string' && typeof item.url === 'string' && typeof item.nick === 'string' && typeof item.time === 'string')) throw new Error('response')
  return data
}

export function commentSettings(config: Settings): Settings {
  const labels = { ...config.labels }
  labels.count = labels.visits = labels.comment_count
  labels.map = labels['comment-map']
  for (const key of ['map_summary_china', 'map_summary_world', 'ranking_top', 'map_no_record']) {
    labels[key] = labels[`comment_${key}`]
  }
  return { ...config, labels }
}
