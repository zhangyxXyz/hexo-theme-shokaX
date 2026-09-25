import type { ThemeEffect } from './types'

/** 日升日落: preserve the original cat, rotating sun/moon and timing. */
export const sunrise: ThemeEffect = ({ from, to, mount, after, commit, finish }) => {
  const layer = document.createElement('div')
  layer.id = 'neko'
  layer.className = from === 'dark' ? 'dark' : ''
  layer.innerHTML = '<div class="planet"><div class="sun"></div><div class="moon"></div></div><div class="body"><div class="face"><section class="eyes left"><span class="pupil"></span></section><section class="eyes right"><span class="pupil"></span></section><span class="nose"></span></div></div>'
  mount(layer)
  after(410, () => {
    layer.classList.toggle('dark', to === 'dark')
    commit()
  })
  after(2910, () => layer.classList.add('is-finished'))
  after(3110, finish)
}
