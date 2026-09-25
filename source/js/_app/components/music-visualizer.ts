// Capture a copy of the player's output. Never reroute the audible element:
// cross-origin tracks can otherwise become silent when connected to Web Audio.
type CapturableAudio = HTMLAudioElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream }
const storageKey = 'shokax.music.visualizer'
let controller: ReturnType<typeof createMusicVisualizer> | undefined

export function readMusicVisualizer() {
  try { return localStorage.getItem(storageKey) === 'on' } catch { return false }
}
export function toggleMusicVisualizer() {
  initMusicVisualizer()
  return controller?.toggle() ?? false
}
export function initMusicVisualizer() {
  controller ??= createMusicVisualizer()
}

export function createMusicVisualizer() {
  const waves = document.getElementById('waves')
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  const events = new AbortController()
  let enabled = readMusicVisualizer()
  let audio: CapturableAudio | undefined
  let canvas: HTMLCanvasElement | undefined
  let painter: CanvasRenderingContext2D | null = null
  let dock: HTMLCanvasElement | undefined
  let dockPainter: CanvasRenderingContext2D | null = null
  let dockWidth = 0, dockHeight = 0
  let docked = false
  let dockFadeUntil = 0
  let context: AudioContext | undefined
  let analyser: AnalyserNode | undefined
  let source: MediaStreamAudioSourceNode | undefined
  let stream: MediaStream | undefined
  let captureEvents: AbortController | undefined
  let attempted = false
  let leaving = false
  let destroyed = false
  let frame = 0
  let lastFrame = 0
  let phase = 0
  let width = 0, height = 0
  let lastSignal = 0
  const frequency = new Uint8Array(256)
  const levels = new Float32Array(32)
  const colors = ['#f49abb', '#b6a2dc', '#88d4ca']

  const releaseCapture = () => {
    captureEvents?.abort()
    captureEvents = undefined
    source?.disconnect()
    source = undefined
    stream?.getTracks().forEach(track => track.stop())
    stream = undefined
    attempted = false
    lastSignal = 0
    levels.fill(0)
  }
  const resize = () => {
    if (!canvas || !waves) return
    const rect = waves.getBoundingClientRect()
    width = rect.width
    height = rect.height
    const ratio = Math.min(devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.round(width * ratio))
    canvas.height = Math.max(1, Math.round(height * ratio))
    painter?.setTransform(ratio, 0, 0, ratio, 0, 0)
    if (dock) {
      // client dimensions exclude the entrance animation's transform.
      dockWidth = dock.clientWidth
      dockHeight = dock.clientHeight
      dock.width = Math.max(1, Math.round(dockWidth * ratio))
      dock.height = Math.max(1, Math.round(dockHeight * ratio))
      dockPainter?.setTransform(ratio, 0, 0, ratio, 0, 0)
    }
  }
  const ensureCanvas = () => {
    if (!waves) return false
    if (!canvas) {
      canvas = document.createElement('canvas')
      canvas.className = 'music-visualizer'
      canvas.setAttribute('aria-hidden', 'true')
      waves.append(canvas)
      painter = canvas.getContext('2d')
      resize()
    }
    if (docked && !dock) {
      dock = document.createElement('canvas')
      dock.className = 'music-visualizer-dock'
      dock.setAttribute('aria-hidden', 'true')
      document.body.append(dock)
      dockPainter = dock.getContext('2d')
      size.observe(dock)
      resize()
    }
    return !!painter
  }
  const capture = () => {
    if (!audio || attempted) return
    attempted = true
    const captureStream = audio.captureStream ?? audio.mozCaptureStream
    if (!captureStream) return
    try {
      context ??= new AudioContext()
      analyser ??= context.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = .65
      stream = captureStream.call(audio)
      const attach = () => {
        if (destroyed || source || !stream?.getAudioTracks().length) return
        try {
          source = context!.createMediaStreamSource(stream)
          source.connect(analyser!)
          // Deliberately no connection to destination: the original audio plays.
        } catch { /* CORS and browser capture restrictions use the ambient fallback. */ }
      }
      captureEvents = new AbortController()
      stream.addEventListener('addtrack', attach, { signal: captureEvents.signal })
      attach()
    } catch { /* Unsupported or protected media must never interrupt playback. */ }
  }
  const active = () => enabled && !!audio && !audio.paused && !audio.ended && audio.readyState >= 2 && !document.hidden && !motion.matches && !leaving && !destroyed
  const draw = (now: number) => {
    frame = 0
    if (!active() || !painter || !canvas) return
    frame = requestAnimationFrame(draw)
    if (now - lastFrame < 1000 / 30) return
    const dt = Math.min((now - lastFrame) / 1000, .06)
    lastFrame = now
    phase += dt
    if (analyser && context?.state === 'running') analyser.getByteFrequencyData(frequency)
    else frequency.fill(0)
    let energy = 0
    for (let i = 0; i < levels.length; i++) {
      const start = Math.floor(i * i / 5) + 1
      const end = Math.min(frequency.length, Math.floor((i + 1) * (i + 1) / 5) + 2)
      let total = 0
      for (let j = start; j < end; j++) total += frequency[j] / 255
      const value = total / Math.max(1, end - start)
      levels[i] += (value - levels[i]) * .25
      energy += value
    }
    if (energy > .015) lastSignal = now
    const real = lastSignal > 0 && now - lastSignal < 1800
    canvas.dataset.signal = real ? 'audio' : 'ambient'
    painter.clearRect(0, 0, width, height)
    // Smooth overlapping ribbons, anchored to the original header/content seam.
    for (let layer = 0; layer < colors.length; layer++) {
      const points: Array<[number, number]> = []
      for (let i = 0; i <= 32; i++) {
        const x = i / 32
        const envelope = Math.pow(Math.sin(Math.PI * x), .65)
        const band = levels[Math.min(i, 31)]
        const ripple = Math.sin(x * Math.PI * (4 + layer) - phase * (1.1 + layer * .22) + layer * 1.7)
        const amplitude = real ? .12 + band * .55 + energy / 32 * .16 : .13 + .035 * Math.sin(phase * .8 + layer)
        const y = height * (1 - envelope * (.2 + layer * .035 + amplitude * (.55 + ripple * .45)))
        points.push([x * width, y])
      }
      const gradient = painter.createLinearGradient(0, 0, 0, height)
      gradient.addColorStop(0, colors[layer] + 'c0')
      gradient.addColorStop(.65, colors[layer] + '80')
      gradient.addColorStop(1, colors[layer] + '08')
      painter.fillStyle = gradient
      painter.beginPath()
      painter.moveTo(0, height)
      painter.lineTo(...points[0])
      for (let i = 1; i < points.length - 1; i++) {
        const next = points[i + 1]
        painter.quadraticCurveTo(...points[i], (points[i][0] + next[0]) / 2, (points[i][1] + next[1]) / 2)
      }
      painter.lineTo(width, height)
      painter.closePath()
      painter.fill()
    }
    // One spectrum sample and one ribbon render. The dock is just a scaled
    // copy, keeping phase continuous without another audio graph or RAF loop.
    if (dock && dockPainter && (docked || now < dockFadeUntil)) {
      dock.dataset.signal = canvas.dataset.signal
      dockPainter.clearRect(0, 0, dockWidth, dockHeight)
      dockPainter.drawImage(canvas, 0, 0, dockWidth, dockHeight)
    }
  }
  const sync = () => {
    const running = active() && ensureCanvas()
    waves?.classList.toggle('music-visualizer-active', running && !docked)
    const wasDockVisible = dock?.classList.contains('is-visible')
    dock?.classList.toggle('is-visible', running && docked)
    if (wasDockVisible && !docked) dockFadeUntil = performance.now() + 450
    if (running) {
      capture()
      if (context?.state === 'suspended') void context.resume().catch(() => {})
      if (!frame) { lastFrame = performance.now(); frame = requestAnimationFrame(draw) }
    } else {
      cancelAnimationFrame(frame)
      frame = 0
      if (context?.state === 'running') void context.suspend().catch(() => {})
    }
  }
  const observeAudio = (event: Event) => {
    const target = event.target
    if (!(target instanceof HTMLAudioElement) || !target.closest('#MusicPlayerRoot')) return
    if (audio !== target) { releaseCapture(); audio = target }
    if (event.type === 'emptied' || event.type === 'loadstart') releaseCapture()
    if (event.type === 'playing' && stream && !stream.active) releaseCapture()
    sync()
  }
  for (const type of ['playing', 'pause', 'ended', 'emptied', 'loadstart', 'waiting', 'canplay', 'error']) {
    document.addEventListener(type, observeAudio, { capture: true, signal: events.signal })
  }
  // Resume an analysis-only context inside user activation after browser suspension.
  document.addEventListener('click', () => { if (active()) sync() }, { signal: events.signal })
  document.addEventListener('visibilitychange', sync, { signal: events.signal })
  motion.addEventListener('change', sync, { signal: events.signal })
  window.addEventListener('pagehide', () => { leaving = true; releaseCapture(); sync() }, { signal: events.signal })
  window.addEventListener('pageshow', () => { leaving = false; sync() }, { signal: events.signal })
  document.addEventListener('pjax:complete', sync, { signal: events.signal })
  const intersection = new IntersectionObserver(entries => {
    const entry = entries[entries.length - 1]
    if (!entry) return
    // Only dock after the header has left above the viewport. A little
    // hysteresis avoids flickering when scrolling around the boundary.
    if (!entry.isIntersecting && entry.boundingClientRect.bottom <= 0) docked = true
    else if (entry.intersectionRatio >= .12 || entry.boundingClientRect.top >= 0) docked = false
    sync()
  }, { threshold: [0, .12] })
  const size = new ResizeObserver(resize)
  if (waves) { intersection.observe(waves); size.observe(waves) }
  return {
    toggle() {
      enabled = !enabled
      try { localStorage.setItem(storageKey, enabled ? 'on' : 'off') } catch { /* Optional storage. */ }
      if (!enabled) releaseCapture()
      sync()
      return enabled
    },
    destroy() {
      destroyed = true
      sync()
      events.abort()
      intersection.disconnect()
      size.disconnect()
      releaseCapture()
      analyser?.disconnect()
      void context?.close().catch(() => {})
      canvas?.remove()
      dock?.remove()
    }
  }
}
