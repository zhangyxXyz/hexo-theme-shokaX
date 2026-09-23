import { refreshLive2D } from './reading-tools/live2d'
import { refreshArticleScript } from './reading-tools/article-script'

export function refreshReadingTools() {
  const config = document.getElementById('reading-tools-config')
  const toolbar = document.getElementById('tool')
  if (!config || !toolbar) return
  const button = (name: string, icon: string) => {
    let el = toolbar.querySelector<HTMLButtonElement>(`.${name}`)
    if (!el) {
      el = document.createElement('button')
      el.type = 'button'
      el.className = `item reading-tool ${name}`
      el.innerHTML = icon
      toolbar.insertBefore(el, toolbar.querySelector('.back-to-top'))
    }
    return el
  }
  if (config.dataset.live2d === 'true') refreshLive2D(button('live2d-toggle', '<i class="ic i-paw" aria-hidden="true"></i>'), config.dataset)
  if (config.dataset.script === 'true') refreshArticleScript(button('article-script-toggle', '<span aria-hidden="true">繁</span>'), config.dataset)
}
