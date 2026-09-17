import Viewer from 'viewerjs'
import 'viewerjs/dist/viewer.css'
import { ImageViewerGallery } from '../components/imageviewer'

let viewer: Viewer | undefined
let article: HTMLElement | undefined
let gallery: ImageViewerGallery | undefined

const preventImageLinkNavigation = (event: MouseEvent) => {
  const image = event.target
  if (image instanceof HTMLImageElement && image.classList.contains('shokax-image-viewer') && image.closest('a')) {
    event.preventDefault()
  }
}

export const postImageViewer = (p: string) => {
  gallery?.destroy()
  gallery = undefined
  viewer?.destroy()
  article?.removeEventListener('click', preventImageLinkNavigation, true)
  viewer = undefined
  article = document.querySelector<HTMLElement>(`${p} .md`) || undefined
  if (!article) return

  article.querySelectorAll<HTMLImageElement>('img:not(.emoji):not(.vemoji)').forEach((img) => {
    const parentLink = img.closest('a')
    if (!parentLink || parentLink.href === img.src) img.classList.add('shokax-image-viewer')
  })

  article.addEventListener('click', preventImageLinkNavigation, true)
  const images = Array.from(article.querySelectorAll<HTMLImageElement>('img.shokax-image-viewer'))
  viewer = new Viewer(article, {
    className: 'shokax-post-viewer',
    ready: () => {
      gallery = new ImageViewerGallery(document.querySelector('.shokax-post-viewer'), images, viewer, LOCAL.imageViewer)
    },
    show: () => {
      // Viewer.js sets index before show, but emits view only after the opening
      // transition. Sync while the container is still hidden, including reopen.
      gallery?.updateNavigation((viewer as Viewer & { index: number }).index)
    },
    filter: (image) => image.classList.contains('shokax-image-viewer'),
    url: (image) => image.currentSrc || image.src,
    navbar: false,
    navigation: true,
    // Viewer.js 1.14.0 preloads images[-1] at non-looping gallery boundaries.
    preload: false,
    slideOnTouch: true,
    zoomOnTouch: true,
    toolbar: {
      zoomIn: true,
      zoomOut: true,
      oneToOne: true,
      reset: true,
      rotateLeft: true,
      rotateRight: true
    },
    // Delegate slide transitions while keeping native zoom, rotation and touch handling.
    transition: { view: false, hide: false },
    view: (event) => {
      gallery?.view(event.detail.image, event.detail.index)
    },
    viewed: (event) => {
      gallery?.viewed(event.detail.image, event.detail.index)
    },
    hide: () => gallery?.reset(),
    loop: false
  })
}
