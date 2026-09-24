import { resourceURL } from '../../globals/resources'
import { fetchHitokoto } from '../../globals/hitokoto'
import { createLive2DTips, type TipRules } from './live2d-tips'
type WidgetWindow = Window & {
  initWidget?: (config: { waifuPath: string; cdnPath: string }) => void
  Asteroids?: new () => unknown
  ASTEROIDSPLAYERS?: unknown[]
}
const key = 'shokax.live2d.visible'
let initialized = false
let loading: Promise<void> | undefined
let desired: boolean | undefined
let widgetTips: ReturnType<typeof createLive2DTips> | undefined
const loaded = new Map<string, Promise<void>>()

// Keep upstream unmodified; adapt theme-owned actions and the dynamic quote service.
function adaptWidget(onHide: () => void, onError: () => void, rules: TipRules) {
  const widget = document.getElementById('waifu')!
  widget.classList.add('shokax-live2d')
  const tips = createLive2DTips(widget, rules)
  widgetTips = tips
  document.getElementById('waifu-toggle')?.remove()
  const icons: Record<string, string> = {
    hitokoto: 'comments', asteroids: 'paper-plane', 'switch-model': 'paw',
    'switch-texture': 'magic', photo: 'instagram', info: 'info-circle', quit: 'times'
  }
  for (const [name, icon] of Object.entries(icons)) {
    const tool = document.getElementById(`waifu-tool-${name}`)
    if (tool) { tool.replaceChildren(); tool.classList.add('ic', `i-${icon}`) }
  }
  let startingGame = false
  let quoteRequest: AbortController | undefined
  widget.addEventListener('click', async event => {
    const tool = event.target instanceof Element ? event.target.closest('#waifu-tool-quit, #waifu-tool-asteroids, #waifu-tool-hitokoto') : null
    if (!tool) return
    event.stopImmediatePropagation()
    if (tool.id === 'waifu-tool-quit') { quoteRequest?.abort(); tips.clear(); onHide(); return }
    if (tool.id === 'waifu-tool-hitokoto') {
      quoteRequest?.abort()
      const controller = new AbortController()
      quoteRequest = controller
      const timeout = setTimeout(() => controller.abort(), 6000)
      try {
        const quote = await fetchHitokoto(controller.signal)
        if (quoteRequest !== controller) return
        tips.show('{text}', 6000, quote)
      } catch { if (quoteRequest === controller && !controller.signal.aborted) onError() }
      finally { clearTimeout(timeout); if (quoteRequest === controller) quoteRequest = undefined }
      return
    }
    if (startingGame) return
    startingGame = true
    try {
      const host = window as WidgetWindow
      if (host.Asteroids) (host.ASTEROIDSPLAYERS ??= []).push(new host.Asteroids())
      else await asset(resourceURL('js.live2d_game', 'https://cdn.jsdelivr.net/gh/stevenjoezhang/asteroids/asteroids.js'))
    } catch { onError() }
    finally { startingGame = false }
  }, true)
  window.addEventListener('shokax:hide-live2d', () => { quoteRequest?.abort(); tips.clear() })
  document.addEventListener('pjax:send', () => quoteRequest?.abort())
}

async function tipRules(url: string): Promise<TipRules> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6000)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error('Live2D tips unavailable')
    const data = await response.json()
    return data.interactions || {}
  } finally { clearTimeout(timeout) }
}

function asset(url: string, css = false) {
  if (!loaded.has(url)) loaded.set(url, new Promise<void>((resolve, reject) => {
    const el = css ? document.createElement('link') : document.createElement('script')
    if (el instanceof HTMLLinkElement) { el.rel = 'stylesheet'; el.href = url }
    else el.src = url
    el.onload = () => resolve()
    el.onerror = () => { el.remove(); loaded.delete(url); reject(new Error('Live2D resource unavailable')) }
    document.head.append(el)
  }))
  return loaded.get(url)!
}

export function refreshLive2D(button: HTMLButtonElement, config: DOMStringMap) {
  if (initialized) return
  initialized = true
  try { const saved = localStorage.getItem(key); desired = saved === null ? matchMedia('(min-width: 768px)').matches && !localStorage.getItem('waifu-display') : saved === 'true' }
  catch { desired = matchMedia('(min-width: 768px)').matches }
  const sync = () => {
    button.setAttribute('aria-pressed', String(desired))
    button.setAttribute('aria-label', desired ? config.hide! : config.show!)
    button.title = desired ? config.hide! : config.show!
    const widget = document.getElementById('waifu')
    if (widget) widget.style.display = desired ? '' : 'none'
    if (!desired) widgetTips?.clear()
  }
  const update = async () => {
    sync()
    if (!desired) return
    button.disabled = true
    try {
      if (!loading) loading = (async () => {
        const base = resourceURL('assets.live2d_widget', config.live2dBase!).replace(/\/?$/, '/')
        const rules = await tipRules(config.live2dTips!)
        await asset(base + 'waifu.css', true)
        await asset(base + 'live2d.min.js')
        await asset(base + 'waifu-tips.js')
        if (!document.getElementById('waifu')) {
          localStorage.removeItem('waifu-display')
          const init = (window as WidgetWindow).initWidget
          if (!init) throw new Error('Live2D initWidget unavailable')
          init({ waifuPath: config.live2dTips!, cdnPath: resourceURL('assets.live2d_models', config.live2dCdn!) })
          adaptWidget(() => window.dispatchEvent(new Event('shokax:hide-live2d')), () => { button.title = config.error! }, rules)
        }
      })().catch(error => { loading = undefined; throw error })
      await loading
      sync()
    } catch {
      desired = false
      sync()
      button.title = config.error!
    } finally { button.disabled = false }
  }
  const set = (visible: boolean) => {
    desired = visible
    try { localStorage.setItem(key, String(visible)) } catch { /* Storage is optional. */ }
    void update()
  }
  button.addEventListener('click', () => set(!desired))
  window.addEventListener('shokax:hide-live2d', () => set(false))
  void update()
}
