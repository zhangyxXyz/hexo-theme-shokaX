// Shared by the browser and the optional Node collector. No credentials or writes.
export function validPayload(service, text) {
  if (service.kind === 'text') return Boolean(service.contains) && text.includes(service.contains)
  try {
    const data = JSON.parse(text)
    if (service.kind === 'health') return data?.status === 'ok'
    if (service.kind === 'meting') return Array.isArray(data) && data.length > 0 && data.every(track => {
      if (typeof track?.title !== 'string' || !track.title.trim() || typeof track.url !== 'string') return false
      try { return ['https:', 'http:'].includes(new URL(track.url).protocol) } catch { return false }
    })
    if (service.kind === 'hitokoto') return typeof data?.hitokoto === 'string' && Boolean(data.hitokoto.trim())
    if (service.kind === 'waline') return data?.errno === 0 && Array.isArray(data?.data?.data)
  } catch { /* An HTML error page is not a healthy API response. */ }
  return false
}

export async function probe(service, { signal, timeout = 8000, server = false, request = fetch } = {}) {
  const start = performance.now()
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  if (signal?.aborted) abort()
  const timer = setTimeout(abort, timeout)
  const result = (state, reason, status) => ({ id: service.id, state, reason, status,
    latency: Math.round(performance.now() - start), checkedAt: new Date().toISOString() })
  try {
    const response = await request(service.url, {
      signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error'
    })
    if (!response.ok) {
      await response.body?.cancel()
      return result([401, 403, 429].includes(response.status) ? 'unknown' : 'down', 'http', response.status)
    }
    // Bound memory and keep the timeout active until the complete body is read.
    const reader = response.body?.getReader()
    if (!reader) return result('unknown', 'invalid')
    const decoder = new TextDecoder()
    let text = '', size = 0
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > 512 * 1024) { await reader.cancel(); return result('unknown', 'oversize') }
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    return validPayload(service, text) ? result('up', 'ok') : result('down', 'invalid')
  } catch {
    if (signal?.aborted) throw signal.reason || new Error('Aborted')
    // Browsers cannot distinguish CORS, DNS, TLS, redirects and offline failures.
    return result(server ? 'down' : 'unknown', controller.signal.aborted ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}
