import { selectFestival, type FestivalOptions } from './calendar'

let dispose: (() => void) | undefined

export function refreshFestival() {
  dispose?.()
  dispose = undefined
  const root = document.querySelector<HTMLElement>('.festival-decoration')
  if (!root) return
  let options: FestivalOptions
  try { options = JSON.parse(root.dataset.festival || '{}') } catch { return }
  const update = () => {
    const scene = selectFestival(options)
    root.dataset.scene = scene
    root.querySelectorAll<HTMLElement>('[data-festival-scene]').forEach(element => {
      element.hidden = element.dataset.festivalScene !== scene
      if (!element.hidden) element.querySelectorAll<HTMLImageElement>('img[data-src]').forEach(img => {
        img.src = img.dataset.src
        delete img.dataset.src
      })
    })
  }
  update()
  const timer = setInterval(update, 60000)
  document.addEventListener('visibilitychange', update)
  dispose = () => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', update)
  }
}
