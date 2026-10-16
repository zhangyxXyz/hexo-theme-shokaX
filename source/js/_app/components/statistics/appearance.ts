import { getReadingPreferences, subscribeReadingPreferences, subscribeReducedMotion } from '../reading-preferences'

// Canvas colors must be repainted after CSS preferences settle. Batch theme and
// preference notifications together, and never redraw disposed PJAX charts.
export function watchStatisticsAppearance(render: () => void, signal: AbortSignal) {
  if (signal.aborted) return
  let frame: number | undefined
  let previous = getReadingPreferences()
  const schedule = () => {
    if (signal.aborted || frame !== undefined) return
    frame = requestAnimationFrame(() => {
      frame = undefined
      if (!signal.aborted) render()
    })
  }
  subscribeReadingPreferences(state => {
    if (state.primaryColor !== previous.primaryColor || state.secondaryColor !== previous.secondaryColor || state.motion !== previous.motion) schedule()
    previous = state
  }, { signal })
  subscribeReducedMotion(schedule, { signal })
  const theme = new MutationObserver(schedule)
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  signal.addEventListener('abort', () => {
    theme.disconnect()
    if (frame !== undefined) cancelAnimationFrame(frame)
  }, { once: true })
}
