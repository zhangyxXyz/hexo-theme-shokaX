import * as twikoo from 'twikoo'
import { CONFIG } from '../globals/globalVars'

export const twikooComment = function () {
  twikoo.init({
    envId: CONFIG.twikoo.envId,
    el: '#comments',
    region: CONFIG.twikoo.region
  })
}

export const twikooRecentComments = async function () {
  const container = document.getElementById('new-comment')
  if (!container || container.dataset.loaded || container.dataset.loading || matchMedia('(max-width: 767px)').matches) return
  container.dataset.loading = 'true'
  const { renderFooterComments, footerCommentState } = await import('./footer-comments')
  try {
    const rows = await twikoo.getRecentComments({ envId: CONFIG.twikoo.envId, pageSize: Number(container.dataset.limit) || 3 })
    if (container.isConnected) renderFooterComments(container, rows.map(item => ({
      nick: item.nick, url: item.url, id: item.id, text: item.commentText, avatar: item.avatar
    })))
  } catch {
    if (container.isConnected) footerCommentState(container, 'error')
  } finally {
    delete container.dataset.loading
  }
}
