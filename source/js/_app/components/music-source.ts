export interface MusicSong {
  name: string
  artist: string
  url: string
  pic: string
  lrc: string
}

const prepared = new Map<string, MusicSong[]>()
let nextRequestAt = 0
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export async function requestMusic(url: string, request: typeof fetch, apiKey: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    // Metadata plus CORS preflights share the server's per-IP rate limit.
    // Reserve starts across all groups and retries, even when cached calls are fast.
    const now = Date.now()
    const start = Math.max(now, nextRequestAt)
    nextRequestAt = start + 150
    await wait(start - now)
    let retryAfter = 0
    try {
      const response = await request(url, {
        signal: AbortSignal.timeout(15000),
        ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {})
      })
      if (response.status !== 429 || attempt >= 2) return response
      retryAfter = Number(response.headers.get('Retry-After')) * 1000 || 0
    } catch (error) {
      // A proxy-generated 429 without CORS headers surfaces as a network error.
      if (!(error instanceof TypeError) || attempt >= 2) throw error
    }
    await wait(Math.min(5000, Math.max(1000 * 2 ** attempt, retryAfter)))
  }
}

export function resetMusicSource(audio: HTMLAudioElement) {
  // A new song must not inherit the reused element's previous playhead.
  // load() also cancels requests/play promises belonging to the old source.
  try { audio.currentTime = 0 } catch { /* Metadata may not be ready yet. */ }
  audio.load()
}

export async function playMusic(audio: HTMLAudioElement, pause: () => void): Promise<void> {
  try { await audio.play() }
  catch (error) {
    // Changing tracks can abort a pending play; don't pause the new track.
    if (error instanceof DOMException && error.name === 'AbortError') return
    pause()
    audio.dispatchEvent(new Event('shokax:music-error', { bubbles: true }))
  }
}

export function parseMusicLyrics(raw: string): { start: number; end: number; text: string }[] {
  const rows = new Map<number, string[]>()
  const offset = Number(raw.match(/^\[offset:([+-]?\d+)\]/m)?.[1] ?? 0) / 1000
  for (const line of raw.split(/\r?\n/)) {
    const pattern = /\[(\d{1,3}):([0-5]\d)(?:\.(\d{1,3}))?\]/g
    const stamps = [...line.matchAll(pattern)]
    const text = line.replace(pattern, '').trim()
    for (const stamp of stamps) {
      const start = Math.max(0, Number(stamp[1]) * 60 + Number(stamp[2]) + Number('0.' + (stamp[3] ?? '0')) + offset)
      const parts = rows.get(start) ?? []
      if (text && !parts.includes(text)) parts.push(text)
      rows.set(start, parts)
    }
  }
  const sorted = [...rows].sort(([a], [b]) => a - b)
  return sorted.map(([start, texts], index) => ({ start, end: sorted[index + 1]?.[0] ?? Infinity, text: texts.join(' / ') }))
}

export async function fetchMusicLyric(url: string, request: typeof fetch = fetch): Promise<string> {
  if (!/^https?:\/\//.test(url)) return ''
  try {
    const response = await requestMusic(url, request, '')
    return response.ok ? await response.text() : ''
  } catch { return '' }
}

const lyricCache = new Map<string, Promise<ReturnType<typeof parseMusicLyrics>>>()
export function loadMusicLyrics(url: string): Promise<ReturnType<typeof parseMusicLyrics>> {
  let pending = lyricCache.get(url)
  if (!pending) {
    pending = fetchMusicLyric(url).then(parseMusicLyrics)
    lyricCache.set(url, pending)
    if (lyricCache.size > 20) lyricCache.delete(lyricCache.keys().next().value)
    void pending.then(rows => { if (!rows.length && lyricCache.get(url) === pending) lyricCache.delete(url) })
  }
  return pending
}

// Nyx accepts one URL per tab. Keep its UI, but resolve all configured sources
// before mounting so one failed source cannot break its async Vue component.
export function getPreparedPlaylist(key: string): MusicSong[] {
  return prepared.get(key) ?? []
}

export function parseMusicSource(source: string): { server: string; type: string; id: string } {
  const url = new URL(source)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported music URL protocol')
  const route = url.hash.startsWith('#/') ? new URL(url.hash.slice(1), url.origin) : url
  if (url.hostname === 'music.163.com') {
    const type = route.pathname === '/discover/toplist' ? 'playlist' : route.pathname.split('/').filter(Boolean).pop()
    const id = route.searchParams.get('id')
    if (['song', 'album', 'artist', 'playlist'].includes(type) && /^\d+$/.test(id ?? '')) {
      return { server: 'netease', type, id }
    }
  }
  if (url.hostname === 'y.qq.com') {
    const match = route.pathname.match(/\/(songDetail|song|albumDetail|album|singer|playsquare|playlist)\/(\w+)(?:\.html)?\/?$/)
    if (match) {
      const types = { songDetail: 'song', song: 'song', albumDetail: 'album', album: 'album', singer: 'artist', playsquare: 'playlist', playlist: 'playlist' }
      return { server: 'tencent', type: types[match[1]], id: match[2] }
    }
  }
  throw new Error(`Unsupported music URL: ${source}`)
}

export function musicApiUrl(api: string, source: string): string {
  const url = new URL(api)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('playerAPI must be an HTTP(S) URL')
  // Retain compatibility with the original theme's host-only setting.
  if (url.pathname === '/') url.pathname = '/meting/'
  const params = parseMusicSource(source)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  return url.href
}

export async function prepareMusic(
  groups: { title: string; list: string[] }[],
  api: string,
  request: typeof fetch = fetch,
  apiKey = ''
): Promise<{ urls: { name: string; url: string }[]; failed: string[] }> {
  const jobs = groups.flatMap((group, groupIndex) => group.list.map((source, sourceIndex) => ({ source, groupIndex, sourceIndex })))
  const results: MusicSong[][][] = groups.map(group => group.list.map(() => []))
  const failed: string[] = []
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    while (cursor < jobs.length) {
      const { source, groupIndex, sourceIndex } = jobs[cursor++]
      try {
        const response = await requestMusic(musicApiUrl(api, source), request, apiKey)
        if (!response.ok) throw new Error(`Music API returned HTTP ${response.status}`)
        const data: unknown = await response.json()
        if (!Array.isArray(data)) throw new Error('Music API must return a song array')
        const songs: MusicSong[] = data.flatMap(song => {
          if (!song || typeof song !== 'object') return []
          const name = song.title ?? song.name
          const artist = song.author ?? song.artist
          if (typeof name !== 'string' || typeof song.url !== 'string' || !/^https?:\/\//.test(song.url)) return []
          return [{ name, artist: typeof artist === 'string' ? artist : '', url: song.url,
            pic: typeof song.pic === 'string' ? song.pic : '', lrc: typeof song.lrc === 'string' ? song.lrc : '' }]
        })
        if (!songs.length) throw new Error('Music source returned no playable songs')
        results[groupIndex][sourceIndex] = songs
      } catch (error) {
        failed.push(source)
        console.warn('[ShokaX music]', source, error)
      }
    }
  }))
  const urls: { name: string; url: string }[] = []
  groups.forEach((group, index) => {
    const seen = new Set<string>()
    const songs = results[index].flat().filter(song => {
      if (seen.has(song.url)) return false
      seen.add(song.url)
      return true
    })
    if (!songs.length) return
    const key = JSON.stringify({ api, sources: group.list })
    prepared.set(key, songs)
    urls.push({ name: group.title, url: key })
  })
  return { urls, failed }
}
