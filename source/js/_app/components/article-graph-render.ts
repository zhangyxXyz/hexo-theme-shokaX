import { resourceURL } from '../globals/resources'
import type { SimulationNodeDatum } from 'd3-force'

type D3 = typeof import('d3-force')
let library: Promise<D3> | undefined
export function loadGraphLibrary(): Promise<D3> {
  if (library) return library
  library = new Promise<D3>((resolve, reject) => {
    const scope = window as typeof window & { d3?: D3 }
    if (scope.d3?.forceSimulation) { resolve(scope.d3); return }
    const script = document.createElement('script')
    const fail = () => { clearTimeout(timer); script.remove(); reject(new Error('Graph library unavailable')) }
    const timer = setTimeout(fail, 15000)
    script.src = resourceURL('js.d3')
    script.async = true
    script.dataset.articleGraphVendor = ''
    script.onload = () => { clearTimeout(timer); scope.d3?.forceSimulation ? resolve(scope.d3) : fail() }
    script.onerror = fail
    document.head.append(script)
  }).catch(error => { library = undefined; throw error })
  return library
}

interface Node extends SimulationNodeDatum { id: string; url: string; title: string; label: string; relation: string }
interface Edge { source: string; target: string; incoming: boolean; outgoing: boolean }
const labelLayouts = new WeakMap<SVGSVGElement, string>()
const labelWidth = (width: number) => Math.min(220, Math.max(100, width * .3))
const SIDE_ROWS = 6

// SVG viewBox fitting also enlarges text. Keep labels at reading size in CSS
// pixels when fitting, zooming, resizing or opening the larger dialog.
export function sizeGraphLabels(svg: SVGSVGElement) {
  const matrix = svg.getScreenCTM()
  const scale = matrix && Math.hypot(matrix.a, matrix.b)
  if (!scale || !svg.clientWidth) return
  const defaultWidth = labelWidth(svg.clientWidth)
  const layout = `${scale}:${defaultWidth}`
  if (labelLayouts.get(svg) === layout) return
  labelLayouts.set(svg, layout)
  for (const text of svg.querySelectorAll<SVGTextElement>('text[data-graph-label]')) {
    const maxWidth = Math.min(defaultWidth, Number(text.dataset.graphLabelMax) || Infinity)
    text.style.fontSize = `${13 / scale}px`
    const title = text.getAttribute('data-graph-label') || ''
    text.textContent = title
    if (text.getComputedTextLength() * scale > maxWidth) {
      const letters = [...title]
      let low = 0, high = letters.length
      while (low < high) {
        const count = Math.ceil((low + high) / 2)
        text.textContent = letters.slice(0, count).join('') + '…'
        if (text.getComputedTextLength() * scale <= maxWidth) low = count
        else high = count - 1
      }
      text.textContent = letters.slice(0, low).join('') + '…'
    }
    const background = text.previousElementSibling
    if (background?.hasAttribute('data-graph-label-bg')) {
      const box = text.getBBox(), padX = 8 / scale, padY = 3 / scale
      background.setAttribute('x', String(box.x - padX))
      background.setAttribute('y', String(box.y - padY))
      background.setAttribute('width', String(box.width + padX * 2))
      background.setAttribute('height', String(box.height + padY * 2))
      background.setAttribute('rx', String(box.height / 2 + padY))
    }
  }
}

type Placed = Node & { x: number; y: number; side?: number }

// Sparse graphs read like a mind map: citing articles on the left, cited ones on
// the right, labels pointing outward so they never cross the centre or each other.
function placeInColumns(nodes: Placed[], width: number, height: number) {
  const center = nodes.find(node => node.relation === 'current') ?? nodes[0]
  const others = nodes.filter(node => node !== center)
  const left = others.filter(node => node.relation === 'incoming')
  const right = others.filter(node => node.relation === 'outgoing')
  for (const node of others) if (node.relation === 'mutual') (left.length < right.length ? left : right).push(node)
  const longest = Math.max(left.length, right.length)
  const semantic = left.length && right.length ? longest <= SIDE_ROWS : longest <= 3
  const all = [...left, ...right], half = Math.floor(all.length / 2)
  const sides = semantic ? [left, right] : [all.slice(0, half), all.slice(half)]
  const labelSpace = width < 480 ? 0 : labelWidth(width) + 18
  const column = Math.max(60, width / 2 - labelSpace - 16)
  const spread = height / 2 - 26
  // A one-sided graph shifts toward the empty side so the whole figure stays centred.
  const shift = sides[0].length && sides[1].length ? 0 : (sides[0].length ? 1 : -1) * column / 2
  center.x = shift
  center.y = 0
  sides.forEach((list, index) => {
    const side = index ? 1 : -1
    const gap = list.length > 1 ? Math.min(44, spread * 2 / (list.length - 1)) : 0
    list.forEach((node, i) => {
      node.y = (i - (list.length - 1) / 2) * gap
      const ratio = spread ? node.y / spread : 0
      node.x = shift + side * (column - 26 * ratio * ratio)
      node.side = side
    })
  })
  return { center, column, bounds: [-width / 2, -height / 2, width, height] }
}

// Dense graphs radiate at evenly spaced angles; consecutive angles alternate between
// concentric ellipses, so each outer edge passes between two inner dots. Relations
// stay contiguous in angle and read as coloured sectors.
function placeInRings(nodes: Placed[], width: number, height: number, d3: D3) {
  const center = nodes.find(node => node.relation === 'current') ?? nodes[0]
  const order = ['incoming', 'mutual', 'outgoing']
  const others = nodes.filter(node => node !== center)
    .sort((a, b) => order.indexOf(a.relation) - order.indexOf(b.relation))
  const rx = width / 2 - 30, ry = height / 2 - 20
  const radii = others.length <= 16 ? [1] : others.length <= 40 ? [1, .62] : [1, .74, .5]
  others.forEach((node, i) => {
    // A half-step offset keeps every node off the vertical axis, so each branch has a side.
    const angle = (i + .5) / others.length * Math.PI * 2 - Math.PI / 2, r = radii[i % radii.length]
    Object.assign(node, { x: Math.cos(angle) * rx * r, y: Math.sin(angle) * ry * r })
  })
  Object.assign(center, { x: 0, y: 0, fx: 0, fy: 0 })
  const targets = new Map(others.map(node => [node, { x: node.x, y: node.y }]))
  const simulation = d3.forceSimulation(nodes).stop()
    .force('x', d3.forceX<Placed>(node => targets.get(node)?.x ?? 0).strength(.4))
    .force('y', d3.forceY<Placed>(node => targets.get(node)?.y ?? 0).strength(.4))
    .force('collide', d3.forceCollide(11))
  try { simulation.tick(60) } finally { simulation.stop() }
  return { inner: rx * radii[radii.length - 1], bounds: [-width / 2, -height / 2, width, height] }
}

export function drawArticleGraph(svg: SVGSVGElement, payload: { nodes: Node[]; edges: Edge[] }, d3: D3): number[] {
  labelLayouts.delete(svg)
  const dense = svg.classList.contains('is-dense')
  const nodes: Placed[] = payload.nodes.map(node => ({ ...node, x: 0, y: 0 }))
  const width = svg.clientWidth || 750
  let bounds: number[], column = 0
  if (dense) {
    const rings = placeInRings(nodes, width, svg.clientHeight || 304, d3)
    bounds = rings.bounds
    column = rings.inner
  } else {
    ({ bounds, column } = placeInColumns(nodes, width, svg.clientHeight || 240))
  }
  const byId = new Map(nodes.map(node => [node.id, node]))
  const make = (tag: string, attrs: Record<string, string | number>, parent: SVGElement) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value))
    parent.append(el)
    return el
  }
  const sourceGap = 15, targetGap = 11
  // Both layouts leave the centre horizontally like a mind map. Columns also arrive
  // horizontally; ring nodes arrive along their radius so top and bottom branches bend upward.
  const edgePath = (source: Placed, target: Placed) => {
    const dx = target.x - source.x, dy = target.y - source.y
    const side = Math.sign(dx) || 1
    const x1 = source.x + side * sourceGap
    if (dense) {
      const length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length
      const c1 = source.x + side * Math.max(Math.abs(dx) * .5, 28)
      return `M${x1} ${source.y}C${c1} ${source.y} ${target.x - ux * length * .4} ${target.y - uy * length * .4} ${target.x - ux * targetGap} ${target.y - uy * targetGap}`
    }
    const x2 = target.x - side * targetGap, mid = (x1 + x2) / 2
    return `M${x1} ${source.y}C${mid} ${source.y} ${mid} ${target.y} ${x2} ${target.y}`
  }
  svg.querySelectorAll('[data-graph-drawn]').forEach(node => node.remove())
  const edges = make('g', { class: 'article-graph-edges', 'aria-hidden': 'true', 'data-graph-drawn': '' }, svg)
  const edgeOf = new Map<string, SVGElement>()
  for (const edge of payload.edges) {
    const source = byId.get(edge.source), target = byId.get(edge.target)
    if (!source || !target) continue
    const path = make('path', { class: 'is-' + target.relation, d: edgePath(source, target), 'vector-effect': 'non-scaling-stroke' }, edges)
    if (edge.incoming) path.classList.add('has-start')
    if (edge.outgoing) path.classList.add('has-end')
    edgeOf.set(target.id, path)
  }
  const nodeLayer = make('g', { 'data-graph-drawn': '' }, svg)
  const highlight = (id: string, on: boolean) => {
    svg.classList.toggle('has-active-node', on)
    edgeOf.get(id)?.classList.toggle('is-active', on)
  }
  for (const node of nodes) {
    const current = node.relation === 'current'
    const anchor = make('a', { class: 'article-graph-node is-' + node.relation, href: node.url,
      transform: `translate(${node.x} ${node.y})`, 'aria-label': node.title, 'data-theme-tooltip': node.title }, nodeLayer)
    if (current) anchor.setAttribute('aria-current', 'page')
    else {
      for (const type of ['pointerenter', 'focus']) anchor.addEventListener(type, () => highlight(node.id, true))
      for (const type of ['pointerleave', 'blur']) anchor.addEventListener(type, () => highlight(node.id, false))
    }
    make('circle', { class: 'article-graph-hit', r: 18, fill: 'transparent' }, anchor)
    make('circle', { class: 'article-graph-dot', r: current ? 11 : dense ? 6 : 7, 'vector-effect': 'non-scaling-stroke' }, anchor)
    if (current || dense) make('rect', { class: 'article-graph-label-bg', 'data-graph-label-bg': '', 'vector-effect': 'non-scaling-stroke' }, anchor)
    const label: Record<string, string | number> = { 'data-graph-label': node.title, 'aria-hidden': 'true', 'dominant-baseline': 'central' }
    if (current) Object.assign(label, { y: 30, 'text-anchor': 'middle', 'data-graph-label-max': Math.max(80, column * 2 - 48) })
    // Hover labels in dense rings point inward so they stay inside the card.
    else if (dense) Object.assign(label, { y: node.y < 0 ? 20 : -20,
      'text-anchor': node.x > width / 4 ? 'end' : node.x < -width / 4 ? 'start' : 'middle' })
    else Object.assign(label, { x: node.side * 14, 'text-anchor': node.side > 0 ? 'start' : 'end' })
    make('text', label, anchor).textContent = node.label
  }
  return bounds
}
