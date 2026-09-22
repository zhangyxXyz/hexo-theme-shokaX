import { createImageMedia } from './image-media'

export { waitImage as waitCommentImage } from './image-media'

export function createCommentMedia(container: HTMLElement) {
  return createImageMedia(container, {
    selector: '.wl-user img, .wl-content img',
    warmSelector: '.wl-emoji-popup img'
  })
}
