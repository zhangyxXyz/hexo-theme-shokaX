import { loadCommentList } from './comments'
import { restoreModalFocus } from '../input-modality'
import type { ContentItem, Settings } from './types'
import { CONFIG } from '../../globals/globalVars'
import { defaultLocales } from '@waline/client'
import { formatCommentRegion } from '../comment-region'
import { renderCommentMarkup } from './comment-markup'
import { createCommentMarkdown } from '../comment-markdown'

const safeLink = (value?: string) => {
  try { const url = new URL(value || ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : '' } catch { return '' }
}
const badge = (label: string, override?: { light?: Record<string, string>; dark?: Record<string, string> }, server?: { light?: Record<string, string>; dark?: Record<string, string> }) => {
  const element = document.createElement('span')
  element.className = 'statistics-comment-badge'
  const text = document.createElement('span')
  text.textContent = label
  element.append(text)
  const valid = (value?: string) => typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(value) ? value : undefined
  for (const mode of ['light', 'dark'] as const) for (const key of ['text', 'background', 'border']) {
    const color = valid(override?.[mode]?.[key]) ?? valid(server?.[mode]?.[key])
    if (color) element.style.setProperty(`--badge-${mode}-${key}`, color)
  }
  return element
}

export function commentContent(config: Settings, value: string): ContentItem | undefined {
  const content = config.data.content || []
  try {
    const base = content[0]?.url || location.origin
    const url = new URL(value, base)
    const canonical = (path: string) => decodeURI(path).replace(/\/index\.html$/, '/').replace(/\/$/, '')
    return content.find(item => {
      const known = new URL(item.url)
      return ['http:', 'https:'].includes(url.protocol) && url.host === known.host && canonical(url.pathname) === canonical(known.pathname)
    })
  } catch { return undefined }
}

export function createCommentList(config: Settings, signal: AbortSignal) {
  // Load after the shared application module has initialized. Awaiting this at
  // module scope can deadlock the CSS chunk's shared-module import cycle.
  // @ts-expect-error Waline's CSS-only export has no TypeScript declaration.
  void import('@waline/client/meta')
  const labels = config.labels
  const dialog = document.createElement('dialog')
  dialog.className = 'statistics-comments-dialog'
  dialog.setAttribute('aria-label', labels.comment_list)
  const header = document.createElement('header')
  const title = document.createElement('h2')
  const count = document.createElement('span')
  const close = document.createElement('button')
  close.type = 'button'
  close.className = 'statistics-comments-close'
  close.setAttribute('aria-label', labels.comment_close)
  const icon = document.createElement('i')
  icon.className = 'ic i-times'
  icon.setAttribute('aria-hidden', 'true')
  close.append(icon)
  header.append(title, count, close)
  const body = document.createElement('div')
  body.className = 'statistics-comments-body'
  const list = document.createElement('ol')
  const status = document.createElement('p')
  status.setAttribute('role', 'status')
  const more = document.createElement('button')
  more.type = 'button'
  body.append(list, status, more)
  dialog.append(header, body)
  document.body.append(dialog)
  let markdown = createCommentMarkdown(list, '.statistics-comment-excerpt')
  let request: AbortController | undefined
  let trigger: HTMLElement | null = null
  let overflow: string | undefined
  let page = 1
  let filter: { author?: string; url?: string } = {}
  let loading = false, hasMore = false
  const finish = (focus = true) => {
    request?.abort()
    if (dialog.open) dialog.close()
    if (overflow !== undefined) document.body.style.overflow = overflow
    overflow = undefined
    if (focus && trigger?.isConnected) restoreModalFocus(trigger, false)
  }
  close.onclick = () => finish()
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish() }, { signal })
  let backdrop = false
  const outside = (event: MouseEvent) => {
    const rect = dialog.getBoundingClientRect()
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
  }
  dialog.addEventListener('pointerdown', event => { backdrop = outside(event) }, { signal })
  dialog.addEventListener('click', event => { if (backdrop && outside(event)) finish(); backdrop = false }, { signal })
  const load = async () => {
    if (loading) return
    loading = true
    const current = request = new AbortController()
    const timer = setTimeout(() => current.abort(), 15000)
    status.textContent = labels.loading
    more.hidden = true
    try {
      const data = await loadCommentList(config, filter, page, current.signal)
      if (current.signal.aborted || request !== current) return
      count.textContent = labels.comment_total.replace('{count}', String(data.total))
      for (const item of data.items) {
        const row = document.createElement('li')
        // Chronological rows keep pagination stable; sides alternate without reshuffling.
        row.style.gridRow = String(list.children.length + 1)
        const meta = document.createElement('div')
        meta.className = 'statistics-comment-meta'
        const avatar = document.createElement('span')
        avatar.className = 'statistics-comment-avatar'
        avatar.setAttribute('aria-hidden', 'true')
        avatar.textContent = Array.from(item.nick || '?')[0]
        if (typeof item.avatar === 'string' && /^https?:\/\//i.test(item.avatar)) {
          const image = document.createElement('img')
          image.alt = ''; image.loading = 'lazy'; image.referrerPolicy = 'no-referrer'
          image.src = item.avatar
          image.addEventListener('error', () => image.remove(), { once: true })
          avatar.append(image)
        }
        const siteURL = safeLink(item.link)
        const name = document.createElement(siteURL ? 'a' : 'strong')
        name.className = 'statistics-comment-name'
        if (siteURL) {
          ;(name as HTMLAnchorElement).href = siteURL
          ;(name as HTMLAnchorElement).target = '_blank'
          ;(name as HTMLAnchorElement).rel = 'ugc nofollow noreferrer noopener'
          name.title = siteURL
        }
        name.textContent = item.nick || labels.comment_anonymous
        const identity = document.createElement('div')
        identity.className = 'statistics-comment-identity'
        identity.append(name)
        if (item.label) identity.append(badge(item.label, CONFIG.waline.labelColors?.[item.label], item.labelColors))
        if (typeof item.level === 'number') {
          const key = `level${item.level}`
          const locale = { ...(defaultLocales[(CONFIG.waline.lang || 'en-US').toLowerCase() as keyof typeof defaultLocales] || defaultLocales['en-us']) } as Record<string, string>
          const overrides = CONFIG.waline.locale as Record<string, string>
          identity.append(badge(overrides?.[key] ?? item.levelLabel ?? locale[key] ?? `Level ${item.level}`, CONFIG.waline.levelColors?.[key], item.levelColors))
        }
        const time = document.createElement('time')
        const date = new Date(item.time)
        time.textContent = Number.isNaN(date.getTime()) ? labels.comment_unknown_date : date.toLocaleString(document.documentElement.lang || undefined)
        if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString()
        identity.append(time)
        meta.append(avatar, identity)
        const details = document.createElement('div')
        details.className = 'statistics-comment-details wl-meta'
        for (const [kind, text] of [['addr', item.addr], ['browser', item.browser], ['os', item.os]]) {
          if (!text) continue
          const chip = document.createElement('span')
          chip.className = `wl-${kind}`
          chip.dataset.value = text
          chip.textContent = kind === 'addr' ? formatCommentRegion(text, '{region}') : text
          details.append(chip)
        }
        const known = commentContent(config, item.url)
        const content = document.createElement('div')
        content.className = 'statistics-comment-excerpt md'
        const markup = renderCommentMarkup(item.comment || '')
        content.append(markup.textContent?.trim() || markup.querySelector('img, hr') ? markup : document.createTextNode(labels.comment_empty_content))
        if (known) {
          const link = document.createElement('a')
          const target = new URL(known.url)
          link.className = 'statistics-comment-post'
          link.textContent = known.title
          link.title = [labels.comment_action, known.title].filter(Boolean).join(' · ')
          link.dataset.tooltipDelay = '350'
          link.href = target.pathname + target.search + '#' + encodeURIComponent(item.id)
          link.addEventListener('click', () => finish(false), { signal })
          row.append(link)
        }
        row.append(meta, details, content)
        list.append(row)
      }
      markdown.sync()
      page++
      hasMore = data.hasMore
      status.textContent = data.total ? '' : labels.empty
      more.textContent = labels.comment_more
      more.hidden = !hasMore
    } catch (error) {
      if (request === current && dialog.open && !signal.aborted) {
        status.textContent = labels.failed_comments_unavailable
        more.textContent = labels.retry
        more.hidden = false
        hasMore = false
      }
    } finally { clearTimeout(timer); if (request === current) loading = false }
  }
  more.onclick = () => { void load() }
  body.addEventListener('scroll', () => { if (hasMore && body.scrollHeight - body.scrollTop - body.clientHeight < 100) void load() }, { passive: true, signal })
  signal.addEventListener('abort', () => { finish(false); markdown.destroy(); dialog.remove() }, { once: true })
  return (heading: string, next: { author?: string; url?: string } = {}) => {
    request?.abort()
    trigger = document.activeElement as HTMLElement
    filter = next; page = 1; loading = false; hasMore = false
    const article = next.url ? commentContent(config, next.url) : undefined
    if (article) {
      const link = document.createElement('a')
      const target = new URL(article.url)
      link.href = target.pathname + target.search
      link.textContent = heading
      link.title = article.url
      link.onclick = () => finish(false)
      title.replaceChildren(link)
    } else title.textContent = heading
    count.textContent = ''
    markdown.destroy()
    list.replaceChildren()
    markdown = createCommentMarkdown(list, '.statistics-comment-excerpt')
    if (!dialog.open) { overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal() }
    body.scrollTop = 0
    close.focus({ preventScroll: true })
    void load()
  }
}
