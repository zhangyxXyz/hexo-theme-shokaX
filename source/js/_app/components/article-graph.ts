import { loadGraphLibrary, drawArticleGraph, sizeGraphLabels } from './article-graph-render'
import { paginateGraphReferences } from './article-graph-references'

let disposeGraph: (() => void) | undefined
document.addEventListener('pjax:send', () => { disposeGraph?.(); disposeGraph = undefined })

export function refreshArticleGraph() {
  disposeGraph?.()
  disposeGraph = undefined
  const root = document.querySelector<HTMLElement>('[data-article-graph]')
  if (!root) return
  const svg = root.querySelector<SVGSVGElement>('[data-graph-svg]')
  const stage = root.querySelector<HTMLElement>('[data-graph-stage]')
  const dialog = root.querySelector<HTMLDialogElement>('[data-graph-dialog]')
  const figure = root.querySelector<HTMLDetailsElement>('[data-graph-figure]')
  if (!svg || !stage || !dialog || !figure) return
  const controller = new AbortController(), options = { signal: controller.signal }
  const disposeReferencePages = paginateGraphReferences(root, controller.signal)
  const references = root.querySelector<HTMLDetailsElement>('[data-graph-references]')
  const referenceToggle = references?.querySelector<HTMLElement>('summary')
  const referenceContent = references?.querySelector<HTMLElement>('.article-graph-reference-content')
  let referenceAnimation: Animation | undefined
  let referencesOpen = references?.open ?? false
  referenceToggle?.setAttribute('aria-expanded', String(referencesOpen))
  referenceToggle?.addEventListener('click', event => {
    event.preventDefault()
    const from = references.open ? referenceContent.getBoundingClientRect().height : 0
    referenceAnimation?.cancel()
    referencesOpen = !referencesOpen
    referenceToggle.setAttribute('aria-expanded', String(referencesOpen))
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      references.open = referencesOpen
      referenceContent.style.removeProperty('overflow')
      return
    }
    references.open = true
    referenceContent.style.overflow = 'hidden'
    const to = referencesOpen ? referenceContent.scrollHeight : 0
    referenceAnimation = referenceContent.animate([{ height: `${from}px`, opacity: from ? 1 : 0 },
      { height: `${to}px`, opacity: referencesOpen ? 1 : 0 }], { duration: 220, easing: 'ease-out' })
    referenceAnimation.onfinish = () => {
      references.open = referencesOpen
      referenceContent.style.removeProperty('overflow')
      referenceAnimation = undefined
    }
  }, options)
  const home = stage.parentNode, next = stage.nextSibling
  let original = svg.getAttribute('viewBox').split(/\s+/).map(Number)
  let view = [...original]
  let drag: { id: number; x: number; y: number; view: number[]; moved: boolean } | undefined
  let suppressClick = false, clickTimer: ReturnType<typeof setTimeout> | undefined
  const apply = () => { svg.setAttribute('viewBox', view.join(' ')); sizeGraphLabels(svg) }
  const labelResizeObserver = new ResizeObserver(() => sizeGraphLabels(svg))
  labelResizeObserver.observe(svg)
  const reset = () => { view = [...original]; apply() }
  const zoom = (factor: number) => {
    const width = Math.max(original[2] / 4, Math.min(original[2] * 2, view[2] * factor))
    const height = width / original[2] * original[3]
    view = [view[0] + (view[2] - width) / 2, view[1] + (view[3] - height) / 2, width, height]
    apply()
  }
  const controls = root.querySelector<HTMLElement>('[data-graph-controls]')
  if (matchMedia('(max-width: 600px)').matches) figure.open = false
  const loadButton = root.querySelector<HTMLButtonElement>('[data-graph-load]')
  let loaded = false, loading = false
  const load = async () => {
    if (loading || loaded || !figure.open) return
    loading = true
    loadButton.disabled = true
    loadButton.textContent = loadButton.dataset.loading
    try {
      const d3 = await loadGraphLibrary()
      if (controller.signal.aborted || !root.isConnected) return
      const payload = JSON.parse(root.querySelector('[data-graph-data]').textContent)
      svg.removeAttribute('hidden')
      original = drawArticleGraph(svg, payload, d3)
      reset()
      controls.hidden = false
      loadButton.hidden = true
      root.dataset.graphReady = 'true'
      loaded = true
      observer.disconnect()
    } catch {
      if (!controller.signal.aborted) loadButton.textContent = loadButton.dataset.retry
    } finally { loading = false; loadButton.disabled = false }
  }
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) void load()
  }, { rootMargin: '100px' })
  observer.observe(root)
  figure.addEventListener('toggle', () => {
    const box = root.getBoundingClientRect()
    if (figure.open && box.top < innerHeight + 100 && box.bottom > -100) void load()
  }, options)
  loadButton.addEventListener('click', () => void load(), options)
  const expand = root.querySelector<HTMLButtonElement>('[data-graph-expand]')
  const restoreStage = () => {
    home.insertBefore(stage, next)
    expand.hidden = false
    reset()
  }
  expand.addEventListener('click', () => {
    root.querySelector('[data-graph-dialog-body]').append(stage)
    expand.hidden = true
    dialog.showModal()
    reset()
    root.querySelector<HTMLButtonElement>('[data-graph-close]').focus()
  }, options)
  dialog.addEventListener('close', () => { restoreStage(); if (root.isConnected) expand.focus({ preventScroll: true }) }, options)
  root.querySelector('[data-graph-close]').addEventListener('click', () => dialog.close(), options)
  let backdrop = false
  dialog.addEventListener('pointerdown', event => { backdrop = event.target === dialog }, options)
  dialog.addEventListener('click', event => { if (backdrop && event.target === dialog) dialog.close(); backdrop = false }, options)
  root.querySelectorAll<HTMLButtonElement>('[data-graph-zoom]').forEach(button => {
    button.addEventListener('click', () => zoom(button.dataset.graphZoom === 'in' ? .8 : 1.25), options)
  })
  root.querySelector('[data-graph-reset]').addEventListener('click', reset, options)
  svg.addEventListener('wheel', event => {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    zoom(event.deltaY < 0 ? .9 : 1.1)
  }, { ...options, passive: false })
  svg.addEventListener('keydown', event => {
    if (event.target !== svg) return
    if (event.key === '+' || event.key === '=') zoom(.8)
    else if (event.key === '-') zoom(1.25)
    else if (event.key === '0' || event.key === 'Home') reset()
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      view[0] += event.key === 'ArrowLeft' ? -view[2] * .08 : event.key === 'ArrowRight' ? view[2] * .08 : 0
      view[1] += event.key === 'ArrowUp' ? -view[3] * .08 : event.key === 'ArrowDown' ? view[3] * .08 : 0
      apply()
    } else return
    event.preventDefault()
  }, options)
  svg.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary || (event.pointerType === 'touch' && !dialog.open)) return
    clearTimeout(clickTimer)
    suppressClick = false
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, view: [...view], moved: false }
  }, options)
  svg.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y
    if (!drag.moved && Math.hypot(dx, dy) < 4) return
    drag.moved = true
    svg.setPointerCapture(event.pointerId)
    const matrix = svg.getScreenCTM()
    if (!matrix) return
    view = [drag.view[0] - dx / matrix.a, drag.view[1] - dy / matrix.d, drag.view[2], drag.view[3]]
    apply()
  }, options)
  const endDrag = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return
    suppressClick = drag.moved
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId)
    drag = undefined
    clickTimer = setTimeout(() => { suppressClick = false }, 0)
  }
  svg.addEventListener('pointerup', endDrag, options)
  svg.addEventListener('pointercancel', endDrag, options)
  svg.addEventListener('pointerleave', event => { if (drag && !drag.moved) endDrag(event) }, options)
  svg.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false }
  }, { ...options, capture: true })
  disposeGraph = () => {
    controller.abort()
    disposeReferencePages()
    referenceAnimation?.cancel()
    referenceContent?.style.removeProperty('overflow')
    observer.disconnect()
    labelResizeObserver.disconnect()
    clearTimeout(clickTimer)
    if (drag && svg.hasPointerCapture(drag.id)) svg.releasePointerCapture(drag.id)
    if (dialog.open) dialog.close()
    restoreStage()
  }
}
