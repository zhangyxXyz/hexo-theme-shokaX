import { fetchHitokoto } from '../globals/hitokoto'

let pending: AbortController | undefined
let disposeTyping: (() => void) | undefined

function showQuote(element: HTMLElement, text: string) {
  disposeTyping?.()
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  element.textContent = text
  if (element.dataset.typewriter !== 'true' || !text || motion.matches) return

  // Keep a complete accessible label instead of announcing each keystroke.
  const accessible = document.createElement('span')
  accessible.className = 'quote-accessible'
  accessible.textContent = text
  const visual = document.createElement('span')
  visual.className = 'quote-typing'
  visual.setAttribute('aria-hidden', 'true')
  element.replaceChildren(accessible, visual)
  const characters = Array.from(text)
  let index = 0
  let deleting = false
  let timer = 0
  let stopped = false
  const stop = () => {
    stopped = true
    window.clearTimeout(timer)
    motion.removeEventListener('change', onMotion)
  }
  const onMotion = () => {
    if (motion.matches) {
      stop()
      element.textContent = text
    }
  }
  const tick = () => {
    if (stopped || !element.isConnected) { stop(); return }
    if (document.hidden) { timer = window.setTimeout(tick, 250); return }
    index += deleting ? -1 : 1
    visual.textContent = characters.slice(0, index).join('')
    let delay = deleting ? 40 : 100
    if (index === characters.length) { deleting = true; delay = 3000 }
    else if (index === 0) { deleting = false; delay = 500 }
    timer = window.setTimeout(tick, delay)
  }
  motion.addEventListener('change', onMotion)
  disposeTyping = stop
  timer = window.setTimeout(tick, 200)
}

export async function refreshHitokoto() {
  pending?.abort()
  pending = undefined
  disposeTyping?.()
  disposeTyping = undefined
  const element = document.querySelector<HTMLElement>('[data-quote]')
  if (!element) return
  const fallback = element.dataset.fallback || ''
  if (element.dataset.hitokoto !== 'true') {
    showQuote(element, fallback)
    return
  }
  const controller = new AbortController()
  pending = controller
  const timeout = window.setTimeout(() => controller.abort(), 6000)
  try {
    const quote = await fetchHitokoto(controller.signal)
    if (pending === controller && element.isConnected) {
      showQuote(element, quote)
    }
  } catch {
    if (pending === controller && element.isConnected) showQuote(element, fallback)
  } finally {
    window.clearTimeout(timeout)
    if (pending === controller) pending = undefined
  }
}
