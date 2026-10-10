import { resourceURL } from '../../globals/resources'
import { fetchHitokoto } from '../../globals/hitokoto'
import { createLive2DTips, type TipRules } from './live2d-tips'
type WidgetWindow = Window & {
  initWidget?: (config: { waifuPath: string; cdnPath: string }) => void
  Asteroids?: new () => unknown
  ASTEROIDSPLAYERS?: unknown[]
}
let initialized = false
let loading: Promise<void> | undefined
let desired: boolean | undefined
let widgetTips: ReturnType<typeof createLive2DTips> | undefined
const loaded = new Map<string, Promise<void>>()

// Keep upstream unmodified; adapt theme-owned actions and the dynamic quote service.
function adaptWidget(onError: () => void, rules: TipRules, labels: Record<string, string>) {
  const widget = document.getElementById('waifu')!
  widget.classList.add('shokax-live2d')
  const tips = createLive2DTips(widget, rules)
  widgetTips = tips
  document.getElementById('waifu-toggle')?.remove()
  const icons: Record<string, string> = {
    hitokoto: 'comments', asteroids: 'paper-plane', 'switch-model': 'paw',
    'switch-texture': 'magic', photo: 'instagram', info: 'info-circle'
  }
  for (const [name, icon] of Object.entries(icons)) {
    const tool = document.getElementById(`waifu-tool-${name}`)
    if (tool) {
      tool.replaceChildren()
      tool.classList.add('ic', `i-${icon}`)
      tool.setAttribute('role', 'button')
      tool.tabIndex = 0
      tool.setAttribute('aria-label', labels[name] || name)
      if (name !== 'hitokoto') tool.title = labels[name] || name
      tool.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); tool.click() }
      })
    }
  }
  const toolbar = document.getElementById('waifu-tool')!
  document.getElementById('waifu-tool-quit')?.remove()
  // Move the original nodes so the upstream action listeners remain attached.
  for (const name of ['hitokoto', 'switch-model', 'switch-texture', 'photo', 'asteroids', 'info']) {
    const tool = document.getElementById(`waifu-tool-${name}`)
    if (tool) toolbar.append(tool)
  }
  let startingGame = false
  let quoteRequest: AbortController | undefined
  let lastQuote = ''
  const quoteTool = document.getElementById('waifu-tool-hitokoto')!
  const requestQuote = async (refresh = false) => {
    if (!refresh && quoteRequest) return
    if (!refresh && lastQuote) { tips.show('{text}', 10000, lastQuote); return }
    quoteRequest?.abort()
    const controller = new AbortController()
    quoteRequest = controller
    quoteTool.setAttribute('aria-busy', 'true')
    tips.show('{text}', 6500, labels.loading)
    const timeout = setTimeout(() => controller.abort(), 6000)
    try {
      const quote = await fetchHitokoto(controller.signal)
      if (quoteRequest !== controller || controller.signal.aborted) return
      lastQuote = quote
      if (quoteTool.matches(':hover, :focus')) tips.show('{text}', 10000, quote)
    } catch {
      if (quoteRequest === controller && quoteTool.matches(':hover, :focus')) {
        tips.show('{text}', lastQuote ? 10000 : 4000, lastQuote || labels.error)
      }
    } finally {
      clearTimeout(timeout)
      if (quoteRequest === controller) {
        quoteRequest = undefined
        quoteTool.removeAttribute('aria-busy')
      }
    }
  }
  const cancelQuote = () => {
    quoteRequest?.abort()
    quoteRequest = undefined
    quoteTool.removeAttribute('aria-busy')
  }
  quoteTool.addEventListener('pointerenter', () => { void requestQuote() })
  quoteTool.addEventListener('focus', () => { void requestQuote() })
  widget.addEventListener('click', async event => {
    const tool = event.target instanceof Element ? event.target.closest('#waifu-tool-asteroids, #waifu-tool-hitokoto') : null
    if (!tool) return
    event.stopImmediatePropagation()
    if (tool.id === 'waifu-tool-hitokoto') {
      await requestQuote(true)
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
  window.addEventListener('shokax:hide-live2d', () => { cancelQuote(); tips.clear() })
  document.addEventListener('pjax:send', cancelQuote)
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
  desired = true
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
          adaptWidget(() => { button.title = config.error! }, rules, JSON.parse(config.live2dLabels || '{}'))
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
    void update()
  }
  button.addEventListener('click', () => set(!desired))
  window.addEventListener('shokax:hide-live2d', () => set(false))
  void update()
}
