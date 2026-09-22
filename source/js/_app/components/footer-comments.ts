import { createImageMedia } from './image-media'
import { formatCommentTime } from './comment-time'

interface FooterCommentTimeOptions {
  relativeTimeDays: number
  locale: Parameters<typeof formatCommentTime>[3]
}
const timeOptions = new WeakMap<HTMLElement, FooterCommentTimeOptions>()
let timeTimer: ReturnType<typeof setInterval> | undefined

let media: ReturnType<typeof createImageMedia> | undefined
let mediaContainer: HTMLElement | undefined

const destroyFooterMedia = () => {
  clearInterval(timeTimer)
  timeTimer = undefined
  media?.destroy()
  media = undefined
  mediaContainer = undefined
}
document.addEventListener('pjax:send', destroyFooterMedia)

export const refreshFooterCommentMedia = () => {
  const container = document.getElementById('new-comment') || undefined
  if (container !== mediaContainer) {
    destroyFooterMedia()
    mediaContainer = container
    if (container) media = createImageMedia(container, { selector: '.footer-comment-avatar img' })
  }
  media?.sync()
  clearInterval(timeTimer)
  timeTimer = undefined
  const options = container && timeOptions.get(container)
  if (container && options) {
    const dates = Array.from(container.querySelectorAll<HTMLTimeElement>('time[data-comment-time]'))
    const update = () => dates.forEach(time => {
      const value = formatCommentTime(Number(time.dataset.commentTime), Date.now(), options.relativeTimeDays, options.locale)
      if (time.textContent !== value) time.textContent = value
    })
    update()
    if (dates.length) timeTimer = setInterval(update, 1000)
  }
}

export interface FooterComment {
  nick: string
  text: string
  url: string
  id: string
  avatar?: string
  time?: number
  badge?: { text: string; kind: 'author' | 'member' | 'friend' }
}

export const renderFooterComments = (container: HTMLElement, rows: FooterComment[], options?: FooterCommentTimeOptions) => {
  if (options) timeOptions.set(container, options)
  else timeOptions.delete(container)
  const fragment = document.createDocumentFragment()
  for (const item of rows.slice(0, Number(container.dataset.limit) || 3)) {
    const target = new URL(item.url || '/', shokax_siteURL)
    // A comment's page must stay on this blog, even if the service returns a full URL.
    if (target.origin !== new URL(shokax_siteURL).origin) continue
    const li = document.createElement('li')
    const link = document.createElement('a')
    link.className = 'footer-comment-link'
    link.href = target.pathname + target.search + '#' + encodeURIComponent(item.id)
    const avatar = document.createElement('span')
    avatar.className = 'footer-comment-avatar'
    avatar.setAttribute('aria-hidden', 'true')
    avatar.textContent = Array.from(item.nick || '?')[0]
    if (item.avatar && /^https?:\/\//i.test(item.avatar)) {
      const img = document.createElement('img')
      img.alt = ''
      img.loading = 'lazy'
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.src = item.avatar
      img.addEventListener('error', () => { img.remove(); avatar.textContent = Array.from(item.nick || '?')[0] }, { once: true })
      avatar.replaceChildren(img)
    }
    const body = document.createElement('span')
    body.className = 'footer-comment-body'
    const head = document.createElement('span')
    head.className = 'footer-comment-head'
    const name = document.createElement('span')
    name.className = 'footer-comment-name'
    name.textContent = item.nick
    head.append(name)
    if (item.badge) {
      const badge = document.createElement('span')
      badge.className = `footer-comment-badge footer-comment-badge-${item.badge.kind}`
      badge.textContent = item.badge.text
      head.append(badge)
    }
    if (options && typeof item.time === 'number' && Number.isFinite(new Date(item.time).getTime())) {
      const time = document.createElement('time')
      time.className = 'footer-comment-time'
      time.dataset.commentTime = String(item.time)
      time.dateTime = new Date(item.time).toISOString()
      time.title = new Date(item.time).toLocaleString(document.documentElement.lang || undefined)
      time.setAttribute('aria-live', 'off')
      head.append(time)
    }
    const text = document.createElement('span')
    text.className = 'footer-comment-text'
    text.textContent = item.text
    body.append(head, text)
    link.append(avatar, body)
    li.append(link)
    fragment.append(li)
  }
  container.replaceChildren(fragment)
  if (!container.children.length) footerCommentState(container, 'empty')
  container.dataset.loaded = 'true'
  refreshFooterCommentMedia()
}

export const footerCommentState = (container: HTMLElement, state: 'empty' | 'error') => {
  timeOptions.delete(container)
  const li = document.createElement('li')
  li.className = 'footer-comment-state'
  li.textContent = container.dataset[state] || ''
  container.replaceChildren(li)
  refreshFooterCommentMedia()
}
