export const isLoopbackHostname = (hostname: string): boolean => {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
  return host === 'localhost' || host.endsWith('.localhost') || host === '::1' ||
    host === '0.0.0.0' || host === '::' || /^127\./.test(host) || /^::ffff:7f[\da-f]{2}:/.test(host)
}

export const isVisitorReadOnly = (hostname: string, canonical: string, configured = false): boolean => {
  try {
    return configured || isLoopbackHostname(hostname) || hostname.toLowerCase() !== new URL(canonical).hostname.toLowerCase()
  } catch { return true }
}

export async function walineVisits(context: {
  path: string; serverURL: string; readOnly: boolean; site: boolean; signal: AbortSignal
}): Promise<{ pageViews: number; siteVisitors: number }> {
  const { path, readOnly, site, signal } = context
  const base = new URL(context.serverURL)
  if (!['http:', 'https:'].includes(base.protocol)) throw new Error('Invalid Waline URL')
  base.pathname = base.pathname.replace(/\/$/, '').replace(/\/api$/, '') + '/api/article'
  base.search = ''; base.hash = ''
  const request = async (url: URL, init: RequestInit = {}) => {
    const response = await fetch(url, { ...init, signal, credentials: 'omit', cache: 'no-store' })
    if (!response.ok) throw new Error('Pageview request failed')
    const body = await response.json()
    if (body.errno) throw new Error('Pageview request failed')
    return body.data
  }
  const pageURL = new URL(base)
  pageURL.search = new URLSearchParams({ path, type: 'time' }).toString()
  const counts = readOnly ? await request(pageURL) : await request(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, type: 'time', action: 'inc' })
  })
  // Read the site total after the increment, so both figures include this visit.
  const siteURL = new URL(base)
  siteURL.search = 'site=1'
  const total = site ? await request(siteURL) : null
  return { pageViews: counts?.[0]?.time, siteVisitors: total?.pageViews ?? NaN }
}
