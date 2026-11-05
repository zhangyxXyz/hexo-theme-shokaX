/**
 * Renders ```mermaid placeholders once they near the viewport and turns each
 * diagram into a pannable, zoomable canvas. The source stays in the page, so
 * failures fall back to readable text.
 */
import { CONFIG } from '../globals/globalVars'
import { resourceURL } from '../globals/resources'
import { openFullscreen, setFullscreenButton } from './fullscreen-dialog'

const MIN_SCALE = 0.25
const MAX_SCALE = 4
const STEP = 1.25
const PAD = 24
const INLINE_MIN = 180
const INLINE_MAX = 560

let dispose: (() => void) | undefined
let library: Promise<any> | undefined
let rough: Promise<any> | undefined
let sequence = 0

document.addEventListener('pjax:send', () => {
  dispose?.()
  dispose = undefined
})

const load = () => library ??= import(/* @vite-ignore */ resourceURL('js.mermaid'))
  .then(module => module.default)
  .catch(error => { library = undefined; throw error })

// Diagram kinds Mermaid can draw with `look: 'handDrawn'` itself; the rest are sketched by svg2roughjs.
const NATIVE_HAND_DRAWN = new Set(['flowchart', 'state', 'class', 'er'])
const handDrawn = () => CONFIG.mermaid?.look === 'handDrawn'

const loadRough = () => rough ??= new Promise<any>((resolve, reject) => {
  const node = document.createElement('script')
  const fail = () => { clearTimeout(timer); node.remove(); rough = undefined; reject(new Error('svg2roughjs unavailable')) }
  const timer = window.setTimeout(fail, 15000)
  node.src = resourceURL('js.svg2roughjs')
  node.onload = () => {
    clearTimeout(timer)
    const module = (window as any).svg2roughjs
    if (module?.Svg2Roughjs) resolve(module)
    else fail()
  }
  node.onerror = fail
  document.head.append(node)
})

const stylesheets = new Map<string, Promise<void>>()

const loadStylesheet = (name: string) => {
  const href = resourceURL(name)
  if (!href) return Promise.reject(new Error(`${name} unconfigured`))
  if (!stylesheets.has(href)) {
    stylesheets.set(href, new Promise<void>((resolve, reject) => {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = href
      link.onload = () => resolve()
      link.onerror = () => { link.remove(); stylesheets.delete(href); reject(new Error(`${href} unavailable`)) }
      document.head.append(link)
    }))
  }
  return stylesheets.get(href)!
}

/**
 * Mermaid measures labels while laying out, so the hand-drawn faces must be ready first.
 * Families fall back in their configured order, then to the article font.
 */
const handDrawnFont = async (text: string, fallback: string) => {
  const families = (CONFIG.mermaid?.fontFamily || '').split(',')
    .map(family => family.trim().replace(/^(['"])(.*)\1$/, '$2')).filter(Boolean)
  if (!families.length) return fallback
  if (resourceURL('fonts.hand_drawn')) await loadStylesheet('fonts.hand_drawn').catch(() => {})
  await Promise.race([
    Promise.allSettled(families.map(family => document.fonts.load(`16px "${family}"`, text))),
    new Promise(resolve => setTimeout(resolve, 8000))
  ])
  return [...families.map(family => `"${family}"`), fallback].join(', ')
}

const seedOf = (text: string) => {
  let hash = 0
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) | 0
  return Math.abs(hash) || 1
}

/** Re-draws a classic Mermaid SVG with rough.js strokes; resolves to the original on failure. */
const sketch = async (svg: string, source: string) => {
  let module: any
  try {
    module = await loadRough()
  } catch {
    return svg
  }
  // svg2roughjs measures the source with getBBox(), so both SVGs must be laid out in the document.
  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none'
  host.innerHTML = svg
  const output = document.createElement('div')
  host.append(output)
  document.body.append(host)
  try {
    const element = host.querySelector('svg')!
    const box = element.viewBox?.baseVal
    if (box?.width && box.height) {
      element.removeAttribute('style')
      element.setAttribute('width', String(box.width))
      element.setAttribute('height', String(box.height))
    }
    const converter = new module.Svg2Roughjs(output, module.OutputType?.SVG, { roughness: 1, bowing: 1, fillStyle: 'hachure', fillWeight: 1, hachureGap: 6 })
    converter.svg = element
    converter.fontFamily = null
    converter.randomize = false
    converter.seed = seedOf(source)
    converter.backgroundColor = 'transparent'
    const result = await converter.sketch()
    const sketched = result instanceof SVGSVGElement ? result : output.querySelector('svg')
    if (!sketched) return svg
    if (!sketched.getAttribute('viewBox') && box?.width) sketched.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`)
    return sketched.outerHTML
  } catch {
    return svg
  } finally {
    host.remove()
  }
}

const dark = () => document.documentElement.getAttribute('data-theme') === 'dark'
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

// Mermaid's colour parser only understands plain hex/rgb, so theme values (which may be
// color-mix() or CSS Color 4 output) are painted on a 1px canvas and read back as hex.
const resolveColors = (values: Record<string, string>) => {
  const probe = document.createElement('span')
  probe.style.display = 'none'
  document.body.append(probe)
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    probe.style.color = value
    const color = getComputedStyle(probe).color
    if (!context) { result[key] = color; continue }
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data
    result[key] = '#' + [r, g, b].map(part => part.toString(16).padStart(2, '0')).join('')
  }
  probe.remove()
  return result
}

// Diagrams stay monochrome: every shade is the text colour mixed into the page background.
const INK = 'var(--text-color)'
const mix = (color: string, amount: number) => `color-mix(in srgb, ${color} ${amount}%, var(--grey-0))`

const themeVariables = () => ({
  darkMode: dark(),
  fontSize: '14px',
  ...resolveColors({
    background: 'var(--grey-0)',
    primaryColor: mix(INK, 6),
    primaryBorderColor: mix(INK, 55),
    primaryTextColor: INK,
    secondaryColor: mix(INK, 11),
    secondaryBorderColor: mix(INK, 45),
    secondaryTextColor: INK,
    tertiaryColor: mix(INK, 3),
    tertiaryBorderColor: mix(INK, 30),
    tertiaryTextColor: INK,
    lineColor: mix(INK, 65),
    textColor: INK,
    edgeLabelBackground: 'var(--grey-1)',
    clusterBkg: mix(INK, 3),
    clusterBorder: mix(INK, 25),
    noteBkgColor: mix(INK, 9),
    noteBorderColor: mix(INK, 40),
    noteTextColor: INK
  })
})

interface Viewer {
  mount(svg: string): void
  dispose(): void
}

const createViewer = (figure: HTMLElement): Viewer => {
  const controller = new AbortController()
  const { signal } = controller
  const canvas = figure.querySelector<HTMLElement>('.md-mermaid-canvas')!
  const stage = figure.querySelector<HTMLElement>('.md-mermaid-stage')!
  const zoomText = figure.querySelector<HTMLOutputElement>('.md-mermaid-zoom')
  const action = (name: string) => figure.querySelector<HTMLButtonElement>(`[data-mermaid-action="${name}"]`)
  const zoomIn = action('in')
  const zoomOut = action('out')
  const fullscreen = action('fullscreen')
  let width = 0
  let height = 0
  let scale = 1
  let x = 0
  let y = 0
  let auto = true
  let lastWidth = 0
  let closeDialog: (() => void) | undefined

  const fitScale = () => Math.min(1, (canvas.clientWidth - PAD * 2) / width, (canvas.clientHeight - PAD * 2) / height)

  const apply = () => {
    stage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
    if (zoomText) zoomText.value = `${Math.round(scale * 100)}%`
    if (zoomIn) zoomIn.disabled = scale >= MAX_SCALE - 1e-3
    if (zoomOut) zoomOut.disabled = scale <= MIN_SCALE + 1e-3
    // Touch keeps scrolling the article until the diagram is zoomed past its fitted size.
    canvas.classList.toggle('is-zoomed', scale > fitScale() + 1e-3)
  }

  const fit = () => {
    if (!width || !height) return
    if (figure.closest('dialog')) {
      canvas.style.height = ''
    } else {
      const ratio = Math.min(1, (canvas.clientWidth - PAD * 2) / width)
      canvas.style.height = `${Math.round(clamp(height * ratio + PAD * 2, INLINE_MIN, INLINE_MAX))}px`
    }
    scale = clamp(fitScale(), MIN_SCALE, 1)
    x = (canvas.clientWidth - width * scale) / 2
    y = (canvas.clientHeight - height * scale) / 2
    auto = true
    apply()
  }

  const zoomAt = (factor: number, px = canvas.clientWidth / 2, py = canvas.clientHeight / 2) => {
    const next = clamp(scale * factor, MIN_SCALE, MAX_SCALE)
    if (next === scale) return
    x = px - (px - x) * next / scale
    y = py - (py - y) * next / scale
    scale = next
    auto = false
    apply()
  }

  const pan = (dx: number, dy: number) => {
    x += dx
    y += dy
    auto = false
    apply()
  }

  const toggleFullscreen = () => {
    if (closeDialog) { closeDialog(); return }
    closeDialog = openFullscreen(figure, 'md-mermaid-dialog', canvas.getAttribute('aria-label') || '', () => {
      closeDialog = undefined
      setFullscreenButton(fullscreen, false)
      fit()
    }, signal)
    setFullscreenButton(fullscreen, true)
    fit()
    canvas.focus({ preventScroll: true })
  }

  figure.querySelector('.md-mermaid-tools')?.addEventListener('click', event => {
    const name = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-mermaid-action]')?.dataset.mermaidAction
    if (name === 'in') zoomAt(STEP)
    else if (name === 'out') zoomAt(1 / STEP)
    else if (name === 'fit') fit()
    else if (name === 'fullscreen') toggleFullscreen()
  }, { signal })

  canvas.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const rect = canvas.getBoundingClientRect()
    zoomAt(Math.exp(-event.deltaY * 0.0025), event.clientX - rect.left, event.clientY - rect.top)
  }, { passive: false, signal })

  let drag: { id: number, x: number, y: number } | undefined
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !width) return
    if (event.pointerType === 'touch' && !canvas.classList.contains('is-zoomed')) return
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY }
    canvas.setPointerCapture(event.pointerId)
    canvas.classList.add('is-dragging')
  }, { signal })
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return
    pan(event.clientX - drag.x, event.clientY - drag.y)
    drag.x = event.clientX
    drag.y = event.clientY
  }, { signal })
  const endDrag = (event: PointerEvent) => {
    if (drag?.id !== event.pointerId) return
    drag = undefined
    canvas.classList.remove('is-dragging')
  }
  canvas.addEventListener('pointerup', endDrag, { signal })
  canvas.addEventListener('pointercancel', endDrag, { signal })

  canvas.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const moves: Record<string, [number, number]> = { ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48] }
    if (event.key === '+' || event.key === '=') zoomAt(STEP)
    else if (event.key === '-' || event.key === '_') zoomAt(1 / STEP)
    else if (event.key === '0') fit()
    else if (moves[event.key]) pan(...moves[event.key])
    else return
    event.preventDefault()
  }, { signal })

  const resize = new ResizeObserver(() => {
    if (canvas.clientWidth === lastWidth && !figure.closest('dialog')) return
    lastWidth = canvas.clientWidth
    if (auto) fit()
    else apply()
  })
  resize.observe(canvas)

  return {
    mount(svg) {
      stage.innerHTML = svg
      const element = stage.querySelector('svg')
      if (!element) return
      const box = element.viewBox?.baseVal
      width = box?.width || element.getBoundingClientRect().width
      height = box?.height || element.getBoundingClientRect().height
      element.removeAttribute('style')
      element.setAttribute('width', String(width))
      element.setAttribute('height', String(height))
      lastWidth = canvas.clientWidth
      fit()
    },
    dispose() {
      closeDialog?.()
      controller.abort()
      resize.disconnect()
    }
  }
}

export function refreshMermaid() {
  dispose?.()
  dispose = undefined
  const figures = Array.from(document.querySelectorAll<HTMLElement>('.md .md-mermaid'))
  if (!figures.length) return

  let disposed = false
  let queue = Promise.resolve()
  const sources = new Map(figures.map(figure => [figure, figure.querySelector('.md-mermaid-source')?.textContent || '']))
  const viewers = new Map<HTMLElement, Viewer>()
  const seen = new Set<HTMLElement>()

  const render = (batch: HTMLElement[]) => {
    const fail = (figure: HTMLElement, state: 'error' | 'unavailable', error: unknown) => {
      viewers.get(figure)?.dispose()
      viewers.delete(figure)
      figure.dataset.mermaidState = state
      console.warn('[mermaid]', error)
    }
    queue = queue.then(async () => {
      if (disposed) return
      let mermaid: any
      try {
        const articleFont = getComputedStyle(batch[0]).fontFamily
        const [module, fontFamily] = await Promise.all([
          load(),
          handDrawn() ? handDrawnFont(batch.map(figure => sources.get(figure)).join(''), articleFont) : articleFont
        ])
        mermaid = module
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          suppressErrorRendering: true,
          theme: 'base',
          themeVariables: { ...themeVariables(), fontFamily },
          fontFamily,
          look: handDrawn() ? 'handDrawn' : 'classic',
          handDrawnSeed: 1
        })
      } catch (error) {
        batch.forEach(figure => fail(figure, 'unavailable', error))
        return
      }
      for (const figure of batch) {
        if (disposed) return
        const source = sources.get(figure) || ''
        try {
          let { svg } = await mermaid.render(`md-mermaid-${++sequence}`, source)
          if (handDrawn() && !NATIVE_HAND_DRAWN.has(figure.dataset.mermaidKind || '')) svg = await sketch(svg, source)
          if (disposed) return
          let viewer = viewers.get(figure)
          if (!viewer) viewers.set(figure, viewer = createViewer(figure))
          figure.dataset.mermaidState = 'ready'
          viewer.mount(svg)
        } catch (error) {
          // A source that still parses failed for another reason, so it is not reported as a syntax error.
          const valid = await mermaid.parse(source, { suppressErrors: true }).catch(() => false)
          fail(figure, valid ? 'unavailable' : 'error', error)
        }
      }
    }).catch(error => {
      batch.forEach(figure => { if (figure.dataset.mermaidState !== 'ready') fail(figure, 'unavailable', error) })
    })
  }

  const observer = new IntersectionObserver(entries => {
    const batch = entries.filter(entry => entry.isIntersecting).map(entry => entry.target as HTMLElement)
    if (!batch.length) return
    batch.forEach(figure => { observer.unobserve(figure); seen.add(figure) })
    render(batch)
  }, { rootMargin: '200px 0px' })
  figures.forEach(figure => observer.observe(figure))

  // Mermaid bakes theme colours into the SVG, so a theme switch needs a fresh render.
  const themeObserver = new MutationObserver(() => { if (seen.size) render([...seen]) })
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  dispose = () => {
    disposed = true
    observer.disconnect()
    themeObserver.disconnect()
    viewers.forEach(viewer => viewer.dispose())
  }
}
