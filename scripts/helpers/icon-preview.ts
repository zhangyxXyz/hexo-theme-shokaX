import { readFileSync } from 'node:fs'
import { join } from 'node:path'

hexo.extend.helper.register('icon_preview_data', function () {
  const file = (hexo.theme.config as any).style?.iconfont || join(hexo.theme_dir, 'source/css/_iconfont.styl')
  const source = readFileSync(file, 'utf8')
  const colors = hexo.locals.get('data').icon_colors
  const symbols = colors?.font === (hexo.theme.config as any).iconfont ? colors.icons : {}
  return [...source.matchAll(/\.(i-[\w-]+):before\s*\{\s*content:\s*(['"])\\([\da-f]+)\2;\s*\}/gi)]
    .map(([, name, , code]) => ({ name, code, svg: symbols?.[code] || '' }))
})
