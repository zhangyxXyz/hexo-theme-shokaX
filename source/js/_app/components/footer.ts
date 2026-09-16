let uptimeTimer: ReturnType<typeof setInterval> | undefined
let visitorsLoaded = false

export const refreshFooter = () => {
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
      uptime.textContent = (uptime.dataset.format || '').replace(/\{(days|hours|minutes|seconds)\}/g, (_, key: keyof typeof values) => values[key])
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
