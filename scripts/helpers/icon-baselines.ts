import { iconBaselineCSS } from '../utils/icon-baselines'

hexo.extend.helper.register('icon_baseline_css', function () {
  return iconBaselineCSS(hexo.locals.get('data').icon_baselines, (hexo.theme.config as any).iconfont)
})
