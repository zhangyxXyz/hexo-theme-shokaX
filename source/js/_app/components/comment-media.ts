// Loading failures and cancellation must never leave an image permanently veiled.
export function waitCommentImage(image: HTMLImageElement, signal: AbortSignal, timeout = 8000): Promise<boolean> {
  return new Promise(resolve => {
    let finished = false
    const finish = (ready: boolean) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      image.removeEventListener('load', loaded)
      image.removeEventListener('error', failed)
      signal.removeEventListener('abort', failed)
      resolve(ready)
    }
    const failed = () => finish(false)
    const loaded = () => {
      if (!image.naturalWidth) return failed()
      void image.decode().then(() => finish(true), failed)
    }
    const timer = setTimeout(failed, timeout)
    image.addEventListener('load', loaded)
    image.addEventListener('error', failed)
    signal.addEventListener('abort', failed, { once: true })
    if (signal.aborted) failed()
    else if (image.complete) loaded()
  })
}

export function createCommentMedia(container: HTMLElement) {
  const records = new Map<HTMLImageElement, { source: string; controller: AbortController }>()
  // Preview edits can replace DOM nodes without changing the loaded resource.
  const revealedSources = new Set<string>()
  const remove = (image: HTMLImageElement) => {
    records.get(image)?.controller.abort()
    records.delete(image)
    image.classList.remove('comment-media-pending', 'comment-media-ready')
  }
  return {
    sync() {
      for (const image of records.keys()) if (!container.contains(image)) remove(image)
      container.querySelectorAll<HTMLImageElement>('.wl-emoji-popup img').forEach(image => {
        if (image.complete && image.naturalWidth > 0) revealedSources.add(`${image.src}|${image.srcset}`)
      })
      container.querySelectorAll<HTMLImageElement>('.wl-user img, .wl-content img').forEach(image => {
        const source = `${image.src}|${image.srcset}`
        if (records.get(image)?.source === source) return
        remove(image)
        const controller = new AbortController()
        records.set(image, { source, controller })
        if (revealedSources.has(source)) return
        if (image.complete && image.naturalWidth > 0) {
          revealedSources.add(source)
          return
        }
        image.classList.add('comment-media-pending')
        void waitCommentImage(image, controller.signal).then(ready => {
          if (controller.signal.aborted) return
          image.classList.remove('comment-media-pending')
          if (ready) {
            revealedSources.add(source)
            image.classList.add('comment-media-ready')
          }
        })
      })
    },
    destroy() {
      for (const image of records.keys()) remove(image)
      revealedSources.clear()
    }
  }
}
