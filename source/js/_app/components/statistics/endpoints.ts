import type { BaiduSettings } from './types'

const choices = new Map<string, string>()
const retryable = new Set(['network', 'timeout', 'temporary'])

// All charts in one page share the probe. A PJAX revisit reuses the session choice.
export function createEndpointRouter(settings: BaiduSettings, lifecycle: AbortSignal) {
  const endpoints = [...new Set(settings.endpoints?.length ? settings.endpoints : settings.api ? [settings.api] : [])]
  const key = `statistics:baidu:endpoint:${JSON.stringify(endpoints)}`
  let selected = choices.get(key)
  try { selected ??= sessionStorage.getItem(key) ?? undefined } catch { /* Storage may be disabled. */ }
  if (!endpoints.includes(selected ?? '')) selected = undefined
  let pending: Promise<string> | undefined

  function remember(endpoint: string) {
    selected = endpoint
    choices.set(key, endpoint)
    try { sessionStorage.setItem(key, endpoint) } catch { /* In-memory caching is sufficient. */ }
  }

  async function probe(): Promise<string> {
    if (!endpoints.length) throw new Error('unconfigured')
    if (endpoints.length === 1) return endpoints[0]
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3000)
    const signal = AbortSignal.any([lifecycle, controller.signal])
    try {
      const winner = await Promise.any(endpoints.map(async endpoint => {
        // /api -> /healthz; a reverse-proxy mount ending in / -> mount/healthz.
        const url = new URL('healthz', endpoint)
        const response = await fetch(url, { signal, credentials: 'omit', cache: 'no-store' })
        if (!response.ok || (await response.json()).status !== 'ok') throw new Error('network')
        return endpoint
      }))
      lifecycle.throwIfAborted()
      remember(winner)
      return winner
    } catch {
      lifecycle.throwIfAborted()
      // A blocked health check need not mean the report endpoint is unavailable.
      return endpoints[0]
    } finally {
      clearTimeout(timer)
      controller.abort()
    }
  }

  return async function route<T>(request: (endpoint: string) => Promise<T>, active: AbortSignal): Promise<T> {
    active.throwIfAborted()
    const first = selected ?? await (pending ??= probe().finally(() => { pending = undefined }))
    active.throwIfAborted()
    try {
      const result = await request(first)
      active.throwIfAborted()
      if (!selected || selected === first) remember(first)
      return result
    } catch (error) {
      active.throwIfAborted()
      if (!(error instanceof Error) || !retryable.has(error.message)) throw error
      if (selected === first) {
        selected = undefined
        choices.delete(key)
        try { sessionStorage.removeItem(key) } catch { /* Storage may be disabled. */ }
      }
      const alternative = selected ?? endpoints.find(endpoint => endpoint !== first)
      if (!alternative || alternative === first) throw error
      const result = await request(alternative)
      active.throwIfAborted()
      remember(alternative)
      return result
    }
  }
}
