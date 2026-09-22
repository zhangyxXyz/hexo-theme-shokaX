import { createImageMedia } from '../components/image-media'

let article: HTMLElement | undefined
let media: ReturnType<typeof createImageMedia> | undefined
let observer: MutationObserver | undefined

const destroyPostMedia = () => {
  observer?.disconnect()
  observer = undefined
  media?.destroy()
  media = undefined
  article = undefined
}
document.addEventListener('pjax:send', destroyPostMedia)

export const refreshPostMedia = () => {
  const current = document.querySelector<HTMLElement>('.post.block .md') || undefined
  if (current !== article) {
    destroyPostMedia()
    article = current
    if (article) {
      media = createImageMedia(article, { selector: 'img:not(.emoji):not(.vemoji)' })
      // Decrypted sections and responsive image sources may arrive after setup.
      observer = new MutationObserver(() => media?.sync())
      observer.observe(article, {
        subtree: true, childList: true, attributes: true,
        attributeFilter: ['src', 'srcset', 'sizes', 'media', 'type']
      })
    }
  }
  media?.sync()
}
