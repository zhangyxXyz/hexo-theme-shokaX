import { CONFIG } from '../globals/globalVars'
import { showtip } from '../globals/tools'
import { formatCommentRegion } from './comment-region'
import { syncFriendBadges } from './comment-friend'
import { createCommentMarkdown } from './comment-markdown'
import { createCommentMedia } from './comment-media'
import { observeCommentDecorations } from './comment-observer'
import { syncCommentControls } from './comment-controls'
import { init } from '@waline/client'
import { pageviewCount } from '@waline/client/pageview'
// @ts-ignore
await import('@waline/client/style')
// Browser / OS icons supplied by the installed Waline version.
// @ts-ignore
await import('@waline/client/meta')

let instance: ReturnType<typeof init> | undefined
let previewObserver: ReturnType<typeof observeCommentDecorations> | undefined
let markdown: ReturnType<typeof createCommentMarkdown> | undefined
let media: ReturnType<typeof createCommentMedia> | undefined

// Enhance the native toggle; Waline still owns preview rendering and state.
const syncCommentDecorations = (container: HTMLElement) => {
  const privateLabel = container.dataset.privateLabel || 'Private'
  container.querySelectorAll<HTMLElement>('.wl-head > .wl-badge').forEach(badge => {
    if (badge.textContent?.trim() === privateLabel) {
      if (!badge.classList.contains('shokax-private-badge')) badge.classList.add('shokax-private-badge')
      if (badge.title !== (container.dataset.privateHint || '')) badge.title = container.dataset.privateHint || ''
    }
  })
  syncCommentControls(container)
  markdown?.sync()
  media?.sync()
  syncFriendBadges(container, CONFIG.waline.friendUrls || [], container.dataset.friendLabel || '')
  const template = container.dataset.regionTemplate || '{region}'
  container.querySelectorAll<HTMLElement>('.wl-meta > .wl-addr[data-value]').forEach(address => {
    const text = formatCommentRegion(address.dataset.value || '', template)
    if (address.textContent !== text) address.textContent = text
  })
}

export const destroyWaline = () => {
  previewObserver?.disconnect()
  previewObserver = undefined
  markdown?.destroy()
  markdown = undefined
  media?.destroy()
  media = undefined
  instance?.destroy()
  instance = undefined
}
document.addEventListener('pjax:send', destroyWaline)

export const walineComment = function () {
  destroyWaline()
  const container = document.getElementById('comments')
  if (!container) return
  container.classList.toggle('waline-readonly', CONFIG.waline.readOnly)
  markdown = createCommentMarkdown(container)
  media = createCommentMedia(container)
  const locale = {
    privateReply: container.dataset.privateLabel,
    privateReplyHint: container.dataset.privateHint,
    ...CONFIG.waline.locale
  }
  instance = init({
    el: '#comments',
    serverURL: CONFIG.waline.serverURL,
    lang: CONFIG.waline.lang,
    locale,
    // The fork accepts a plain-text notifier; official clients ignore this option.
    ...{ notify: (message: string) => showtip(message, true) },
    emoji: CONFIG.waline.emoji,
    meta: CONFIG.waline.meta,
    requiredMeta: CONFIG.waline.requiredMeta,
    wordLimit: CONFIG.waline.wordLimit,
    pageSize: CONFIG.waline.pageSize,
    pageview: CONFIG.waline.pageview,
    login: CONFIG.waline.readOnly ? 'disable' : CONFIG.waline.login,
    reaction: false,
    highlighter: false,
    path: window.location.pathname,
    recaptchaV3Key: CONFIG.waline.recaptchaV3Key,
    turnstileKey: CONFIG.waline.turnstileKey,
    dark: 'html[data-theme="dark"]'
  })
  syncCommentDecorations(container)
  previewObserver = observeCommentDecorations(container, () => syncCommentDecorations(container))
}

export const walinePageview = function () {
  if (!CONFIG.waline.pageview || CONFIG.waline.readOnly) return
  pageviewCount({
    serverURL: CONFIG.waline.serverURL,
    path: window.location.pathname
  })
}

export const walineRecentComments = async function () {
  const container = document.getElementById('new-comment')
  if (!container) return
  const root = shokax_siteURL.replace(/^(https?:\/\/)?[^/]*/, '')
  let items = []
  // Read the server's JSON envelope directly; no widget or login state needed.
  const url = new URL(`${CONFIG.waline.serverURL.replace(/\/+$/, '')}/api/comment`)
  url.search = new URLSearchParams({ type: 'recent', count: '10', lang: CONFIG.waline.lang }).toString()
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Waline recent comments: HTTP ${response.status}`)
  const result: { errno: number; errmsg: string; data: Array<{ comment: string; url: string; objectId: string; time: number; nick: string }> } = await response.json()
  if (result.errno !== 0) throw new Error(result.errmsg)
  const rows = result.data
  rows.forEach(function (item) {
    const plain = new DOMParser().parseFromString(item.comment, 'text/html').body.textContent || ''
    let cText = plain.length > 50 ? plain.substring(0, 50) + '...' : plain
    item.url = item.url.startsWith('/') ? item.url : '/' + item.url
    const siteLink = item.url + '#' + item.objectId

    const time = new Date(item.time)
    const now = new Date()
    const diff = now.valueOf() - time.valueOf()
    let dateStr:string
    if (diff < 3600000) {
      dateStr = `${Math.floor(diff / 60000)} 分钟前`
    } else if (diff < 86400000) {
      dateStr = `${Math.floor(diff / 3600000)} 小时前`
    } else if (diff < 2592000000) {
      dateStr = `${Math.floor(diff / 86400000)} 天前`
    } else {
      dateStr = `${time.getFullYear()}-${time.getMonth() + 1}-${time.getDate()}`
    }

    items.push({
      href: siteLink,
      nick: item.nick,
      time: dateStr,
      text: cText
    })
  })
  const newComments = new DocumentFragment()
  items.forEach(function (item) {
    const commentEl = document.createElement('li')
    const commentLink = document.createElement('a')
    const commentTime = document.createElement('span')
    const commentText = document.createElement('span')

    commentText.innerText = item.text
    commentTime.className = 'breadcrumb'
    commentTime.innerText = `${item.nick} @ ${item.time}`
    commentLink.href = root + item.href
    commentEl.className = 'item'

    commentText.appendChild(document.createElement('br'))
    commentLink.appendChild(commentTime)
    commentLink.appendChild(commentText)
    commentEl.appendChild(commentLink)
    newComments.appendChild(commentEl)
  })

  if (container.isConnected) container.replaceChildren(newComments)
}
