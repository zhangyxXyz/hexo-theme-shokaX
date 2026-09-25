import { probe } from './service-status-probe.mjs'

type Service = { id: string; url: string; kind: string; contains?: string }
type Result = { id: string; state: string; reason: string; status?: number; latency: number; checkedAt: string }
let dispose: (() => void) | undefined

export function refreshServiceStatus() {
  dispose?.()
  dispose = undefined
  const root = document.querySelector<HTMLElement>('[data-service-status]')
  if (!root) return
  const config = JSON.parse(root.dataset.settings)
  const messages: Record<string, string> = JSON.parse(root.dataset.messages)
  const services: Service[] = config.groups.flatMap(group => group.services)
  const timeout = Math.max(1000, Math.min(15000, Number(config.timeout) || 8000))
  const staleAfter = Math.max(30000, Number(config.staleAfter) || 120000)
  const summary = root.querySelector<HTMLElement>('[data-status-summary]')!
  const mode = root.querySelector<HTMLElement>('[data-status-mode]')!
  const updated = root.querySelector<HTMLTimeElement>('[data-status-updated]')!
  const button = root.querySelector<HTMLButtonElement>('[data-status-refresh]')!
  const rows = new Map(Array.from(root.querySelectorAll<HTMLElement>('[data-status-id]')).map(row => [row.dataset.statusId, row]))
  const results = new Map<string, Result>()
  const life = new AbortController()
  let running = false
  let cooldown: ReturnType<typeof setTimeout> | undefined

  function render() {
    const counts = { up: 0, down: 0, unknown: 0, stale: 0 }
    for (const service of services) {
      const row = rows.get(service.id)!
      const result = results.get(service.id)
      const stale = result && Date.now() - Date.parse(result.checkedAt) > staleAfter
      const state = stale ? 'stale' : result?.state || (running ? 'checking' : 'unknown')
      if (state in counts) counts[state]++
      row.dataset.state = state
      row.querySelector('[data-status-state]')!.textContent = messages[state]
      row.querySelector('[data-status-latency]')!.textContent = result ? `${result.latency} ms` : '—'
      row.querySelector('[data-status-latency]')!.setAttribute('aria-label', `${messages.latency}: ${result ? result.latency + ' ms' : '—'}`)
      row.querySelector('[data-status-detail]')!.textContent = stale ? messages.stale : result
        ? (result.reason === 'http' ? `HTTP ${result.status}` : messages[result.reason] || messages.unknown) : ''
    }
    if (running || !services.length) summary.textContent = running ? messages.checking : messages.empty
    else {
      const fragment = document.createDocumentFragment()
      for (const [index, part] of messages.summary.split(' · ').entries()) {
        if (index) fragment.append(document.createTextNode(' · '))
        const state = part.match(/\{(up|down|unknown)\}/)?.[1] as 'up' | 'down' | 'unknown' | undefined
        const span = document.createElement('span')
        span.className = 'status-summary-part'
        if (state) span.dataset.state = state
        span.textContent = state ? part.replace(`{${state}}`, String(counts[state] + (state === 'unknown' ? counts.stale : 0))) : part
        fragment.append(span)
      }
      summary.replaceChildren(fragment)
    }
  }

  async function collect() {
    const response = await fetch(config.endpoint, { signal: AbortSignal.any([life.signal, AbortSignal.timeout(timeout + 2000)]), credentials: 'omit', cache: 'no-store' })
    if (!response.ok) throw new Error('collector')
    const payload = await response.json()
    const seen = new Set<string>()
    if (payload.version !== 1 || !Array.isArray(payload.results)) throw new Error('schema')
    for (const result of payload.results as Result[]) {
      if (!rows.has(result.id) || seen.has(result.id) || !['up', 'down', 'unknown'].includes(result.state)
        || !Number.isFinite(result.latency) || result.latency < 0 || !Number.isFinite(Date.parse(result.checkedAt))
        || Date.parse(result.checkedAt) > Date.now() + 30000) throw new Error('schema')
      seen.add(result.id)
    }
    if (seen.size !== services.length) throw new Error('incomplete')
    return payload.results as Result[]
  }

  async function run() {
    if (running || life.signal.aborted) return
    running = true
    button.disabled = true
    button.setAttribute('aria-busy', 'true')
    results.clear()
    updated.textContent = '—'
    updated.removeAttribute('datetime')
    render()
    try {
      let collected = false
      if (config.endpoint) {
        try {
          const batch = await collect()
          if (life.signal.aborted) return
          batch.forEach(result => results.set(result.id, result))
          mode.textContent = messages.server
          collected = true
        } catch {
          if (life.signal.aborted) return
          mode.textContent = messages.fallback
        }
      } else mode.textContent = messages.browser
      if (!collected) {
        // Shared URLs (cloud gateway / Meting) cause only one network request.
        const pending = new Map<string, Promise<Result>>()
        await Promise.all(services.map(async service => {
          const key = JSON.stringify([service.url, service.kind, service.contains])
          if (!pending.has(key)) pending.set(key, probe(service, { signal: life.signal, timeout }))
          const result = await pending.get(key)!
          if (life.signal.aborted) return
          results.set(service.id, { ...result, id: service.id })
          render()
        }))
      }
      if (!life.signal.aborted && results.size) {
        const date = new Date(Math.min(...Array.from(results.values()).map(result => Date.parse(result.checkedAt))))
        updated.dateTime = date.toISOString()
        updated.textContent = date.toLocaleString(document.documentElement.lang || undefined)
      }
    } catch { /* Navigation aborts all in-flight reads. */ }
    finally {
      running = false
      if (!life.signal.aborted) {
        button.removeAttribute('aria-busy')
        render()
        cooldown = setTimeout(() => { button.disabled = false }, 5000)
      }
    }
  }
  const onRefresh = () => { if (!button.disabled) void run() }
  button.addEventListener('click', onRefresh)
  const interval = setInterval(render, 10000)
  const cleanup = () => {
    life.abort()
    button.removeAttribute('aria-busy')
    clearInterval(interval)
    clearTimeout(cooldown)
    button.removeEventListener('click', onRefresh)
    document.removeEventListener('pjax:send', cleanup)
  }
  document.addEventListener('pjax:send', cleanup, { once: true })
  dispose = cleanup
  void run()
}
