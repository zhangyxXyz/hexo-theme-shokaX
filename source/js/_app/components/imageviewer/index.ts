import type Viewer from 'viewerjs'
import { decorateViewerControls } from './controls'
import { ViewerThumbnails } from './thumbnails'
import { ViewerTransition } from './transition'

export class ImageViewerGallery {
  private thumbnails: ViewerThumbnails
  private transition: ViewerTransition
  private counter = document.createElement('span')
  private abort = new AbortController()

  constructor(private root: HTMLElement, private images: HTMLImageElement[], viewer: Viewer, private locale: ImageViewerLocale) {
    decorateViewerControls(root, locale)
    // Disabled controls must absorb clicks instead of exposing the backdrop underneath.
    root.addEventListener('click', (event) => {
      if (event.target instanceof Element && event.target.closest('[data-viewer-action][aria-disabled="true"]')) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }, { capture: true, signal: this.abort.signal })
    this.thumbnails = new ViewerThumbnails(root.querySelector('.viewer-footer'), images, locale, (index) => viewer.view(index))
    this.transition = new ViewerTransition(root)
    this.counter.className = 'shokax-viewer-counter'
    this.counter.setAttribute('aria-live', 'polite')
    this.counter.setAttribute('aria-atomic', 'true')
    root.append(this.counter)
  }

  view(image: HTMLImageElement, index: number) {
    this.transition.prepare(image, index)
    this.updateNavigation(index)
  }

  viewed(image: HTMLImageElement, index: number) {
    this.transition.show(image)
    this.thumbnails.select(index)
    this.counter.textContent = this.locale.counter.replace('{index}', String(index + 1)).replace('{total}', String(this.images.length))
  }

  private updateNavigation(index: number) {
    for (const [action, disabled] of [['prev', index === 0], ['next', index === this.images.length - 1]] as const) {
      const button = this.root.querySelector<HTMLElement>(`.viewer-navigation [data-viewer-action="${action}"]`)
      button?.setAttribute('aria-disabled', String(disabled))
    }
  }

  reset() {
    this.transition.reset()
    this.thumbnails.reset()
  }

  destroy() {
    this.abort.abort()
    this.transition.destroy()
    this.thumbnails.destroy()
    this.counter.remove()
  }
}
