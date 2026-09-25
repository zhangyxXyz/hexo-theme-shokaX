import { createMusicLyricView, subscribeMusicState } from './music-state'
import { tooltipPlainText } from './tooltip-content'
import { createMusicWidth } from './music-width'

export function initMusicOverlay() {
  if (document.getElementById('music-lyrics-overlay')) return
  const overlay = document.createElement('div')
  overlay.id = 'music-lyrics-overlay'
  overlay.setAttribute('aria-hidden', 'true')
  const disc = document.createElement('div')
  disc.className = 'music-lyrics-disc'
  const cover = document.createElement('img')
  cover.alt = ''
  cover.hidden = true
  cover.addEventListener('error', () => { cover.hidden = true })
  cover.addEventListener('load', () => { cover.hidden = false })
  disc.append(cover)
  const nextButton = document.createElement('button')
  nextButton.type = 'button'
  nextButton.className = 'music-lyrics-next'
  nextButton.title = document.getElementById('player')?.dataset.next ?? ''
  nextButton.setAttribute('aria-label', nextButton.title)
  const nextIcon = document.createElement('i')
  nextIcon.className = 'ic i-forward'
  nextIcon.setAttribute('aria-hidden', 'true')
  nextButton.append(nextIcon)
  let advance: (() => void) | undefined
  let close: (() => void) | undefined
  nextButton.addEventListener('click', () => advance?.())
  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'music-lyrics-close'
  closeButton.title = document.getElementById('player')?.dataset.lyricsClose ?? ''
  closeButton.setAttribute('aria-label', tooltipPlainText(closeButton.title))
  const closeIcon = document.createElement('i')
  closeIcon.className = 'ic i-chevrons-left'
  closeIcon.setAttribute('aria-hidden', 'true')
  closeButton.append(closeIcon)
  closeButton.addEventListener('click', () => close?.())
  let coverURL = ''
  const lines = document.createElement('div')
  lines.className = 'music-lyrics-lines'
  const makeLine = (text: string, next = false) => {
    const row = document.createElement('div')
    row.className = 'music-lyric-line' + (next ? ' is-next' : '')
    const label = document.createElement('span')
    label.textContent = text
    row.append(label)
    return row
  }
  let current = makeLine('')
  let upcoming = makeLine('', true)
  lines.append(current, upcoming)
  const controls = document.createElement('div')
  controls.className = 'music-lyrics-controls'
  controls.append(nextButton, closeButton)
  overlay.append(disc, lines, controls)
  document.body.append(overlay)
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let motions: Animation[] = []
  let previous = { line: -1, track: -1, visible: false }
  const width = createMusicWidth(value => { lines.style.width = `${value}px` })
  const resize = (animate = previous.visible) => {
    // Measure intrinsic layout only when content or viewport changes; restore
    // the current frame before paint so even an interrupted resize stays smooth.
    const rendered = lines.style.width
    lines.style.width = 'max-content'
    const target = lines.getBoundingClientRect().width
    lines.style.width = rendered
    width.set(target, animate && !document.hidden && !reducedMotion.matches)
  }
  const clearMotion = () => {
    for (const motion of motions) motion.cancel()
    motions = []
    lines.querySelectorAll('.is-leaving').forEach(row => row.remove())
  }
  const view = createMusicLyricView(({ text, nextText, line, track, visible }) => {
    const changed = previous.line !== line || previous.track !== track || current.textContent !== text || upcoming.textContent !== nextText
    overlay.classList.toggle('is-visible', visible)
    lines.classList.toggle('is-single', !nextText)
    overlay.setAttribute('aria-hidden', String(!visible))
    nextButton.tabIndex = visible ? 0 : -1
    closeButton.tabIndex = visible ? 0 : -1
    if (changed) {
      clearMotion()
      const animate = visible && previous.visible && previous.track === track && !reducedMotion.matches
      const promote = animate && line === previous.line + 1 && upcoming.textContent === text
      const rowHeight = current.getBoundingClientRect().height
      const oldLeft = upcoming.firstElementChild?.getBoundingClientRect().left ?? 0
      const leaving = current
      current = promote ? upcoming : makeLine(text)
      current.className = 'music-lyric-line'
      upcoming = makeLine(nextText, true)
      lines.replaceChildren(current, upcoming)
      resize(visible && previous.visible)
      const drift = promote ? oldLeft - (current.firstElementChild?.getBoundingClientRect().left ?? oldLeft) : 18
      if (animate) {
        leaving.className = 'music-lyric-line is-leaving'
        lines.append(leaving)
        const exit = leaving.animate([
          { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' },
          { opacity: 0, transform: 'translate(18px, 12px) scale(.96)', filter: 'blur(1px)' }
        ], { duration: 200, easing: 'ease-out', fill: 'both' })
        void exit.finished.then(() => leaving.remove()).catch(() => leaving.remove())
        motions = [exit,
          current.animate([{ transform: `translate(${drift}px, ${promote ? rowHeight : 10}px)`, opacity: promote ? 1 : 0 },
            { transform: 'translate(0, 0)', opacity: 1 }], { duration: 360, easing: 'cubic-bezier(.16, 1, .3, 1)' }),
          upcoming.animate([{ transform: 'translate(18px, 10px)', opacity: 0 }, { transform: 'translate(0, 0)', opacity: 1 }],
            { duration: 260, delay: 90, fill: 'backwards', easing: 'cubic-bezier(.16, 1, .3, 1)' })]
      }
    }
    if (!visible) { clearMotion(); width.finish() }
    previous = { line, track, visible }
  })
  // Like the player, this subscription lives for the document, across PJAX.
  subscribeMusicState(state => {
    advance = state.next
    close = state.closeLyrics
    nextButton.disabled = !advance
    overlay.classList.toggle('is-playing', state.playing)
    const pic = state.song?.pic ?? ''
    if (pic !== coverURL && (state.mediaRequested ?? state.playing)) {
      coverURL = pic
      cover.hidden = true
      if (pic) cover.src = pic
      else cover.removeAttribute('src')
    }
    view.update(state)
  })
  const syncVisibility = () => {
    overlay.classList.toggle('is-document-hidden', document.hidden)
    if (document.hidden) width.finish()
  }
  window.addEventListener('resize', () => resize())
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { clearMotion(); width.finish() } })
  void document.fonts.ready.then(() => resize())
  document.fonts.addEventListener('loadingdone', () => resize())
  document.addEventListener('visibilitychange', syncVisibility)
  syncVisibility()
}
