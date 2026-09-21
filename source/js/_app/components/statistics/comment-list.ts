import { loadCommentList } from './comments'
import { restoreModalFocus } from '../input-modality'
import type { ContentItem, Settings } from './types'

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
        const meta = document.createElement('div')
        const name = document.createElement('strong')
        name.textContent = item.nick || labels.comment_anonymous
        const time = document.createElement('time')
        const date = new Date(item.time)
        time.textContent = Number.isNaN(date.getTime()) ? labels.comment_unknown_date : date.toLocaleString(document.documentElement.lang || undefined)
        if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString()
        meta.append(name, time)
        const known = commentContent(config, item.url)
        const link = document.createElement(known ? 'a' : 'span')
        link.textContent = known?.title || item.url || labels.comment_unknown_page
        if (known) {
          const target = new URL(known.url)
          ;(link as HTMLAnchorElement).href = target.pathname + target.search + '#' + encodeURIComponent(item.id)
          link.addEventListener('click', () => finish(false), { signal })
        }
        row.append(meta, link)
        list.append(row)
      }
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
  signal.addEventListener('abort', () => { finish(false); dialog.remove() }, { once: true })
  return (heading: string, next: { author?: string; url?: string } = {}) => {
    request?.abort()
    trigger = document.activeElement as HTMLElement
    filter = next; page = 1; loading = false; hasMore = false
    title.textContent = heading
    count.textContent = ''
    list.replaceChildren()
    if (!dialog.open) { overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; dialog.showModal() }
    body.scrollTop = 0
    close.focus({ preventScroll: true })
    void load()
  }
}
