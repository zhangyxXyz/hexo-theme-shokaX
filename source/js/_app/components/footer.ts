import { observeVisitorCount } from './footer-visitors'
import { refreshFooterCommentMedia } from './footer-comments'

let uptimeTimer: ReturnType<typeof setInterval> | undefined
let footerEvents: AbortController | undefined

const refreshDiscovery = () => {
  footerEvents?.abort()
  footerEvents = new AbortController()
  const { signal } = footerEvents
  const visitors = document.querySelector<HTMLElement>('.footer-visitors')
  if (visitors) observeVisitorCount(visitors, signal)
  const random = document.querySelector<HTMLAnchorElement>('[data-footer-random]')
  if (random) {
    const canonical = (path: string) => path.replace(/\/index\.html$/, '/').replace(/\/$/, '')
    const paths: string[] = JSON.parse(random.dataset.footerRandom || '[]')
    const candidates = paths.filter(path => canonical(new URL(path, location.href).pathname) !== canonical(location.pathname))
    random.hidden = candidates.length === 0
    const pick = () => {
      if (candidates.length) random.href = candidates[Math.floor(Math.random() * candidates.length)]
    }
    pick()
    // Keep native link navigation, including modifier clicks and PJAX interception.
    random.addEventListener('click', pick, { signal })
  }
  const articleList = document.querySelector<HTMLElement>('#footer-article-list')
  const shufflePosts = document.querySelector<HTMLButtonElement>('[data-footer-post-shuffle]')
  if (articleList && shufflePosts) {
    const posts: { url: string; title: string; category: string }[] = JSON.parse(articleList.dataset.posts || '[]')
    const links = Array.from(articleList.querySelectorAll<HTMLAnchorElement>('li > a'))
    shufflePosts.addEventListener('click', () => {
      const shown = new Set(links.map(link => link.getAttribute('href')))
      const remaining = posts.filter(post => !shown.has(post.url))
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
      }
      const picks = [...remaining, ...posts.filter(post => shown.has(post.url))].slice(0, links.length)
      links.forEach((link, index) => {
        const post = picks[index]
        if (!post) return
        link.setAttribute('href', post.url)
        link.title = post.title
        link.querySelector<HTMLElement>('.footer-article-title')!.textContent = post.title
        const body = link.querySelector<HTMLElement>('.footer-article-body')!
        let category = body.querySelector('small')
        if (post.category) {
          if (!category) { category = document.createElement('small'); body.append(category) }
          category.textContent = post.category
        } else category?.remove()
      })
    }, { signal })
  }
  const tags = Array.from(document.querySelectorAll<HTMLElement>('#footer-tags .footer-tag'))
  const tagLimit = Number(document.querySelector<HTMLElement>('#footer-tags')?.dataset.limit) || 6
  document.querySelector('[data-footer-shuffle]')?.addEventListener('click', () => {
    // Prefer hidden tags so a small tag pool still visibly changes each time.
    const shuffled = tags.filter(tag => tag.hidden)
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const visible = new Set([...shuffled, ...tags.filter(tag => !tag.hidden)].slice(0, tagLimit))
    tags.forEach(tag => { tag.hidden = !visible.has(tag) })
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tags.filter(tag => !tag.hidden).forEach((tag, index) => {
        tag.getAnimations().forEach(animation => animation.cancel())
        tag.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }], {
          duration: 220, delay: index * 25, easing: 'ease-out', fill: 'backwards'
        })
      })
    }
  }, { signal })
}

export const refreshFooter = () => {
  refreshDiscovery()
  refreshFooterCommentMedia()
  if (uptimeTimer) clearInterval(uptimeTimer)
  uptimeTimer = undefined
  const uptime = document.querySelector<HTMLElement>('[data-uptime]')
  const started = Date.parse(uptime?.dataset.uptime || '')
  if (uptime && Number.isFinite(started)) {
    const update = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - started) / 1000))
      const values = {
        days: String(Math.floor(seconds / 86400)),
        hours: String(Math.floor(seconds / 3600) % 24).padStart(2, '0'),
        minutes: String(Math.floor(seconds / 60) % 60).padStart(2, '0'),
        seconds: String(seconds % 60).padStart(2, '0')
      }
      const format = (value: string) => value.replace(/\{(days|hours|minutes|seconds)\}/g, (_, key: keyof typeof values) => values[key])
      const days = uptime.querySelector<HTMLElement>('[data-uptime-days]')
      const clock = uptime.querySelector<HTMLElement>('[data-uptime-clock]')
      if (days && clock) {
        days.textContent = values.days
        clock.textContent = format(clock.dataset.format || '')
        uptime.setAttribute('aria-label', format(uptime.dataset.format || ''))
      } else {
        uptime.textContent = format(uptime.dataset.format || '')
      }
    }
    update()
    uptimeTimer = setInterval(update, 1000)
  }

}
