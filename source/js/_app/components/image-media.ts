const revealedSources = new Set<string>()
const rememberedLimit = 512

// This is a bounded record of successful resources in this page session, not an
// HTTP-cache detector. Fast loads after a full refresh use the grace period.
const remember = (source: string) => {
  if (!source) return
  revealedSources.delete(source)
  revealedSources.add(source)
  if (revealedSources.size > rememberedLimit) revealedSources.delete(revealedSources.values().next().value)
}

const configuration = (image: HTMLImageElement) => JSON.stringify([
  image.src, image.srcset, image.sizes,
  Array.from(image.closest('picture')?.querySelectorAll('source') || []).map(source => [
    source.srcset, source.sizes, source.media, source.type
  ])
])
const responsive = (image: HTMLImageElement) => !!image.srcset || !!image.closest('picture')
const resource = (image: HTMLImageElement) => responsive(image)
  ? image.currentSrc ? `${configuration(image)}|${image.currentSrc}` : ''
  : image.src

// Loading failures and cancellation must never leave an image permanently veiled.
export function waitImage(image: HTMLImageElement, signal: AbortSignal, timeout = 8000): Promise<boolean> {
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

interface MediaOptions {
  selector: string
  warmSelector?: string
}
interface MediaRecord {
  source: string
  selected: string
  controller: AbortController
  started: boolean
  settled: boolean
  start?: () => void
}

export function createImageMedia(container: HTMLElement, options: MediaOptions) {
  const records = new Map<HTMLImageElement, MediaRecord>()
  let destroyed = false
  const intersection = typeof IntersectionObserver === 'undefined' ? undefined : new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) records.get(entry.target as HTMLImageElement)?.start?.()
  }, { rootMargin: '300px' })
  const remove = (image: HTMLImageElement) => {
    intersection?.unobserve(image)
    records.get(image)?.controller.abort()
    records.delete(image)
    image.classList.remove('comment-media-pending', 'comment-media-ready')
  }
  const sync = () => {
    if (destroyed) return
    for (const image of records.keys()) if (!container.contains(image)) remove(image)
    if (options.warmSelector) container.querySelectorAll<HTMLImageElement>(options.warmSelector).forEach(image => {
      if (image.complete && image.naturalWidth > 0) remember(resource(image))
    })
    container.querySelectorAll<HTMLImageElement>(options.selector).forEach(image => {
      const source = configuration(image)
      const previous = records.get(image)
      if (previous?.source === source && (!previous.settled || previous.selected === image.currentSrc)) return
      remove(image)
      const controller = new AbortController()
      const record: MediaRecord = { source, selected: image.currentSrc, controller, started: false, settled: false }
      records.set(image, record)
      if (image.complete && image.naturalWidth > 0) {
        remember(resource(image))
        record.settled = true
        return
      }
      // currentSrc may still describe the old candidate while a responsive image
      // switches sources. Only complete images can take that fast path safely.
      if (!responsive(image) && revealedSources.has(resource(image))) {
        record.settled = true
        return
      }
      if (!image.src && !responsive(image)) return
      let grace: ReturnType<typeof setTimeout> | undefined
      let pending = false
      const start = () => {
        if (record.started || controller.signal.aborted) return
        record.started = true
        intersection?.unobserve(image)
        image.removeEventListener('load', start)
        image.removeEventListener('error', failedBeforeStart)
        grace = setTimeout(() => {
          pending = true
          image.classList.add('comment-media-pending')
        }, 100)
        void waitImage(image, controller.signal).then(ready => {
          clearTimeout(grace)
          if (controller.signal.aborted) return
          if (configuration(image) !== source) { sync(); return }
          record.settled = true
          record.selected = image.currentSrc
          image.classList.remove('comment-media-pending')
          if (!ready) return
          const key = resource(image)
          const alreadyRevealed = !!key && revealedSources.has(key)
          remember(key)
          if (pending && !alreadyRevealed) {
            image.classList.add('comment-media-ready')
            image.addEventListener('animationend', event => {
              if (event.animationName === 'comment-media-reveal') image.classList.remove('comment-media-ready')
            }, { signal: controller.signal })
          }
        })
      }
      const failedBeforeStart = () => {
        intersection?.unobserve(image)
        image.removeEventListener('load', start)
        record.started = true
        record.settled = true
      }
      record.start = start
      controller.signal.addEventListener('abort', () => {
        clearTimeout(grace)
        image.removeEventListener('load', start)
        image.removeEventListener('error', failedBeforeStart)
      }, { once: true })
      if (image.loading === 'lazy' && intersection && !image.complete) {
        // Native lazy loading may finish before our visibility callback. Either
        // event starts observation; offscreen time does not consume the timeout.
        image.addEventListener('load', start)
        image.addEventListener('error', failedBeforeStart, { once: true })
        intersection.observe(image)
      } else start()
    })
  }
  return {
    sync,
    destroy() {
      destroyed = true
      intersection?.disconnect()
      for (const image of records.keys()) remove(image)
    }
  }
}
