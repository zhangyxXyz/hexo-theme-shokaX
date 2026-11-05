import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { iconAdjustments } from '../utils/icon-baselines'

hexo.extend.helper.register('icon_preview_data', function () {
  const theme = hexo.theme.config as any
  const file = theme.style?.iconfont || join(hexo.theme_dir, 'source/css/_iconfont.styl')
  const source = readFileSync(file, 'utf8')
  const data = hexo.locals.get('data')
  const colors = data.icon_colors
  const symbols = colors?.font === theme.iconfont ? colors.icons : {}
  const adjustments = iconAdjustments(data.icon_baselines, theme.iconfont)?.icons
  return [...source.matchAll(/\.(i-[\w-]+):before\s*\{\s*content:\s*(['"])\\([\da-f]+)\2;\s*\}/gi)]
    .map(([, name, , code]) => ({ name, code, svg: symbols?.[code] || '', adjust: adjustments?.get(name) }))
})
