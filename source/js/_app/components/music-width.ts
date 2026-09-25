// Exponential damping is independent of the display refresh rate. Retargeting
// keeps the current width and the running frame loop instead of restarting it.
export function createMusicWidth(write: (width: number) => void) {
  let current = 0, target = 0, frame = 0, previous = 0
  const tick = (now: number) => {
    const elapsed = Math.max(0, now - previous)
    previous = now
    current += (target - current) * (1 - Math.exp(-elapsed / 110))
    if (Math.abs(target - current) < .2) {
      current = target
      frame = 0
    } else frame = requestAnimationFrame(tick)
    write(current)
  }
  return {
    set(width: number, animate: boolean) {
      target = width
      if (!animate || !current) {
        cancelAnimationFrame(frame)
        frame = 0
        current = target
        write(current)
      } else if (!frame && Math.abs(target - current) >= .2) {
        previous = performance.now()
        frame = requestAnimationFrame(tick)
      } else if (!frame) {
        current = target
        write(current)
      }
    },
    finish() {
      cancelAnimationFrame(frame)
      frame = 0
      current = target
      write(current)
    }
  }
}
