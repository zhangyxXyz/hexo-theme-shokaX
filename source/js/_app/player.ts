import { CONFIG } from './globals/globalVars'
import { initMusicQueueViewport } from './components/music-queue-view'
import { createMusicQueue } from './components/music-queue'
import { initMusicOverlay } from './components/music-overlay'
import { initMusicVisualizer } from './components/music-visualizer'
import { initMusicSeek } from './components/music-seek'
import { initMusicVolumeTooltip } from './components/music-volume-tooltip'
import { subscribeMusicState } from './components/music-state'
// nyx-player exports this CSS entry without a TypeScript declaration.
// @ts-expect-error side-effect-only CSS import
import 'nyx-player/style'

export const initAudioPlayer = function () {
  const host = document.getElementById('player')
  const play = document.getElementById('playBtn') as HTMLButtonElement
  const show = document.getElementById('showBtn') as HTMLButtonElement
  if (!host || !play || !show || host.dataset.initialized) return
  host.dataset.initialized = 'true'
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
  let ready = false, mounting = false, failed = false
  let desiredOpen = false, desiredPlay = false
  let shell: HTMLElement | undefined
  let queue: ReturnType<typeof createMusicQueue> | undefined
  const sync = () => {
    play.setAttribute('aria-pressed', String(ready ? play.dataset.play === 'true' : desiredPlay))
    show.setAttribute('aria-expanded', String(ready ? show.dataset.show === 'true' : desiredOpen))
    play.title = failed ? labels.error : (ready ? play.dataset.play === 'true' : desiredPlay) ? labels.pause : labels.play
    show.title = labels.show
    for (const button of [play, show]) {
      button.setAttribute('aria-label', button.title)
      button.setAttribute('aria-busy', String(mounting))
      button.disabled = false
    }
    if (shell) shell.hidden = !desiredOpen
  }
  new MutationObserver(sync).observe(play, { attributes: true, attributeFilter: ['data-play'] })
  new MutationObserver(sync).observe(show, { attributes: true, attributeFilter: ['data-show'] })
  const showShell = () => {
    if (shell) return
    shell = document.createElement('section')
    shell.className = 'music-loading-panel'
    shell.setAttribute('aria-label', labels.show)
    shell.setAttribute('aria-busy', 'true')
    const close = document.createElement('button')
    close.type = 'button'
    close.className = 'music-loading-close'
    close.setAttribute('aria-label', labels.close)
    close.textContent = '×'
    close.onclick = () => { desiredOpen = false; sync() }
    const title = document.createElement('p')
    title.setAttribute('role', 'status')
    title.textContent = labels.loading
    const list = document.createElement('div')
    list.className = 'music-loading-rows'
    for (let index = 0; index < 5; index++) list.append(document.createElement('span'))
    shell.append(close, title, list)
    document.body.append(shell)
  }
  const mount = async () => {
    if (mounting || ready) return
    mounting = true
    failed = false
    showShell()
    sync()
    try {
      queue ??= createMusicQueue(CONFIG.audio ?? [], CONFIG.playerAPI, { pending: labels.pending, loading: labels.loading, error: labels.error }, fetch, CONFIG.playerAPIKey)
      if (!queue.urls.length) throw new Error('No configured music sources')
      const { initPlayer } = await import('nyx-player')
      initMusicOverlay()
      initMusicVisualizer()
      initMusicSeek()
      initMusicVolumeTooltip()
      // Never restore stale signed URLs or start playback without user intent.
      try { sessionStorage.removeItem('playing') } catch { /* Storage may be unavailable. */ }
      await new Promise<void>((resolve, reject) => {
        const unsubscribe = subscribeMusicState(() => {
          unsubscribe()
          clearTimeout(timeout)
          resolve()
        })
        const timeout = window.setTimeout(() => { unsubscribe(); reject(new Error('Music player mount timed out')) }, 10000)
        try { initPlayer('#player', '#showBtn', queue.urls, '#playBtn', undefined, 'shokax') }
        catch (error) { unsubscribe(); clearTimeout(timeout); reject(error) }
      })
      ready = true
      shell?.remove()
      shell = undefined
    } catch (error) {
      failed = true
      const message = shell?.querySelector('[role="status"]')
      if (message) message.textContent = labels.error
      console.warn('[ShokaX music]', error)
    } finally {
      mounting = false
      sync()
    }
    if (ready) {
      if (desiredOpen) show.click()
      if (desiredPlay) play.click()
      queue.start()
      initMusicQueueViewport()
    }
  }
  for (const button of [play, show]) {
    button.addEventListener('click', event => {
      if (ready) return
      event.stopImmediatePropagation()
      if (button === show) desiredOpen = !desiredOpen
      else { desiredPlay = !desiredPlay; desiredOpen = true }
      sync()
      void mount()
    })
  }
  sync()
}
