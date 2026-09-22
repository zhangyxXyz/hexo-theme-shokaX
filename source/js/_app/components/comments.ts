import { CONFIG } from '../globals/globalVars'
import { showtip } from '../globals/tools'
import { formatCommentRegion } from './comment-region'
import { syncFriendBadges } from './comment-friend'
import { createCommentMarkdown } from './comment-markdown'
import { createCommentMedia } from './comment-media'
import { observeCommentDecorations } from './comment-observer'
import { syncCommentControls } from './comment-controls'
import { init, defaultLocales } from '@waline/client'
import { getFooterCommentBadge } from './footer-comment-badge'
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
  if (!container || container.dataset.loaded || container.dataset.loading || matchMedia('(max-width: 767px)').matches) return
  container.dataset.loading = 'true'
  const { renderFooterComments, footerCommentState } = await import('./footer-comments')
  try {
    const url = new URL(`${CONFIG.waline.serverURL.replace(/\/+$/, '')}/api/comment`)
    url.search = new URLSearchParams({ type: 'recent', count: container.dataset.limit || '3', lang: CONFIG.waline.lang }).toString()
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!response.ok) throw new Error(`Waline recent comments: HTTP ${response.status}`)
    const result: { errno: number; errmsg: string; data: Array<{ comment: string; url: string; objectId: string; nick: string; avatar?: string; time?: number; label?: string; type?: string; link?: string }> } = await response.json()
    if (result.errno !== 0) throw new Error(result.errmsg)
    if (container.isConnected) renderFooterComments(container, result.data.map(item => ({
      nick: item.nick, url: item.url, id: item.objectId, avatar: item.avatar, time: item.time,
      badge: getFooterCommentBadge(item, CONFIG.waline.friendUrls || [], container.dataset.friendLabel || ''),
      text: new DOMParser().parseFromString(item.comment, 'text/html').body.textContent || ''
    })), {
      relativeTimeDays: CONFIG.waline.relativeTimeDays ?? 60,
      locale: { ...(defaultLocales[(CONFIG.waline.lang || 'en-US').toLowerCase() as keyof typeof defaultLocales] || defaultLocales['en-us']), ...CONFIG.waline.locale }
    })
  } catch {
    if (container.isConnected) footerCommentState(container, 'error')
  } finally {
    delete container.dataset.loading
  }
}
