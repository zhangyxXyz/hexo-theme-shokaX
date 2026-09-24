import { loadMusicLyrics, type MusicSong } from './music-source'

export interface MusicPlaybackState {
  song?: MusicSong | null
  time: number
  playing: boolean
  panelOpen: boolean
  next?: () => void
  lyricsEnabled?: boolean
  closeLyrics?: () => void
}

const listeners = new Set<(state: MusicPlaybackState) => void>()
export function publishMusicState(state: MusicPlaybackState) {
  for (const listener of listeners) listener(state)
}
export function subscribeMusicState(listener: (state: MusicPlaybackState) => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function activateMusicTrack(state: {
  currentPlaylistIndex: number
  currentPlaylist?: { index: number } | null
  currentTime: number
  currentId: number
  restartId?: number
  setCurrentPlaylist(index: number): void
  start(): void
}, group: number, index: number) {
  if (state.currentPlaylistIndex !== group || state.currentPlaylist?.index !== index) {
    state.setCurrentPlaylist(group)
    if (state.currentPlaylist) state.currentPlaylist.index = index
  }
  state.currentTime = 0
  state.restartId = (state.restartId ?? 0) + 1
  state.start()
  state.currentId++
}

export function musicTrackHint() {
  return document.getElementById('player')?.dataset.activate ?? ''
}

export function parseMusicVolume(value: string | null) {
  if (value === null || value.trim() === '' || !Number.isFinite(Number(value))) return .6
  return Math.min(1, Math.max(0, Number(value)))
}
export function readMusicVolume() {
  try { return parseMusicVolume(localStorage.getItem('shokax.music.volume')) } catch { return .6 }
}
export function saveMusicVolume(volume: number) {
  try { localStorage.setItem('shokax.music.volume', String(volume)) } catch { /* Storage is optional. */ }
}
export function musicVolumeLabels() {
  const labels = document.getElementById('player')?.dataset
  return { volume: labels?.volume ?? '', mute: labels?.mute ?? '', unmute: labels?.unmute ?? '' }
}

export function musicLyricsLabels() {
  const labels = document.getElementById('player')?.dataset
  return { glyph: labels?.lyricsGlyph ?? '', enable: labels?.lyricsEnable ?? '', disable: labels?.lyricsDisable ?? '' }
}

// No separate timer: both lyric views follow the player's native media clock.
export function createMusicLyricView(
  render: (view: { text: string; nextText: string; line: number; track: number; visible: boolean }) => void,
  load = loadMusicLyrics
) {
  let state: MusicPlaybackState = { time: 0, playing: false, panelOpen: false }
  let rows: Awaited<ReturnType<typeof loadMusicLyrics>> = []
  let song: MusicSong | null | undefined
  let requested = false
  let revision = 0
  let destroyed = false
  const sync = () => {
    const line = rows.findIndex(row => state.time >= row.start && state.time < row.end)
    const text = rows[line]?.text ?? ''
    const nextText = line >= 0 ? rows[line + 1]?.text ?? '' : ''
    render({ text, nextText, line, track: revision, visible: state.lyricsEnabled !== false && state.playing && !state.panelOpen && !!text })
  }
  return {
    update(next: MusicPlaybackState) {
      if (destroyed) return
      state = next
      if (song !== state.song) {
        song = state.song
        rows = []
        requested = false
        revision++
      }
      sync()
      if (!requested && song?.lrc && (state.playing || state.panelOpen)) {
        requested = true
        const token = revision
        void load(song.lrc).then(result => {
          if (destroyed || token !== revision) return
          // LRC blank timestamps mark pauses, not missing/final lyrics. Keep
          // the current sentence through the gap and preview the next real one.
          rows = result.filter(row => row.text.trim()).map((row, index, visibleRows) => ({
            ...row, end: visibleRows[index + 1]?.start ?? Infinity
          }))
          sync()
        }).catch(() => { /* A lyric failure must never interrupt playback. */ })
      }
    },
    destroy() { destroyed = true; revision++ }
  }
}
