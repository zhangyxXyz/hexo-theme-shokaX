import { CONFIG } from '../globals/globalVars'
import { visitorProviders } from './visitors/providers'
import { isVisitorReadOnly } from './visitors/waline'

let active: AbortController | undefined
let previousPage: Element | null = null
let previousPath = ''

export const refreshVisitors = () => {
  const page = document.getElementById('main')
  const path = location.pathname
  // Repeated setup of the same DOM is not a new page visit.
  if (page === previousPage && path === previousPath) return
  previousPage = page
  previousPath = path
  active?.abort()
  active = new AbortController()
  const { signal } = active
  document.querySelectorAll('[data-visitor-page], [data-visitor-count]').forEach(el => {
    el.textContent = '—'
    el.removeAttribute('title')
    el.removeAttribute('aria-label')
  })
  document.querySelectorAll('[data-visitor-site]').forEach(el => { el.textContent = '' })
  if (!CONFIG.visitor?.enable) return
  const readOnly = isVisitorReadOnly(location.hostname, CONFIG.hostname, CONFIG.visitor.readOnly)
  if (CONFIG.visitor.type === 'busuanzi' && readOnly) return
  const provider = visitorProviders[CONFIG.visitor.type]
  if (!provider) return
  void provider({ path, signal, readOnly, serverURL: CONFIG.waline.serverURL, site: CONFIG.visitor.site }).then(counts => {
    if (!counts || signal.aborted || path !== location.pathname || page !== document.getElementById('main')) return
    for (const [selector, value] of [
      ['[data-visitor-page]', counts.pageViews],
      ['[data-visitor-site]', counts.siteVisitors]
    ] as const) {
      if (!Number.isSafeInteger(value) || value < 0) continue
      document.querySelectorAll(selector).forEach(el => { el.textContent = String(value) })
    }
  }).catch(() => { /* Leave placeholders; retry on the next navigation. */ })
}
