import { siteRefresh } from './refresh'
import { pagePosition } from '../globals/tools'
import { menuToggle, sideBar } from '../globals/globalVars'
import { trackBaiduPageview } from '../components/analytics'
import { Loader } from '../globals/thirdparty'
import { cancelPageEntry, playPageEntry } from '../components/page-entry'

const regions = ['#brand > .pjax', '#imgs', '#main', '#sidebar .contents.panel', '#sidebar .related.panel', '#quick .prev', '#quick .next']
const metadata = 'meta[name="description"], meta[name="keywords"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"]'
const executable = (script: HTMLScriptElement) => !script.type || /^(?:text|application)\/javascript$|^module$/.test(script.type)
const pageKey = (url: URL) => url.origin + url.pathname + url.search
type Position = [number, number]
type NavigationState = { url: string; position: Position }

export function navigationTarget(link: HTMLAnchorElement | SVGAElement, event: MouseEvent, current: URL): URL | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  const target = link.getAttribute('target')
  if (link.hasAttribute('download') || (target && target !== '_self') || link.closest('[data-pjax="false"], [data-no-pjax]')) return null
  const url = new URL(link.getAttribute('href'), current)
  if (!/^https?:$/.test(url.protocol) || url.origin !== current.origin || pageKey(url) === pageKey(current)) return null
  // Keep native handling of feeds, images and other downloads.
  if (/\.[^/]+$/.test(url.pathname) && !/\.html?$/i.test(url.pathname)) return null
  return url
}

function copyRegion(current: Element, next: Element) {
  for (const attribute of Array.from(current.attributes)) current.removeAttribute(attribute.name)
  for (const attribute of Array.from(next.attributes)) current.setAttribute(attribute.name, attribute.value)
  current.replaceChildren(...Array.from(next.childNodes))
}

async function executeScript(source: HTMLScriptElement, base: string): Promise<void> {
  const script = document.createElement('script')
  for (const attribute of Array.from(source.attributes)) script.setAttribute(attribute.name, attribute.value)
  script.textContent = source.textContent
  if (source.hasAttribute('src') || source.type === 'module') {
    if (source.hasAttribute('src')) script.src = new URL(source.getAttribute('src'), base).href
    script.async = false
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { script.remove(); reject(new Error('Page script timed out')) }, 15000)
      script.onload = () => { clearTimeout(timer); script.remove(); resolve() }
      script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('Page script failed')) }
      if (document.contains(source)) source.replaceWith(script)
      else document.body.append(script)
    })
  } else {
    if (document.contains(source)) source.replaceWith(script)
    else document.body.append(script)
    script.remove()
  }
}

async function loadStyles(next: Document, base: string, signal: AbortSignal) {
  const existing = new Set(Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(link => link.href))
  await Promise.all(Array.from(next.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(link => {
    const href = new URL(link.getAttribute('href'), base).href
    if (existing.has(href)) return
    existing.add(href)
    return new Promise<void>((resolve, reject) => {
      const element = link.cloneNode() as HTMLLinkElement
      element.href = href
      const finish = (error?: Error) => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
        if (error) { element.remove(); reject(error) } else resolve()
      }
      const abort = () => finish(new DOMException('Navigation superseded', 'AbortError'))
      const timer = setTimeout(() => finish(new Error('Page stylesheet timed out')), 15000)
      element.onload = () => {
        // Theme styles use media=none/onload for deferred CSS on full loads.
        if (element.media === 'none') element.media = 'all'
        finish()
      }
      element.onerror = () => finish(new Error('Page stylesheet failed'))
      signal.addEventListener('abort', abort, { once: true })
      document.head.append(element)
    })
  }))
}

export function initNavigation() {
  if (document.documentElement.dataset.pjax === 'false') return
  let loaded = new URL(location.href)
  let request: AbortController | undefined
  let revision = 0
  let commit = Promise.resolve()
  let positionTimer: ReturnType<typeof setTimeout>
  const savePosition = () => {
    if (pageKey(loaded) !== pageKey(new URL(location.href))) return
    const value: NavigationState = { url: location.href, position: [scrollX, scrollY] }
    history.replaceState({ ...history.state, shokaxNavigation: value }, '', location.href)
  }
  savePosition()
  history.scrollRestoration = 'manual'
  window.addEventListener('scroll', () => {
    clearTimeout(positionTimer)
    positionTimer = setTimeout(savePosition, 100)
  }, { passive: true })

  const navigate = async (url: URL, restored?: Position) => {
    cancelPageEntry()
    const loaderToken = Loader.show('navigation')
    const token = ++revision
    request?.abort()
    request = new AbortController()
    const { signal } = request
    const controller = request
    const timeout = setTimeout(() => controller.abort(), 15000)
    let succeeded = false
    document.documentElement.classList.add('pjax-loading')
    document.getElementById('main')?.setAttribute('aria-busy', 'true')
    try {
      const response = await fetch(url.href, { signal, headers: { Accept: 'text/html' } })
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) throw new Error('Not a page response')
      const target = new URL(response.url)
      target.hash = url.hash
      const next = new DOMParser().parseFromString(await response.text(), 'text/html')
      clearTimeout(timeout)
      if (target.origin !== location.origin || next.documentElement.dataset.pjax === 'false') throw new Error('Native navigation required')
      const config = next.querySelector<HTMLScriptElement>('script[data-config]')
      if (!config || regions.some(selector => !next.querySelector(selector) || !document.querySelector(selector))) throw new Error('Incompatible page layout')
      await loadStyles(next, target.href, signal)
      if (signal.aborted || token !== revision) return

      // Fetches may race; DOM commits and page initializers must stay ordered.
      commit = commit.catch(() => {}).then(async () => {
        if (signal.aborted || token !== revision) return
        const scripts = Array.from(next.querySelectorAll<HTMLScriptElement>(regions.map(selector => `${selector} script`).join(','))).filter(executable)
        // hexo-blog-encrypt's IIFE needs to bind each new password form.
        for (const script of next.querySelectorAll<HTMLScriptElement>('script[src]')) {
          if (/\/lib\/hbe\.[^/]+\.js$/.test(new URL(script.getAttribute('src'), target.href).pathname) && !scripts.includes(script)) scripts.push(script)
        }
        pagePosition()
        if (!restored) savePosition()
        document.dispatchEvent(new Event('pjax:send'))
        document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(dialog => dialog.close())
        sideBar.classList.remove('on')
        menuToggle.classList.remove('close')
        sideBar.style.cssText = ''
        if (!restored) history.pushState({ shokaxNavigation: { url: target.href, position: [0, 0] } }, '', target.href)
        loaded = target
        document.title = next.title
        document.documentElement.lang = next.documentElement.lang
        document.head.querySelectorAll(metadata).forEach(element => element.remove())
        next.head.querySelectorAll(metadata).forEach(element => document.head.append(element.cloneNode(true)))
        for (const selector of regions) {
          if (selector === '#main') document.querySelector(selector).replaceWith(next.querySelector(selector))
          else copyRegion(document.querySelector(selector), next.querySelector(selector))
        }
        // LOCAL is the theme's existing per-page global. Only this script is
        // re-executed; the application bundle, player and toolbar stay mounted.
        const currentConfig = document.querySelector('script[data-config]')
        currentConfig.textContent = config.textContent
        await executeScript(config, target.href)
        const isCurrent = () => token === revision && pageKey(target) === pageKey(new URL(location.href))
        await siteRefresh(0, restored, isCurrent)
        for (const script of scripts) {
          if (!isCurrent()) return
          await executeScript(script, target.href)
        }
        if (!isCurrent()) return
        const main = document.getElementById('main')
        if (!main.contains(document.activeElement)) {
          main.setAttribute('tabindex', '-1')
          main.focus({ preventScroll: true })
        }
        trackBaiduPageview()
        document.dispatchEvent(new Event('pjax:complete'))
      })
      await commit
      succeeded = token === revision
    } catch (error) {
      if (token === revision) {
        console.warn('[ShokaX navigation] Falling back to a full page load', error)
        location.assign(url.href)
      }
    } finally {
      clearTimeout(timeout)
      if (token === revision) {
        Loader.hide(loaderToken, succeeded ? () => playPageEntry(!location.hash && !restored) : undefined)
        document.documentElement.classList.remove('pjax-loading')
        document.getElementById('main')?.removeAttribute('aria-busy')
      }
    }
  }

  document.addEventListener('click', (event: MouseEvent) => {
    const link = (event.target as Element)?.closest<HTMLAnchorElement>('a[href]')
    if (!link) return
    const target = navigationTarget(link, event, new URL(location.href))
    if (!target) return
    event.preventDefault()
    void navigate(target)
  })
  window.addEventListener('popstate', event => {
    const target = new URL(location.href)
    const state = event.state?.shokaxNavigation as NavigationState | undefined
    if (pageKey(target) === pageKey(loaded)) {
      cancelPageEntry()
      Loader.vanish()
      ++revision
      request?.abort()
      loaded = target
      document.documentElement.classList.remove('pjax-loading')
      document.getElementById('main')?.removeAttribute('aria-busy')
      if (state?.url === target.href) {
        window.scrollTo({ left: state.position[0], top: state.position[1], behavior: 'instant' })
      } else if (target.hash) {
        try { document.getElementById(decodeURIComponent(target.hash.slice(1)))?.scrollIntoView() } catch { /* Invalid hash. */ }
      } else window.scrollTo({ left: 0, top: 0, behavior: 'instant' })
      return
    }
    void navigate(target, state?.position ?? [0, 0])
  })
}
