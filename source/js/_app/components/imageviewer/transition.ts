// Use public view/viewed events and DOM animations, without replacing library methods.
export class ViewerTransition {
  private layer = document.createElement('div')
  private outgoing?: HTMLImageElement
  private pending?: HTMLImageElement
  private active?: HTMLImageElement
  private animations: Animation[] = []
  private index = -1
  private direction = 1
  private abort?: AbortController

  constructor(private root: HTMLElement) {
    this.layer.className = 'shokax-viewer-slide-layer'
    this.layer.setAttribute('aria-hidden', 'true')
    this.root.append(this.layer)
  }

  prepare(image: HTMLImageElement, index: number) {
    this.abort?.abort()
    this.abort = new AbortController()
    this.direction = index >= this.index ? 1 : -1
    // Keep the previous image while loading; resume rapid navigation from its visible position.
    if (this.active?.isConnected) {
      const clone = this.active.cloneNode(true) as HTMLImageElement
      clone.className = 'shokax-viewer-outgoing'
      clone.style.translate = getComputedStyle(this.active).translate
      clone.style.opacity = getComputedStyle(this.active).opacity
      this.layer.replaceChildren(clone)
      this.outgoing = clone
    }
    this.cancelAnimations()
    this.pending = image
    this.active = undefined
    this.index = index
    image.loading = 'eager'
    image.classList.add('shokax-image-pending')
    image.addEventListener('error', () => {
      image.classList.remove('shokax-image-pending')
      this.layer.replaceChildren()
      this.outgoing = undefined
    }, { once: true, signal: this.abort.signal })
  }

  show(image: HTMLImageElement) {
    if (image !== this.pending) return
    this.pending = undefined
    this.active = image
    image.classList.remove('shokax-image-pending')
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.layer.replaceChildren()
      this.outgoing = undefined
      return
    }
    const style = getComputedStyle(this.root)
    const duration = style.getPropertyValue('--viewer-duration').trim()
    const options: KeyframeAnimationOptions = {
      duration: parseFloat(duration) * (duration.endsWith('ms') ? 1 : 1000) || 360,
      easing: style.getPropertyValue('--viewer-easing').trim() || 'ease-out'
    }
    const distance = this.root.clientWidth * this.direction
    const outgoing = this.outgoing
    const incoming = image.animate(outgoing
      ? [{ translate: `${distance}px 0` }, { translate: '0 0' }]
      : [{ opacity: 0 }, { opacity: 1 }], options)
    this.animations.push(incoming)
    if (outgoing) {
      const animation = outgoing.animate([
        { translate: outgoing.style.translate || '0 0' },
        { translate: `${-distance}px 0` }
      ], options)
      this.animations.push(animation)
      animation.onfinish = () => {
        outgoing.remove()
        if (this.outgoing === outgoing) this.outgoing = undefined
      }
    }
  }

  private cancelAnimations() {
    this.animations.forEach((animation) => animation.cancel())
    this.animations = []
  }

  reset() {
    this.abort?.abort()
    this.cancelAnimations()
    this.layer.replaceChildren()
    this.pending = this.active = this.outgoing = undefined
    this.index = -1
  }

  destroy() {
    this.reset()
    this.layer.remove()
  }
}
