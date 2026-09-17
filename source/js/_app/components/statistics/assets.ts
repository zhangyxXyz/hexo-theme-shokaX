let library: Promise<any> | undefined
const mapLibraries = new Map<string, Promise<void>>()
export const mapLines = new Map<string, number[][][]>()
export const mapAspects = new Map<string, number>()
export const mapHitBounds = new Map<string, { name: string; west: number; east: number; south: number; north: number }>()

export function loadCharts(url?: string): Promise<any> {
  if (!url) return Promise.reject(new Error('unconfigured'))
  if (library) return library
  const script = (src: string) => new Promise<void>((resolve, reject) => {
    const node = document.createElement('script')
    const timer = window.setTimeout(() => { node.remove(); reject(new Error('asset timeout')) }, 15000)
    node.src = src
    node.onload = () => { clearTimeout(timer); resolve() }
    node.onerror = () => { clearTimeout(timer); node.remove(); reject(new Error('asset unavailable')) }
    document.head.append(node)
  })
  library = (async () => {
    const scope = window as typeof window & { echarts?: any }
    if (!scope.echarts) await script(url)
    return scope.echarts
  })().catch(error => { library = undefined; throw error })
  return library
}

export async function loadMap(url: string | undefined, echarts: any, name = 'china') {
  if (!url) throw new Error('unconfigured')
  if (echarts.getMap(`statistics-${name}`)) return
  if (!mapLibraries.has(name)) mapLibraries.set(name, (async () => {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error('map unavailable')
    const data = await response.json()
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('map invalid')
    // ECharts 4 map regions accept polygons; render line geometry in its own layer.
    const lines = data.features.flatMap((feature: any) => feature.geometry.type === 'MultiLineString' ? feature.geometry.coordinates : feature.geometry.type === 'LineString' ? [feature.geometry.coordinates] : [])
    mapLines.set(name, lines)
    let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity
    const bounds = (coordinates: any[]) => {
      if (typeof coordinates[0] === 'number') {
        west = Math.min(west, coordinates[0]); east = Math.max(east, coordinates[0])
        south = Math.min(south, coordinates[1]); north = Math.max(north, coordinates[1])
      } else coordinates.forEach(bounds)
    }
    data.features.forEach((feature: any) => {
      // This dataset calls the label anchor `center`; ECharts 4 reads `cp`.
      if (Array.isArray(feature.properties.center)) feature.properties.cp = feature.properties.center
      if (feature.properties.displayOnly) {
        const points = feature.geometry.coordinates.flat(2)
        mapHitBounds.set(name, { name: feature.properties.name,
          west: Math.min(...points.map((point: number[]) => point[0])), east: Math.max(...points.map((point: number[]) => point[0])),
          south: Math.min(...points.map((point: number[]) => point[1])), north: Math.max(...points.map((point: number[]) => point[1])),
        })
      }
      bounds(feature.geometry.coordinates)
    })
    const aspect = (east - west) / (north - south) * .75
    mapAspects.set(name, Number.isFinite(aspect) && aspect > 0 ? aspect : 1)
    echarts.registerMap(`statistics-${name}`, { ...data, features: data.features.filter((feature: any) => ['Polygon', 'MultiPolygon'].includes(feature.geometry.type)) })
  })().catch(error => { mapLibraries.delete(name); throw error }))
  return mapLibraries.get(name)
}
