import { createHash } from 'node:crypto'
import path from 'node:path'
import { normalizeFestivalLabel } from '../utils/festival-label'

// Keep the artwork out of every article's HTML. Each scene is a cacheable asset.
let artworkRoutes: { path: string; data: string }[] = []
const templates: Record<string, string> = {
  dragon_boat: 'dragon-boat', mid_autumn: 'mid-autumn',
  lantern: 'lantern', qixi: 'qixi', chongyang: 'chongyang', laba: 'laba'
}
const solarScenes = new Set([
  'lichun', 'yushui', 'jingzhe', 'chunfen', 'qingming', 'guyu',
  'lixia', 'xiaoman', 'mangzhong', 'xiazhi', 'xiaoshu', 'dashu',
  'liqiu', 'chushu', 'bailu', 'qiufen', 'hanlu', 'shuangjiang',
  'lidong', 'xiaoxue', 'daxue', 'dongzhi', 'xiaohan', 'dahan'
])

hexo.extend.filter.register('before_generate', async () => {
  const theme = hexo.theme.config as any
  theme.festival_artwork = {}
  artworkRoutes = []
  const pages = hexo.locals?.get('pages')?.toArray?.() || []
  theme.festival_preview_enabled = pages.some(page => page.type === 'festival-preview')
  if (!theme.festival_preview_enabled && (!theme.festival?.enable || theme.festival.theme === 'none')) return
  const directory = path.join(hexo.theme_dir, 'layout/_partials/third-party/festival')
  for (const [scene, item] of Object.entries(theme.festival_table?.items || {})) {
    const config = item as { enable?: boolean; label?: unknown }
    if ((!theme.festival_preview_enabled && config.enable === false) || !/^[a-z_]+$/.test(scene)) continue
    const template = solarScenes.has(scene) ? 'solar-term' : templates[scene]
    if (!template) continue
    const rendered = String(await hexo.render.render({
      path: path.join(directory, `${template}.pug`), engine: 'pug'
    }, { term: scene, festivalLabel: normalizeFestivalLabel(config.label) }))
    const svg = /<svg\b[^>]*\bxmlns=/.test(rendered) ? rendered :
      rendered.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    if (!svg.startsWith('<svg ') || !svg.includes('</svg>')) {
      throw new Error(`Festival artwork ${scene} must render a single SVG`)
    }
    const hash = createHash('sha256').update(svg).digest('hex').slice(0, 12)
    const assetPath = `images/festival/${scene}.${hash}.svg`
    artworkRoutes.push({ path: assetPath, data: svg })
    theme.festival_artwork[scene] = assetPath
  }
}, 20)

hexo.extend.generator.register('festival-artwork', () => artworkRoutes)
