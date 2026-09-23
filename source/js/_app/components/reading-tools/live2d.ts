type WidgetWindow = Window & { loadWidget?: (config: { waifuPath: string; cdnPath: string }) => void }
const key = 'shokax.live2d.visible'
let initialized = false
let loading: Promise<void> | undefined
let desired: boolean | undefined
const loaded = new Map<string, Promise<void>>()

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
        const base = config.live2dBase!
        await asset(base + 'waifu.css', true)
        await asset(base + 'live2d.min.js')
        await asset(base + 'waifu-tips.js')
        if (!document.getElementById('waifu')) (window as WidgetWindow).loadWidget!({ waifuPath: base + 'waifu-tips.json', cdnPath: config.live2dCdn! })
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
