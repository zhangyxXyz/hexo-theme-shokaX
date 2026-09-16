// The built-in navbar assumes equal widths; this strip handles expansion and centering.
export class ViewerThumbnails {
  private viewport = document.createElement('nav')
  private track = document.createElement('div')
  private buttons: HTMLButtonElement[] = []
  private abort = new AbortController()
  private resize: ResizeObserver
  private index = -1
  private wheelTime = 0

  constructor(footer: HTMLElement, images: HTMLImageElement[], locale: ImageViewerLocale, private onSelect: (index: number) => void) {
    this.viewport.className = 'shokax-viewer-thumbs'
    this.viewport.setAttribute('aria-label', locale.thumbnails)
    this.track.className = 'shokax-viewer-thumbs-track'
    this.buttons = images.map((source, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'shokax-viewer-thumb'
      button.tabIndex = -1
      button.setAttribute('aria-label', locale.thumbnail.replace('{index}', String(index + 1)).replace('{title}', source.alt || locale.image))
      button.title = source.alt || `${locale.image} ${index + 1}`
      const image = document.createElement('img')
      image.src = source.currentSrc || source.src
      image.alt = ''
      image.loading = 'lazy'
      image.decoding = 'async'
      image.draggable = false
      button.append(image)
      button.addEventListener('click', () => this.onSelect(index), { signal: this.abort.signal })
      this.track.append(button)
      return button
    })
    this.viewport.append(this.track)
    footer.append(this.viewport)
    this.viewport.addEventListener('keydown', (event) => {
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (!delta) return
      event.preventDefault()
      event.stopPropagation()
      const next = Math.max(0, Math.min(this.buttons.length - 1, this.index + delta))
      this.onSelect(next)
      this.buttons[next].focus({ preventScroll: true })
    }, { signal: this.abort.signal })
    this.viewport.addEventListener('wheel', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const delta = event.deltaX || event.deltaY
      if (!delta || performance.now() - this.wheelTime < 220) return
      this.wheelTime = performance.now()
      const next = Math.max(0, Math.min(this.buttons.length - 1, this.index + Math.sign(delta)))
      this.onSelect(next)
    }, { passive: false, signal: this.abort.signal })
    this.resize = new ResizeObserver(() => this.center())
    this.resize.observe(this.viewport)
  }

  select(index: number) {
    const first = this.index < 0
    this.index = index
    this.buttons.forEach((button, itemIndex) => {
      button.classList.toggle('is-active', itemIndex === index)
      button.setAttribute('aria-current', itemIndex === index ? 'true' : 'false')
      button.tabIndex = itemIndex === index ? 0 : -1
    })
    if (first) this.viewport.classList.add('is-initializing')
    this.center()
    if (first) {
      // Position the initial selection before enabling synchronized transitions.
      this.track.getBoundingClientRect()
      this.viewport.classList.remove('is-initializing')
    }
  }

  private center() {
    if (this.index < 0) return
    const style = getComputedStyle(this.viewport)
    const narrow = parseFloat(style.getPropertyValue('--thumb-narrow'))
    const wide = parseFloat(style.getPropertyValue('--thumb-wide'))
    const gap = parseFloat(style.getPropertyValue('--thumb-gap'))
    const left = (this.viewport.clientWidth - wide) / 2 - this.index * (narrow + gap)
    this.track.style.transform = `translateX(${left}px)`
  }

  reset() { this.index = -1 }

  destroy() {
    this.abort.abort()
    this.resize.disconnect()
    this.viewport.remove()
  }
}
