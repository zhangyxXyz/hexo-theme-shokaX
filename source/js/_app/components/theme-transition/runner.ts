import type { ThemeEffect, ThemeMode } from './types'

export function createThemeTransitionRunner(apply: (mode: ThemeMode) => void) {
  let active: { finish: () => void; cleanup: () => void } | undefined

  return {
    get running() { return !!active },
    cancel(commit = true) {
      if (commit) active?.finish()
      else active?.cleanup()
    },
    run(effect: ThemeEffect, from: ThemeMode, to: ThemeMode, origin: { x: number; y: number }, reduced: boolean) {
      if (active) return
      if (reduced) { apply(to); return }
      const timers = new Set<ReturnType<typeof setTimeout>>()
      const elements = new Set<HTMLElement>()
      const animations = new Set<Animation>()
      const frames = new Set<number>()
      let committed = false
      let closed = false
      const commit = () => {
        if (closed || committed) return
        committed = true
        apply(to)
      }
      const cleanup = () => {
        closed = true
        timers.forEach(clearTimeout)
        frames.forEach(cancelAnimationFrame)
        animations.forEach(animation => animation.cancel())
        elements.forEach(element => element.remove())
        active = undefined
      }
      const finish = () => { try { commit() } finally { cleanup() } }
      const safely = (callback: () => void) => {
        if (!closed) {
          try { callback() } catch { finish() }
        }
      }
      const frame = (callback: () => void) => {
        if (closed) return
        const id = requestAnimationFrame(() => {
          frames.delete(id)
          safely(callback)
        })
        frames.add(id)
      }
      active = { finish, cleanup }
      try {
        effect({
          from, to, origin, commit, finish,
          animate(element, keyframes, options, complete) {
            if (closed) return
            if (typeof element.animate !== 'function') { safely(complete); return }
            const animation = element.animate(keyframes, options)
            animations.add(animation)
            animation.finished.then(() => {
              safely(complete)
              animations.delete(animation)
              animation.cancel()
            }, () => {
              animations.delete(animation)
              if (!closed) finish()
            })
          },
          afterPaint(callback) { frame(() => frame(callback)) },
          mount(element) {
            if (closed) return
            elements.add(element)
            element.setAttribute('aria-hidden', 'true')
            document.body.append(element)
          },
          after(milliseconds, callback) {
            if (closed) return
            const timer = setTimeout(() => {
              timers.delete(timer)
              safely(callback)
            }, milliseconds)
            timers.add(timer)
          }
        })
      } catch { finish() }
    }
  }
}
