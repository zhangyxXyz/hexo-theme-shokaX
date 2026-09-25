import { EmptyMusicSourceError, fetchMusicSongs, getPreparedPlaylist, parseMusicSource, type MusicSong } from './music-source'

export interface MusicRow extends MusicSong {
  key?: string
  status?: 'pending' | 'loading' | 'error'
  sourceKey?: string
}
interface Playlist {
  url: string
  playlist: MusicRow[]
  index: number
  lastIdx: number
}
interface Player {
  playlists: Playlist[]
  currentPlaylistIndex: number
  playing?: boolean
  currentTime?: number
  pendingTrack?: number
  currentSong?: MusicRow | null
}
const queues = new Map<string, ReturnType<typeof createMusicQueue>>()
let sequence = 0
let navigationSequence = 0
const players = new WeakMap<Playlist, Player>()

function isCollectionSource(source: string) {
  try { return ['playlist', 'album', 'artist'].includes(parseMusicSource(source).type) }
  catch { return false } // Invalid configuration is reported when requested.
}

export function createMusicQueue(
  groups: { title: string; list: string[] }[], api: string,
  labels: { pending?: string; loading: string; error: string }, request: typeof fetch = fetch, apiKey = ''
) {
  groups = groups.filter(group => group.list.length)
  const id = ++sequence
  const urls = groups.map((group, index) => ({ name: group.title, url: `shokax:queue:${id}:${index}` }))
  const listeners = new Set<() => void>()
  const jobs = groups.flatMap((group, groupIndex) => group.list.map((source, sourceIndex) => ({
    source, groupIndex, key: `${groupIndex}:${sourceIndex}`, status: 'pending' as 'pending' | 'loading' | 'error' | 'ready', songs: [] as MusicRow[], required: false,
    collection: isCollectionSource(source)
  })))
  const rows = new Map<string, MusicRow[]>()
  const notify = () => {
    urls.forEach(({ url }, groupIndex) => {
      const seen = new Set<string>()
      rows.set(url, jobs.filter(job => job.groupIndex === groupIndex).flatMap(job => {
        if (job.status !== 'ready') return [{ key: job.key, sourceKey: job.key, status: job.status,
          name: job.status === 'pending' ? labels.pending ?? labels.loading : labels[job.status], artist: '', url: '', pic: '', lrc: '' }]
        return job.songs.filter(song => {
          if (seen.has(song.url)) return false
          seen.add(song.url)
          return true
        })
      }))
    })
    listeners.forEach(listener => listener())
  }
  let running = 0, started = false
  const pending: typeof jobs = []
  let settled: (() => void)[] = []
  const pump = () => {
    if (!started) return
    while (running < 4 && pending.length) {
      const job = pending.shift()!
      running++
      void fetchMusicSongs(job.source, api, request, apiKey).then(songs => {
        job.songs = songs.map((song, index) => ({ ...song, key: `${job.key}:${index}`, sourceKey: job.key }))
        job.status = 'ready'
      }, error => {
        if (error instanceof EmptyMusicSourceError) {
          job.songs = []
          job.status = 'ready'
          return
        }
        job.status = 'error'
        console.warn('[ShokaX music]', job.source, error)
      }).finally(() => {
        running--
        notify()
        pump()
      })
    }
    if (!running && !pending.length) {
      const callbacks = settled; settled = []
      callbacks.forEach(resolve => resolve())
    }
  }
  const queue = {
    urls,
    rows: (url: string) => rows.get(url) ?? [],
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    start() {
      if (!started) { started = true; if (jobs[0]) queue.request(jobs[0].key, true); pump() }
    },
    request(key: string, required = false) {
      const job = jobs.find(job => job.key === key)
      if (!job) return
      job.required ||= required
      if (job.status !== 'pending') {
        const index = pending.indexOf(job)
        if (required && index > 0) { pending.splice(index, 1); pending.unshift(job) }
        return
      }
      job.status = 'loading'
      if (required) pending.unshift(job)
      else pending.push(job)
      notify()
      pump()
    },
    release(key: string) {
      // A collection changes the list's structure and numbering. Once it has
      // entered the queue, finish resolving it even if its slot scrolls away.
      const index = pending.findIndex(job => job.key === key && !job.required && !job.collection)
      if (index < 0) return
      const [job] = pending.splice(index, 1)
      job.status = 'pending'
      notify()
      pump()
    },
    retry(key: string) {
      const job = jobs.find(job => job.key === key)
      if (!job || job.status !== 'error') return
      job.status = 'loading'
      job.required = true
      pending.unshift(job)
      notify()
      pump()
    },
    resolve(key: string, timeout = 15000): Promise<'ready' | 'error' | 'timeout'> {
      const job = jobs.find(job => job.key === key)
      if (!job) return Promise.resolve('error')
      if (job.status === 'ready') return Promise.resolve('ready')
      return new Promise(resolve => {
        const finish = (status: 'ready' | 'error' | 'timeout') => {
          clearTimeout(timer)
          listeners.delete(check)
          resolve(status)
        }
        const check = () => { if (job.status === 'ready' || job.status === 'error') finish(job.status) }
        const timer = setTimeout(() => finish('timeout'), timeout)
        listeners.add(check)
        if (job.status === 'error') queue.retry(key)
        else queue.request(key, true)
      })
    },
    idle() { return !running && !pending.length ? Promise.resolve() : new Promise<void>(resolve => settled.push(resolve)) }
  }
  notify()
  urls.forEach(({ url }) => queues.set(url, queue))
  return queue
}

export function resolveMusicPlaylist(url: string): MusicRow[] {
  return queues.get(url)?.rows(url) ?? getPreparedPlaylist(url)
}

// Update reactive playlist objects in place. Capture selection before insertion
// and restore it by identity; batched Vue watchers then see the same song/URL.
export function bindMusicQueue(state: Player, beforeUpdate?: () => (() => void)) {
  const queue = state.playlists.map(list => queues.get(list.url)).find(Boolean)
  if (!queue) return () => {}
  const update = () => {
    const restore = beforeUpdate?.()
    try {
      const selected = state.currentSong
      state.playlists.forEach(list => {
        const selectedHere = list.playlist[list.index]
        const last = list.playlist[list.lastIdx]
        list.playlist = queue.rows(list.url)
        list.index = selectedHere ? list.playlist.findIndex(row => row.key === selectedHere.key || !!selectedHere.url && row.url === selectedHere.url) : -1
        list.lastIdx = last?.url ? list.playlist.findIndex(row => row.key === last.key || row.url === last.url) : -1
      })
      if (selected?.url || state.pendingTrack) return
      // Wait for preceding sources to settle, keeping the configured first song
      // as default. Explicitly choosing any ready row bypasses this wait.
      for (let group = 0; group < state.playlists.length; group++) {
        const list = state.playlists[group]
        for (let index = 0; index < list.playlist.length; index++) {
          const row = list.playlist[index]
          if (row.status === 'pending' || row.status === 'loading') {
            if (row.status === 'pending' && state.playing) queue.request(row.sourceKey!, true)
            return
          }
          if (row.url) { state.currentPlaylistIndex = group; list.index = index; return }
        }
      }
    } finally { if (restore) queueMicrotask(restore) }
  }
  state.playlists.forEach(list => { players.set(list, state); list.index = -1; list.lastIdx = -1 })
  update()
  return queue.subscribe(update)
}

export function activateMusicRow(state: { playlists: Playlist[] }, group: number, index: number) {
  const list = state.playlists[group], row = list?.playlist[index]
  if (row?.status === 'error') queues.get(list.url)?.retry(row.sourceKey!)
  return !!row?.url && !row.status
}

export function moveMusicTrack(list: Playlist, direction: 'next' | 'previous' | 'random') {
  const state = players.get(list)
  if (state && queues.has(list.url)) return navigateMusicTrack(state, list, direction)

  const available = list.playlist.map((row, index) => row.url && !row.status ? index : -1).filter(index => index >= 0)
  if (!available.length) return null
  list.lastIdx = list.index
  const position = available.indexOf(list.index)
  const next = direction === 'random' ? Math.floor(Math.random() * available.length)
    : direction === 'next' ? (position + 1) % available.length : (position < 0 ? available.length - 1 : (position - 1 + available.length) % available.length)
  list.index = available[next]
  return list.playlist[list.index]
}

export function requestMusicRow(playlistURL: string, sourceKey: string) {
  queues.get(playlistURL)?.request(sourceKey)
}

export function releaseMusicRow(playlistURL: string, sourceKey: string) {
  queues.get(playlistURL)?.release(sourceKey)
}

// Navigation is an explicit demand, independent of the panel's viewport. Keep
// a bounded itinerary so empty/error/timeout results cannot loop indefinitely.
export function navigateMusicTrack(state: Player, list: Playlist, direction: 'next' | 'previous' | 'random', timeout = 15000) {
  const queue = queues.get(list.url)
  if (!queue) return null
  const token = ++navigationSequence
  state.pendingTrack = token
  list.lastIdx = list.index
  const rows = list.playlist
  const candidates = Array.from({ length: rows.length }, (_, step) => {
    const offset = direction === 'previous' ? -step - 1 : step + 1
    return rows[(list.index + offset + rows.length * 2) % rows.length]
  })
  if (direction === 'random') {
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }
  }
  const select = (song: MusicRow) => {
    if (state.pendingTrack !== token) return null
    const index = list.playlist.findIndex(row => row.key === song.key)
    if (index < 0) return null
    state.currentPlaylistIndex = state.playlists.indexOf(list)
    list.index = index
    state.currentTime = 0
    state.pendingTrack = 0
    return list.playlist[index]
  }
  const fromSource = (source?: string) => {
    const songs = list.playlist.filter(row => row.sourceKey === source && row.url)
    return direction === 'previous' ? songs.at(-1)
      : direction === 'random' ? songs[Math.floor(Math.random() * songs.length)] : songs[0]
  }
  const next = (): MusicRow | null => {
    if (state.pendingTrack !== token) return null
    const candidate = candidates.shift()
    if (!candidate) {
      list.index = -1
      state.pendingTrack = 0
      state.playing = false
      state.currentTime = 0
      return null
    }
    const current = list.playlist.find(row => row.key === candidate.key)
    if (!current) {
      // A viewport request may have expanded this candidate while we waited
      // for an earlier source. Resolve its identity against the current list.
      const song = candidate.status && fromSource(candidate.sourceKey)
      return song ? select(song) : next()
    }
    if (current.url && !current.status) return select(current)
    const source = current.sourceKey!
    list.index = list.playlist.indexOf(current)
    state.currentTime = 0
    void queue.resolve(source, timeout).then(status => {
      if (state.pendingTrack !== token) return
      if (status === 'ready') {
        const song = fromSource(source)
        if (song) { select(song); return }
      }
      next()
    })
    return null
  }
  return next()
}
