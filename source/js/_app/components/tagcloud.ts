let cleanup: (() => void) | undefined

/** Enhance server-rendered links without replacing their navigation semantics. */
export const refreshTagCloud = () => {
  cleanup?.()
  cleanup = undefined
  const root = document.querySelector<HTMLElement>('.tag-cloud-widget')
  const stage = root?.querySelector<HTMLElement>('[data-cloud-stage]')
  if (!root || !stage) return
  const links = Array.from(stage.querySelectorAll<HTMLAnchorElement>('.tag-cloud-link'))
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-cloud-mode]'))
  const controls = root.querySelector<HTMLElement>('.tag-cloud-controls')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const events = new AbortController()
  let mode = '2d'
  let frame = 0
  let last = 0
  let verticalSpeed = 0
  let targetVerticalSpeed = 0
  let speed = .00012
  let targetSpeed = .00012
  let morphing = false
  let morphId = 0
  let animations: Animation[] = []
  let hovered = false
  let focused = false
  let visible = false
  let radiusX = 0
  let radiusY = 0
  const points = links.map((_, i) => {
    const y = links.length === 1 ? 0 : 1 - 2 * (i + .5) / links.length
    const r = Math.sqrt(1 - y * y)
    const phi = i * Math.PI * (3 - Math.sqrt(5))
    return { x: r * Math.cos(phi), y, z: r * Math.sin(phi) }
  })
  const draw = () => {
    points.forEach((point, i) => {
      const { x, y, z } = point
      const perspective = 3 / (3 - z)
      const scale = .62 + (z + 1) * .24
      links[i].style.transform = `translate(-50%, -50%) translate(${x * radiusX * perspective}px, ${y * radiusY * perspective}px) scale(${scale})`
      links[i].style.opacity = String(.3 + (z + 1) * .35)
      links[i].style.zIndex = String(Math.round((z + 1) * 100))
    })
  }
  const canAnimate = () => mode === '3d' && !morphing && visible && !document.hidden && !hovered && !focused && !reduced.matches && root.isConnected
  const tick = (time: number) => {
    frame = 0
    if (!canAnimate()) { last = 0; return }
    const dt = last ? Math.min(time - last, 50) : 0
    const ease = 1 - Math.exp(-dt / 180)
    speed += (targetSpeed - speed) * ease
    verticalSpeed += (targetVerticalSpeed - verticalSpeed) * ease
    // Rotate around screen axes so front-facing tags follow the pointer in any direction.
    const yaw = dt * speed
    const pitch = -dt * verticalSpeed
    points.forEach(point => {
      const x = point.x * Math.cos(yaw) + point.z * Math.sin(yaw)
      const z = point.z * Math.cos(yaw) - point.x * Math.sin(yaw)
      const y = point.y * Math.cos(pitch) - z * Math.sin(pitch)
      point.z = z * Math.cos(pitch) + point.y * Math.sin(pitch)
      point.x = x
      point.y = y
    })
    last = time
    draw()
    frame = requestAnimationFrame(tick)
  }
  const sync = () => {
    if (canAnimate()) {
      if (!frame) frame = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(frame)
      frame = 0
      last = 0
    }
  }
  const measure = () => {
    if (mode !== '3d' || morphing) return
    const maxWidth = Math.max(0, ...links.map(link => link.offsetWidth))
    const maxHeight = Math.max(0, ...links.map(link => link.offsetHeight))
    radiusX = Math.max(0, (stage.clientWidth - maxWidth * 1.1) / 2 - 12) / 1.07
    radiusY = Math.max(0, (stage.clientHeight - maxHeight * 1.1) / 2 - 16) / 1.07
    radiusX = Math.min(radiusX, radiusY)
    draw()
  }
  const setMode = (next: string, animate = false) => {
    const nextMode = next === '3d' ? '3d' : '2d'
    if (nextMode === mode && root.dataset.mode) return
    // Read the currently displayed positions before cancelling an interrupted morph.
    const before = links.map(link => ({ rect: link.getBoundingClientRect(), opacity: getComputedStyle(link).opacity }))
    root.dataset.morphing = 'true'
    const id = ++morphId
    animations.forEach(animation => animation.cancel())
    animations = []
    morphing = false
    mode = nextMode
    root.dataset.mode = mode
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cloudMode === mode)))
    if (mode === '3d') measure()
    else links.forEach(link => {
      link.style.removeProperty('transform')
      link.style.removeProperty('opacity')
      link.style.removeProperty('z-index')
    })
    if (animate && !reduced.matches) {
      morphing = true
      animations = links.map((link, index) => {
        const after = link.getBoundingClientRect()
        const from = before[index]
        const transform = getComputedStyle(link).transform
        const target = transform === 'none' ? '' : transform
        const dx = from.rect.x + from.rect.width / 2 - after.x - after.width / 2
        const dy = from.rect.y + from.rect.height / 2 - after.y - after.height / 2
        return link.animate([
          { transform: `translate(${dx}px, ${dy}px) ${target} scale(${from.rect.width / Math.max(1, after.width)}, ${from.rect.height / Math.max(1, after.height)})`, opacity: from.opacity },
          { transform: target || 'none', opacity: getComputedStyle(link).opacity }
        ], { duration: 650, easing: 'cubic-bezier(.22, 1, .36, 1)' })
      })
      void Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(() => {
        if (id !== morphId) return
        animations = []
        morphing = false
        delete root.dataset.morphing
        measure()
        sync()
      })
    } else delete root.dataset.morphing
    sync()
  }
  buttons.forEach(button => button.addEventListener('click', () => setMode(button.dataset.cloudMode, true), { signal: events.signal }))
  links.forEach(link => {
    link.addEventListener('pointerenter', () => { hovered = true; sync() }, { signal: events.signal })
    link.addEventListener('pointerleave', () => { hovered = false; sync() }, { signal: events.signal })
  })
  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || mode !== '3d' || !visible) return
    const rect = stage.getBoundingClientRect()
    const x = (event.clientX - rect.left - rect.width / 2) / Math.max(1, radiusX)
    const y = (event.clientY - rect.top - rect.height / 2) / Math.max(1, radiusY)
    const distance = Math.hypot(x, y)
    // Continue tracking outside the sphere/stage, with a bounded edge acceleration.
    const velocity = .0011 * Math.pow(Math.min(distance / 2, 1), 1.5)
    targetSpeed = distance ? x / distance * velocity : 0
    targetVerticalSpeed = distance ? y / distance * velocity : 0
  }, { signal: events.signal })
  stage.addEventListener('pointerleave', () => {
    hovered = false
    sync()
  }, { signal: events.signal })
  document.documentElement.addEventListener('pointerleave', () => {
    targetSpeed = .00012
    targetVerticalSpeed = 0
  }, { signal: events.signal })
  stage.addEventListener('dragstart', event => {
    if (mode === '3d') event.preventDefault()
  }, { signal: events.signal })
  stage.addEventListener('selectstart', event => {
    if (mode === '3d') event.preventDefault()
  }, { signal: events.signal })
  stage.addEventListener('focusin', () => { focused = true; sync() }, { signal: events.signal })
  stage.addEventListener('focusout', event => { focused = stage.contains(event.relatedTarget as Node); sync() }, { signal: events.signal })
  document.addEventListener('visibilitychange', sync, { signal: events.signal })
  reduced.addEventListener('change', () => {
    if (reduced.matches) animations.forEach(animation => animation.finish())
    sync()
  }, { signal: events.signal })
  const resize = new ResizeObserver(measure)
  resize.observe(stage)
  links.forEach(link => resize.observe(link))
  const intersection = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting
    sync()
  })
  intersection.observe(stage)
  if (controls) controls.hidden = false
  setMode(root.dataset.defaultMode)
  cleanup = () => {
    ++morphId
    animations.forEach(animation => animation.cancel())
    animations = []
    morphing = false
    delete root.dataset.morphing
    cancelAnimationFrame(frame)
    events.abort()
    resize.disconnect()
    intersection.disconnect()
    setMode('2d')
    if (controls) controls.hidden = true
  }
}
