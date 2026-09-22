let uptimeTimer: ReturnType<typeof setInterval> | undefined
let visitorsLoaded = false
let footerEvents: AbortController | undefined

const refreshDiscovery = () => {
  footerEvents?.abort()
  footerEvents = new AbortController()
  const { signal } = footerEvents
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
  const tags = Array.from(document.querySelectorAll<HTMLElement>('#footer-tags .footer-tag'))
  document.querySelector('[data-footer-shuffle]')?.addEventListener('click', () => {
    // Prefer hidden tags so a small tag pool still visibly changes each time.
    const shuffled = tags.filter(tag => tag.hidden)
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const visible = new Set([...shuffled, ...tags.filter(tag => !tag.hidden)].slice(0, 6))
    tags.forEach(tag => { tag.hidden = !visible.has(tag) })
  }, { signal })
}

export const refreshFooter = () => {
  refreshDiscovery()
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

  const visitors = document.querySelector<HTMLElement>('.footer-visitors')
  if (!visitors || visitorsLoaded) return
  const site = new URL(visitors.dataset.siteUrl, location.href)
  if (location.hostname !== site.hostname || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) return
  const script = document.createElement('script')
  script.src = visitors.dataset.script
  script.async = true
  script.onerror = () => { visitorsLoaded = false; script.remove() }
  script.onload = () => document.getElementById('busuanzi_value_site_uv')?.removeAttribute('title')
  visitorsLoaded = true
  document.head.appendChild(script)
}
