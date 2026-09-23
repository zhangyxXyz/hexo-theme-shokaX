import { CONFIG } from './globalVars'

/** Shared dynamic service endpoint; deliberately separate from static vendors. */
export async function fetchHitokoto(signal: AbortSignal): Promise<string> {
  const response = await fetch(CONFIG.hitokoto?.api || 'https://v1.hitokoto.cn', { signal })
  if (!response.ok) throw new Error(`Hitokoto HTTP ${response.status}`)
  const data = await response.json()
  if (typeof data.hitokoto !== 'string' || !data.hitokoto.trim()) throw new Error('Invalid Hitokoto response')
  const author = typeof data.from_who === 'string' ? data.from_who.trim() : ''
  const source = typeof data.from === 'string' ? data.from.trim() : ''
  const attribution = `${author}${source ? `「${source}」` : ''}`
  return `${data.hitokoto}${attribution ? ` —— ${attribution}` : ''}`
}
