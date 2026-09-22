import { selectFestival, type FestivalOptions, type Scene } from './calendar'
import { normalizeFestivalLabel } from './label'
import { enhanceSelect } from '../select-picker'

let dispose: (() => void) | undefined
const artworkCache = new Map<string, string>()

export function refreshFestival() {
  dispose?.()
  dispose = undefined
  const root = document.querySelector<HTMLElement>('.festival-decoration')
  if (!root) return
  let options: FestivalOptions
  let artwork: Record<string, string>
  try {
    options = JSON.parse(root.dataset.festival || '{}')
    artwork = JSON.parse(root.dataset.artwork || '{}')
  } catch { return }
  const baseOptions = options
  const host = root.querySelector<HTMLElement>('[data-festival-artwork]')
  const preview = document.querySelector<HTMLElement>('[data-festival-preview]')
  const select = preview?.querySelector<HTMLSelectElement>('[data-festival-select]')
  const status = preview?.querySelector<HTMLElement>('[data-festival-status]')
  const reset = preview?.querySelector<HTMLButtonElement>('[data-festival-reset]')
  const labelInput = preview?.querySelector<HTMLInputElement>('[data-festival-label-input]')
  // Preview edits belong to this page, never the persistent decoration config.
  const captionDrafts = new Map<string, string>()
  const springCharacters = () => {
    const item = baseOptions.table?.items?.spring
    const chars = Array.from(normalizeFestivalLabel(item?.label))
    return [item?.word1 ?? chars[0] ?? '', item?.word2 ?? chars[1] ?? '']
      .map(word => Array.from(normalizeFestivalLabel(word))[0] || '')
  }
  const configuredCaption = (scene: string) => {
    const item = baseOptions.table?.items?.[scene as Scene]
    return scene === 'spring' ? springCharacters().join('') : normalizeFestivalLabel(item?.label)
  }
  const captionFor = (scene: string) => captionDrafts.get(scene) ?? configuredCaption(scene)
  const paintCaption = (scene: string) => {
    const caption = captionFor(scene)
    host?.querySelectorAll<SVGTextElement>('[data-festival-label]').forEach(text => { text.textContent = caption })
    if (scene === 'spring') {
      const chars = captionDrafts.has(scene) ? Array.from(caption) : springCharacters()
      root.querySelectorAll<HTMLElement>('[data-festival-character]').forEach(text => {
        text.textContent = chars[Number(text.dataset.festivalCharacter)] || ''
      })
    }
  }
  const syncCaption = (scene: string) => {
    paintCaption(scene)
    if (!labelInput) return
    labelInput.disabled = scene === 'none' || scene === 'daily'
    labelInput.value = labelInput.disabled ? '' : captionFor(scene)
  }
  let labels: Record<string, string> = {}
  try { labels = JSON.parse(preview?.dataset.labels || '{}') } catch { /* Labels are optional. */ }
  const sceneLabel = (scene: string) => [...(select?.options || [])].find(option => option.value === scene)?.textContent || scene
  const report = (scene: string, phase = 'ready') => {
    if (!status || !select) return
    const prefix = phase === 'loading' ? labels.loading : phase === 'failed' ? labels.failed :
      select.value === 'auto' ? labels.auto : labels.selected
    status.textContent = `${prefix || ''} ${sceneLabel(scene)}`.trim()
  }
  if (select) {
    const requestedScene = new URL(location.href).searchParams.get('scene')
    select.value = [...select.options].some(option => option.value === requestedScene) ? requestedScene! : 'auto'
  }
  const picker = select ? enhanceSelect(select, { variant: 'festival' }) : undefined
  const applyPreview = () => {
    const scene = select?.value || 'auto'
    options = scene === 'auto' ? baseOptions : {
      ...baseOptions, enable: true, mobile: true, theme: scene,
      table: { ...baseOptions.table, items: Object.fromEntries(Object.entries(baseOptions.table?.items || {})
        .map(([name, item]) => [name, { ...item, enable: true }])) }
    }
    root.dataset.mobile = String(!!options.mobile)
    preview?.querySelectorAll<HTMLButtonElement>('[data-preview-scene]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.previewScene === scene))
    })
  }
  applyPreview()
  const desktop = matchMedia('(min-width: 992px)')
  let request: AbortController | undefined
  let requested = ''
  let disposed = false
  const show = (scene: string, svg?: SVGSVGElement) => {
    root.dataset.scene = scene
    if (host) {
      host.replaceChildren(...(svg ? [svg] : []))
      host.hidden = !svg
    }
    root.querySelectorAll<HTMLElement>('[data-festival-scene]').forEach(element => {
      element.hidden = element.dataset.festivalScene !== scene
      if (!element.hidden) element.querySelectorAll<HTMLImageElement>('img[data-src]').forEach(img => {
        img.src = img.dataset.src
        delete img.dataset.src
      })
    })
    syncCaption(scene)
    report(scene)
  }
  const update = async () => {
    const scene = desktop.matches || options.mobile ? selectFestival(options) : 'none'
    if (scene === requested) return
    requested = scene
    request?.abort()
    request = undefined
    if (scene === 'none' || scene === 'spring' || scene === 'daily') {
      show(scene)
      return
    }
    const url = artwork[scene]
    if (!host || !url) {
      const fallback = options.table?.items?.daily?.enable === false ? 'none' : 'daily'
      show(fallback)
      report(fallback, 'failed')
      return
    }
    // Remove the previous holiday while the selected scene is loading.
    show('none')
    report(scene, 'loading')
    const controller = new AbortController()
    request = controller
    try {
      let source = artworkCache.get(url)
      if (!source) {
        const response = await fetch(url, { signal: controller.signal })
        if (!response.ok) throw new Error(`Festival artwork: ${response.status}`)
        source = await response.text()
      }
      if (disposed || controller.signal.aborted || requested !== scene) return
      const parsed = new DOMParser().parseFromString(source, 'image/svg+xml')
      if (parsed.querySelector('parsererror') || parsed.documentElement.localName !== 'svg') {
        throw new Error('Invalid festival SVG')
      }
      artworkCache.set(url, source)
      show(scene, document.importNode(parsed.documentElement, true) as unknown as SVGSVGElement)
    } catch {
      if (disposed || controller.signal.aborted || requested !== scene) return
      requested = '' // A temporary network failure can recover on the next update.
      const fallback = options.table?.items?.daily?.enable === false ? 'none' : 'daily'
      show(fallback)
      report(fallback, 'failed')
    }
  }
  const choose = () => {
    if (!select) return
    if (select.value === 'auto') captionDrafts.clear()
    applyPreview()
    picker?.sync()
    const url = new URL(location.href)
    if (select.value === 'auto') url.searchParams.delete('scene')
    else url.searchParams.set('scene', select.value)
    history.replaceState(history.state, '', url)
    requested = ''
    void update()
  }
  const restore = () => {
    captionDrafts.clear()
    if (select) { select.value = 'auto'; choose() }
  }
  const editCaption = (event: Event) => {
    if (!labelInput || labelInput.disabled || (event as InputEvent).isComposing) return
    const scene = root.dataset.scene || 'none'
    const caption = normalizeFestivalLabel(labelInput.value)
    labelInput.value = caption
    captionDrafts.set(scene, caption)
    paintCaption(scene)
  }
  const pickCard = (event: MouseEvent) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-preview-scene]')
    if (!button || !preview?.contains(button) || !select) return
    select.value = button.dataset.previewScene || 'auto'
    choose()
  }
  select?.addEventListener('change', choose)
  reset?.addEventListener('click', restore)
  preview?.addEventListener('click', pickCard)
  labelInput?.addEventListener('input', editCaption)
  labelInput?.addEventListener('compositionend', editCaption)
  update()
  const timer = setInterval(update, 60000)
  document.addEventListener('visibilitychange', update)
  desktop.addEventListener('change', update)
  dispose = () => {
    disposed = true
    request?.abort()
    clearInterval(timer)
    document.removeEventListener('visibilitychange', update)
    desktop.removeEventListener('change', update)
    select?.removeEventListener('change', choose)
    reset?.removeEventListener('click', restore)
    preview?.removeEventListener('click', pickCard)
    labelInput?.removeEventListener('input', editCaption)
    labelInput?.removeEventListener('compositionend', editCaption)
    picker?.destroy()
    root.dataset.mobile = String(!!baseOptions.mobile)
  }
}
