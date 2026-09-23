import { walineVisits } from './waline'

export interface VisitorCounts {
  pageViews: number
  siteVisitors: number
}

export interface VisitorContext {
  path: string
  signal: AbortSignal
  serverURL: string
  readOnly: boolean
  site: boolean
}

export type VisitorProvider = (context: VisitorContext) => Promise<VisitorCounts | null>

let sequence = 0

const busuanzi: VisitorProvider = ({ signal }) => new Promise((resolve, reject) => {
  if (signal.aborted) { resolve(null); return }
  const callback = `BusuanziCallback_shokax_${Date.now()}_${sequence++}`
  const callbacks = window as unknown as Record<string, (data: { page_pv: number; site_uv: number }) => void>
  const script = document.createElement('script')
  let settled = false
  const finish = (counts: VisitorCounts | null, error?: Error) => {
    if (settled) return
    settled = true
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
    script.remove()
    // A downloaded JSONP response may still execute after navigation.
    callbacks[callback] = () => {}
    setTimeout(() => { delete callbacks[callback] }, 60_000)
    if (error) reject(error)
    else resolve(counts)
  }
  const abort = () => finish(null)
  const timeout = setTimeout(() => finish(null, new Error('Visitor request timed out')), 10_000)
  callbacks[callback] = data => finish({ pageViews: data?.page_pv, siteVisitors: data?.site_uv })
  signal.addEventListener('abort', abort, { once: true })
  script.onerror = () => finish(null, new Error('Visitor request failed'))
  script.async = true
  // Busuanzi identifies the page through Referer, including after pushState.
  script.referrerPolicy = 'no-referrer-when-downgrade'
  script.src = `https://busuanzi.ibruce.info/busuanzi?jsonpCallback=${callback}`
  document.head.appendChild(script)
})

export const visitorProviders: Record<'busuanzi' | 'waline', VisitorProvider> = {
  busuanzi,
  waline: walineVisits
}
