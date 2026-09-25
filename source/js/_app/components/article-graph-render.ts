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

// SVG viewBox fitting also enlarges text. Keep labels at reading size in CSS
// pixels when fitting, zooming, resizing or opening the larger dialog.
export function sizeGraphLabels(svg: SVGSVGElement) {
  const matrix = svg.getScreenCTM()
  const scale = matrix && Math.hypot(matrix.a, matrix.b)
  if (!scale || !svg.clientWidth) return
  const maxWidth = Math.min(220, Math.max(100, svg.clientWidth * .3))
  const layout = `${scale}:${maxWidth}`
  if (labelLayouts.get(svg) === layout) return
  labelLayouts.set(svg, layout)
  for (const text of svg.querySelectorAll<SVGTextElement>('text[data-graph-label]')) {
    text.style.fontSize = `${13 / scale}px`
    text.style.strokeWidth = `${4 / scale}px`
    const title = text.getAttribute('data-graph-label') || ''
    text.textContent = title
    if (text.getComputedTextLength() * scale <= maxWidth) continue
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
}

export function drawArticleGraph(svg: SVGSVGElement, payload: { nodes: Node[]; edges: Edge[] }, d3: D3): number[] {
  labelLayouts.delete(svg)
  const nodes = payload.nodes.map((node, i) => ({ ...node,
    // A shallow diagonal keeps two neighbours spread across a landscape card.
    x: i ? Math.cos((i - 1) * Math.PI * 2 / (payload.nodes.length - 1) - Math.PI / 6) * 190 : 0,
    y: i ? Math.sin((i - 1) * Math.PI * 2 / (payload.nodes.length - 1) - Math.PI / 6) * 190 : 0,
    ...(i ? {} : { fx: 0, fy: 0 }) }))
  const links = payload.edges.map(edge => ({ ...edge }))
  const simulation = d3.forceSimulation(nodes).stop()
    .force('link', d3.forceLink<Node, any>(links).id(node => node.id).distance(190))
    .force('charge', d3.forceManyBody().strength(-700))
    .force('collide', d3.forceCollide(nodes.length <= 12 ? 80 : 34).iterations(2))
    .force('x', d3.forceX(0).strength(.025))
    .force('y', d3.forceY(0).strength(.07))
  try { simulation.tick(240) } finally { simulation.stop() }
  const x = Math.min(...nodes.map(node => node.x)) - 150, y = Math.min(...nodes.map(node => node.y)) - 55
  const bounds = [x, y, Math.max(...nodes.map(node => node.x)) - x + 150, Math.max(...nodes.map(node => node.y)) - y + 60]
  // Preserve readable labels and visible dots when a larger graph is fitted to the card.
  const scale = Math.max(1, bounds[2] / (svg.clientWidth || 750), bounds[3] / (svg.clientHeight || 304))
  const byId = new Map(nodes.map(node => [node.id, node]))
  const make = (tag: string, attrs: Record<string, string | number>, parent: SVGElement) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag)
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value))
    parent.append(el)
    return el
  }
  svg.querySelectorAll('[data-graph-drawn]').forEach(node => node.remove())
  const edges = make('g', { class: 'article-graph-edges', 'aria-hidden': 'true', 'data-graph-drawn': '' }, svg)
  for (const edge of payload.edges) {
    const source = byId.get(edge.source), target = byId.get(edge.target)
    const length = Math.hypot(target.x - source.x, target.y - source.y) || 1
    const dx = (target.x - source.x) / length, dy = (target.y - source.y) / length
    const line = make('line', { class: 'is-' + target.relation, x1: source.x + dx * 16 * scale, y1: source.y + dy * 16 * scale,
      x2: target.x - dx * 12 * scale, y2: target.y - dy * 12 * scale, 'vector-effect': 'non-scaling-stroke' }, edges)
    if (edge.incoming) line.setAttribute('marker-start', 'url(#article-graph-arrow)')
    if (edge.outgoing) line.setAttribute('marker-end', 'url(#article-graph-arrow)')
  }
  const nodeLayer = make('g', { 'data-graph-drawn': '' }, svg)
  for (const node of nodes) {
    const anchor = make('a', { class: 'article-graph-node is-' + node.relation, href: node.url,
      transform: `translate(${node.x} ${node.y})`, 'aria-label': node.title, 'data-theme-tooltip': node.title }, nodeLayer)
    if (node.relation === 'current') anchor.setAttribute('aria-current', 'page')
    make('circle', { class: 'article-graph-hit', r: 22 * scale, fill: 'transparent' }, anchor)
    make('circle', { class: 'article-graph-dot', r: (node.relation === 'current' ? 11 : 7) * scale, 'vector-effect': 'non-scaling-stroke' }, anchor)
    make('text', { y: -22 * scale, 'data-graph-label': node.title, 'text-anchor': 'middle', 'aria-hidden': 'true' }, anchor).textContent = node.label
  }
  return bounds
}
