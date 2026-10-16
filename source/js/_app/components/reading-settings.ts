import { openedByPointer, restoreModalFocus } from './input-modality'
import { getReadingPreferences, setReadingPreferences, resetReadingPreferences, subscribeReadingPreferences, getReadingPalette, normalizeReadingColor, type ReadingPreferences } from './reading-preferences'
import { syncViewportState } from '../globals/handles'

type ReadingAnchor = { element: HTMLElement; fraction: number; viewportOffset: number }
let mounted: HTMLDialogElement | null = null
let cleanup: (() => void) | undefined

function captureReadingAnchor(): ReadingAnchor | undefined {
  const top = Math.min((document.getElementById('nav')?.getBoundingClientRect().height || 0) + 24, innerHeight / 3)
  const candidates = document.querySelectorAll<HTMLElement>('[data-reading-content] :is(p, li, h1, h2, h3, h4, h5, h6, pre, table), .index .segments > .item .info h3')
  for (const element of candidates) {
    if (element.closest('.article-info, .ai-summary, .tabs > .nav, #hexo-blog-encrypt:not(.hbe-decrypted-content)')) continue
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height || rect.bottom <= top || rect.top >= innerHeight) continue
    const viewportOffset = Math.max(top, rect.top)
    return { element, fraction: (viewportOffset - rect.top) / rect.height, viewportOffset }
  }
}

export function refreshReadingSettings(button: HTMLButtonElement) {
  const dialog = document.getElementById('reading-settings') as HTMLDialogElement | null
  if (!dialog || mounted === dialog) return
  cleanup?.()
  mounted = dialog
  const events = new AbortController()
  const options = { signal: events.signal }
  const status = dialog.querySelector<HTMLElement>('.reading-settings-status')!
  const inputs = Array.from(dialog.querySelectorAll<HTMLInputElement>('[data-reading-preference]'))
  const colors = Array.from(dialog.querySelectorAll<HTMLElement>('[data-reading-color]')).map(group => ({
    key: group.dataset.readingColor as 'primaryColor' | 'secondaryColor',
    picker: group.querySelector<HTMLInputElement>('[data-reading-color-picker]')!,
    text: group.querySelector<HTMLInputElement>('[data-reading-color-text]')!,
    apply: group.querySelector<HTMLButtonElement>('[data-reading-color-apply]')!,
    error: group.querySelector<HTMLElement>('.reading-settings-color-error')!
  }))
  const intensity = dialog.querySelector<HTMLInputElement>('[data-reading-texture-intensity]')!
  const intensityOutput = dialog.querySelector<HTMLOutputElement>('[data-reading-texture-output]')!
  let overflow: string | undefined
  let returnFocus: HTMLElement | null = null
  let pointerOpened = false
  let frame = 0

  const settleLayout = (anchor?: ReadingAnchor) => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = 0
      if (anchor?.element.isConnected) {
        const rect = anchor.element.getBoundingClientRect()
        window.scrollBy({ top: rect.top + rect.height * anchor.fraction - anchor.viewportOffset, behavior: 'instant' })
      }
      // Existing TOC observers respond to the layout; refresh progress and sticky controls too.
      syncViewportState()
    })
  }
  const clearColorError = (color: typeof colors[number]) => {
    color.text.setCustomValidity('')
    color.text.removeAttribute('aria-invalid')
    color.error.hidden = true
  }
  const discardColorDrafts = () => {
    colors.forEach(color => { delete color.text.dataset.draft; clearColorError(color) })
  }
  const syncPalette = () => {
    const palette = getReadingPalette()
    for (const color of colors) {
      const value = palette[color.key === 'primaryColor' ? 'primary' : 'secondary']
      color.picker.disabled = !value
      if (value) color.picker.value = value
      // Text is only a draft until Apply, Enter or blur; unrelated preferences
      // must not erase an in-progress edit or replace a failed value silently.
      if (color.text.dataset.draft !== 'true') {
        color.text.value = value || ''
        // Keep the next focus target available when blur has just applied a draft.
        color.apply.disabled = !value
        clearColorError(color)
      }
    }
  }
  const sync = () => {
    const preferences = getReadingPreferences()
    for (const input of inputs) {
      const key = input.dataset.readingPreference as keyof typeof preferences
      input.checked = input.value === String(preferences[key])
    }
    intensity.value = String(preferences.textureIntensity)
    intensity.disabled = preferences.texture === 'none'
    intensityOutput.value = `${preferences.textureIntensity}%`
    syncPalette()
  }
  const finishClose = (focus = true, keepPosition = true) => {
    if (overflow === undefined) return
    const anchor = keepPosition ? captureReadingAnchor() : undefined
    document.body.style.overflow = overflow
    overflow = undefined
    button.setAttribute('aria-expanded', 'false')
    if (focus) restoreModalFocus(returnFocus, pointerOpened)
    returnFocus = null
    if (keepPosition) settleLayout(anchor)
  }
  const close = (focus = true, keepPosition = true) => {
    dialog.close()
    finishClose(focus, keepPosition)
  }
  const title = document.getElementById('reading-settings-title')!.textContent || ''
  button.setAttribute('aria-label', title)
  button.title = title
  button.setAttribute('aria-controls', dialog.id)
  button.setAttribute('aria-haspopup', 'dialog')
  button.setAttribute('aria-expanded', 'false')
  button.addEventListener('click', () => {
    if (dialog.open) return
    const anchor = captureReadingAnchor()
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : button
    pointerOpened = openedByPointer()
    overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sync()
    dialog.showModal()
    dialog.focus({ preventScroll: true })
    button.setAttribute('aria-expanded', 'true')
    settleLayout(anchor)
  }, options)
  dialog.querySelectorAll('[data-reading-close]').forEach(control => control.addEventListener('click', () => close(), options))
  dialog.addEventListener('cancel', event => {
    if (event.target !== dialog) return
    event.preventDefault()
    close()
  }, options)
  dialog.addEventListener('close', () => { if (!dialog.open) finishClose() }, options)
  let backdrop = false
  const outside = (event: MouseEvent) => {
    const rect = dialog.getBoundingClientRect()
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  }
  dialog.addEventListener('pointerdown', event => { backdrop = outside(event) }, options)
  dialog.addEventListener('click', event => { if (backdrop && outside(event)) close(); backdrop = false }, options)
  const report = (saved: boolean, reset = false) => {
    status.textContent = (saved ? (reset ? dialog.dataset.restored : dialog.dataset.saved) : dialog.dataset.temporary) || ''
  }
  for (const color of colors) {
    const applyColor = () => {
      if (color.text.dataset.draft !== 'true') return
      const value = normalizeReadingColor(color.text.value)
      if (!value) {
        color.text.setCustomValidity(color.error.textContent || '')
        color.text.setAttribute('aria-invalid', 'true')
        color.error.hidden = false
        return
      }
      delete color.text.dataset.draft
      clearColorError(color)
      report(setReadingPreferences(color.key === 'primaryColor' ? { primaryColor: value } : { secondaryColor: value }))
    }
    color.text.addEventListener('input', () => {
      color.text.dataset.draft = 'true'
      color.apply.disabled = false
      clearColorError(color)
    }, options)
    color.text.addEventListener('blur', applyColor, options)
    color.text.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); applyColor() }
    }, options)
    color.apply.addEventListener('click', applyColor, options)
    color.picker.addEventListener('change', () => {
      color.text.value = color.picker.value
      color.text.dataset.draft = 'true'
      applyColor()
    }, options)
  }
  dialog.querySelector('[data-reading-palette-reset]')!.addEventListener('click', () => {
    discardColorDrafts()
    const saved = setReadingPreferences({ primaryColor: null, secondaryColor: null })
    status.textContent = (saved ? dialog.dataset.paletteRestored : dialog.dataset.temporary) || ''
  }, options)
  intensity.addEventListener('input', () => {
    report(setReadingPreferences({ textureIntensity: Number(intensity.value) }))
  }, options)
  dialog.addEventListener('change', event => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || !input.checked) return
    const key = input.dataset.readingPreference
    const value = input.value
    const anchor = captureReadingAnchor()
    let saved: boolean
    if (key === 'fontScale' && ['1', '1.125', '1.25'].includes(value)) {
      saved = setReadingPreferences({ fontScale: Number(value) as 1 | 1.125 | 1.25 })
    } else if (key === 'lineHeight' && (value === 'compact' || value === 'default' || value === 'relaxed')) {
      saved = setReadingPreferences({ lineHeight: value })
    } else if (key === 'theme' && (value === 'default' || value === 'system' || value === 'light' || value === 'dark')) {
      saved = setReadingPreferences({ theme: value })
    } else if (key === 'motion' && (value === 'system' || value === 'reduce')) {
      saved = setReadingPreferences({ motion: value })
    } else if (key === 'background') {
      saved = setReadingPreferences({ background: value as ReadingPreferences['background'] })
    } else if (key === 'texture') {
      saved = setReadingPreferences({ texture: value as ReadingPreferences['texture'] })
    } else if (key === 'homeLayout') {
      saved = setReadingPreferences({ homeLayout: value as ReadingPreferences['homeLayout'] })
    } else return
    report(saved)
    if (key === 'fontScale' || key === 'lineHeight' || key === 'background' || key === 'homeLayout') settleLayout(anchor)
  }, options)
  dialog.querySelector('[data-reading-reset]')!.addEventListener('click', () => {
    const anchor = captureReadingAnchor()
    discardColorDrafts()
    report(resetReadingPreferences(), true)
    settleLayout(anchor)
  }, options)
  subscribeReadingPreferences(sync, options)
  document.addEventListener('pjax:send', () => {
    close(false, false)
    cancelAnimationFrame(frame)
  }, options)
  // Decryption inserts article extras and prose after the initial page setup.
  window.addEventListener('hexo-blog-decrypt', () => settleLayout(), options)
  sync()
  cleanup = () => {
    close(false, false)
    events.abort()
    cancelAnimationFrame(frame)
    mounted = null
  }
}
