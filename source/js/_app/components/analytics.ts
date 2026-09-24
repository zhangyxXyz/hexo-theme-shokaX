import { CONFIG } from '../globals/globalVars'
import { isVisitorReadOnly } from './visitors/waline'

let lastPage: Element | null = null
let lastPath = ''

// hm.js counts the initial document. Only completed PJAX views use this API.
export function trackBaiduPageview() {
  if (!CONFIG.visitor?.baiduAnalytics || CONFIG.visitor.baiduSpa === 'auto' ||
      isVisitorReadOnly(location.hostname, CONFIG.hostname, CONFIG.visitor.readOnly)) return
  const page = document.getElementById('main')
  const path = location.pathname + location.search
  if (!page || (lastPage === page && lastPath === path)) return
  lastPage = page
  lastPath = path
  const target = window as Window & { _hmt?: { push(command: string[]): unknown } }
  target._hmt ??= []
  target._hmt.push(['_trackPageview', path])
}
