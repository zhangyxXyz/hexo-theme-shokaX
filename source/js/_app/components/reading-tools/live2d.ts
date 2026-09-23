import { resourceURL } from '../../globals/resources'
type WidgetWindow = Window & {
  initWidget?: (config: { waifuPath: string; cdnPath: string }) => void
  Asteroids?: new () => unknown
  ASTEROIDSPLAYERS?: unknown[]
}
const key = 'shokax.live2d.visible'
let initialized = false
let loading: Promise<void> | undefined
let desired: boolean | undefined
const loaded = new Map<string, Promise<void>>()

// Keep upstream unmodified: only adapt the two theme-owned actions.
function adaptWidget(onHide: () => void, onError: () => void) {
  const widget = document.getElementById('waifu')!
  widget.classList.add('shokax-live2d')
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
  widget.addEventListener('click', async event => {
    const tool = event.target instanceof Element ? event.target.closest('#waifu-tool-quit, #waifu-tool-asteroids') : null
    if (!tool) return
    event.stopImmediatePropagation()
    if (tool.id === 'waifu-tool-quit') { onHide(); return }
    if (startingGame) return
    startingGame = true
    try {
      const host = window as WidgetWindow
      if (host.Asteroids) (host.ASTEROIDSPLAYERS ??= []).push(new host.Asteroids())
      else await asset(resourceURL('js.live2d_game', 'https://fastly.jsdelivr.net/gh/stevenjoezhang/asteroids/asteroids.js'))
    } catch { onError() }
    finally { startingGame = false }
  }, true)
  let tipTimer: ReturnType<typeof setTimeout>
  window.addEventListener('mouseover', event => {
    const tag = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-waifu-tag-message]') : null
    if (!tag || (event.relatedTarget instanceof Node && tag.contains(event.relatedTarget))) return
    const tips = document.getElementById('waifu-tips')!
    tips.textContent = tag.dataset.waifuTagMessage || ''
    tips.classList.add('waifu-tips-active')
    clearTimeout(tipTimer)
    tipTimer = setTimeout(() => tips.classList.remove('waifu-tips-active'), 4000)
    event.stopImmediatePropagation()
  }, true)
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
  }
  const update = async () => {
    sync()
    if (!desired) return
    button.disabled = true
    try {
      if (!loading) loading = (async () => {
        const base = resourceURL('assets.live2d_widget', config.live2dBase!).replace(/\/?$/, '/')
        await asset(base + 'waifu.css', true)
        await asset(base + 'live2d.min.js')
        await asset(base + 'waifu-tips.js')
        if (!document.getElementById('waifu')) {
          localStorage.removeItem('waifu-display')
          const init = (window as WidgetWindow).initWidget
          if (!init) throw new Error('Live2D initWidget unavailable')
          init({ waifuPath: base + 'waifu-tips.json', cdnPath: resourceURL('assets.live2d_models', config.live2dCdn!) })
          adaptWidget(() => window.dispatchEvent(new Event('shokax:hide-live2d')), () => { button.title = config.error! })
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
