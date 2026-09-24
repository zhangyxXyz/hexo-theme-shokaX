import { CONFIG } from './globals/globalVars'
import { prepareMusic } from './components/music-source'
import { initMusicOverlay } from './components/music-overlay'
// nyx-player exports this CSS entry without a TypeScript declaration.
// @ts-expect-error side-effect-only CSS import
import 'nyx-player/style'

export const initAudioPlayer = function () {
  const host = document.getElementById('player')
  const play = document.getElementById('playBtn') as HTMLButtonElement
  const show = document.getElementById('showBtn') as HTMLButtonElement
  if (!host || !play || !show || host.dataset.initialized) return
  host.dataset.initialized = 'true'
  initMusicOverlay()
  const labels = host.dataset
  const showPlaybackError = (event: Event) => {
    const audio = event.target
    if (!(audio instanceof HTMLAudioElement) || !audio.closest('#MusicPlayerRoot')) return
    const panel = audio.closest('#MusicPlayerRoot')
    let message = panel.querySelector<HTMLElement>('.music-status')
    if (!message) {
      message = document.createElement('p')
      message.className = 'music-status'
      message.setAttribute('role', 'status')
      panel.appendChild(message)
    }
    message.textContent = labels.unavailable
    message.hidden = false
  }
  document.addEventListener('shokax:music-error', showPlaybackError)
  const clearPlaybackError = (event: Event) => {
    if (!(event.target instanceof HTMLAudioElement) || !event.target.closest('#MusicPlayerRoot')) return
    const message = document.querySelector<HTMLElement>('#MusicPlayerRoot .music-status')
    if (message) message.hidden = true
  }
  document.addEventListener('loadstart', clearPlaybackError, true)
  document.addEventListener('playing', clearPlaybackError, true)
  let ready = false
  let loading = false
  const sync = () => {
    play.setAttribute('aria-pressed', String(play.dataset.play === 'true'))
    show.setAttribute('aria-expanded', String(show.dataset.show === 'true'))
    for (const [button, label] of [[play, play.dataset.play === 'true' ? labels.pause : labels.play], [show, labels.show]] as const) {
      button.title = loading ? labels.loading : ready ? label : labels.error
      button.setAttribute('aria-label', button.title)
      button.setAttribute('aria-busy', String(loading))
      button.disabled = loading
    }
  }
  new MutationObserver(sync).observe(play, { attributes: true, attributeFilter: ['data-play'] })
  new MutationObserver(sync).observe(show, { attributes: true, attributeFilter: ['data-show'] })
  const load = async () => {
    if (loading || ready) return
    loading = true
    sync()
    try {
      const { urls } = await prepareMusic(CONFIG.audio ?? [], CONFIG.playerAPI, fetch, CONFIG.playerAPIKey)
      if (!urls.length) throw new Error('No music sources available')
      const { initPlayer } = await import('nyx-player')
      // Refresh expiring media URLs on each full page load.
      // Do not resume saved playback without a new user gesture.
      try { sessionStorage.removeItem('playing') } catch { /* Storage may be unavailable. */ }
      initPlayer('#player', '#showBtn', urls, '#playBtn', undefined, 'shokax')
      ready = true
    } catch (error) {
      console.warn('[ShokaX music]', error)
    } finally {
      loading = false
      sync()
    }
  }
  for (const button of [play, show]) {
    button.addEventListener('click', event => {
      if (!ready) { event.stopImmediatePropagation(); void load() }
    })
  }
  // Metadata loading must not delay navigation, comments or the page loader.
  void load()
}
