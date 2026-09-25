import type { ThemeEffect } from './types'

/** 月夜星辉: a radial sky reveal inspired by Lavender's theme switch. */
export const moonStars: ThemeEffect = ({ to, origin, mount, animate, afterPaint, commit, finish }) => {
  const layer = document.createElement('div')
  layer.className = `theme-moon-stars to-${to}`
  layer.style.setProperty('--theme-x', `${origin.x}px`)
  layer.style.setProperty('--theme-y', `${origin.y}px`)
  layer.innerHTML = '<div class="theme-moon-stars__orb"><span class="theme-moon-stars__symbol"></span></div>'
  for (let index = 0; index < 6; index++) {
    const spark = document.createElement('span')
    spark.className = 'theme-moon-stars__spark'
    spark.style.setProperty('--i', String(index))
    layer.append(spark)
  }
  mount(layer)
  // Overscan reaches every corner before the easing tail, as in the reference.
  // viewport units also remain correct if the viewport changes mid-transition.
  const center = `${origin.x}px ${origin.y}px`
  animate(layer, [
    { clipPath: `circle(0px at ${center})` },
    { clipPath: `circle(150vmax at ${center})` }
  ], { duration: 680, easing: 'cubic-bezier(.65, 0, .2, 1)', fill: 'forwards' }, () => {
    // Keep full coverage after the animation is released; commit only once its
    // actual timeline finishes, never on an independent wall-clock timer.
    layer.style.clipPath = 'none'
    commit()
    // Give theme observers/style updates a covered paint before revealing them.
    afterPaint(() => animate(layer, [{ opacity: 1 }, { opacity: 0 }], {
      duration: 380, easing: 'ease', fill: 'forwards'
    }, finish))
  })
}
