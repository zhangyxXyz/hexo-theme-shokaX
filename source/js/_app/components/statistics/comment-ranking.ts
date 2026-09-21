import { tagsLimit } from './tags-limit'
import { commentContent, createCommentList } from './comment-list'
import type { CommentSource, CommentStatistics } from './comments'
import type { Panel } from './panel'
import type { Settings } from './types'

export async function mountCommentRanking(panel: Panel, source: CommentSource, config: Settings, signal: AbortSignal) {
  const labels = config.labels
  const open = createCommentList(config, signal)
  let data: CommentStatistics | undefined
  let mode = 'author', kind = 'all'
  const toolbar = document.createElement('div')
  toolbar.className = 'statistics-content-toolbar'
  panel.header.append(toolbar)
  const controls = (items: [string, string][], value: () => string, change: (value: string) => void) => {
    const group = document.createElement('div')
    group.className = 'statistics-content-controls'
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', items.map(item => item[1]).join(' / '))
    const buttons = items.map(([key, text]) => {
      const button = document.createElement('button')
      button.type = 'button'; button.textContent = text
      button.onclick = () => { change(key); render() }
      group.append(button)
      return button
    })
    toolbar.append(group)
    return { group, sync: () => buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(value() === items[index][0]))) }
  }
  const modes = controls([['author', labels.comment_by_author], ['content', labels.comment_by_content]], () => mode, value => { mode = value })
  const kinds = controls([['all', labels.tags_all], ['article', labels.content_articles], ['page', labels.content_pages]], () => kind, value => { kind = value })
  const all = document.createElement('button')
  all.type = 'button'; all.textContent = labels.comment_list
  all.onclick = () => open(labels.comment_list)
  toolbar.append(all)
  panel.body.classList.add('statistics-comment-ranking')
  const render = () => {
    modes.sync(); kinds.sync(); kinds.group.hidden = mode !== 'content'
    panel.body.replaceChildren()
    if (!data) return
    const items = mode === 'author'
      ? data.ranking.map(item => ({ ...item, filter: { author: item.key } }))
      : data.content.flatMap(item => {
        const known = commentContent(config, item.name)
        return known && (kind === 'all' || kind === known.kind) ? [{ ...item, name: known.title, filter: { url: item.name } }] : []
      }).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    const visible = limit(items) as typeof items
    if (!visible.length) { panel.empty(); return }
    panel.success()
    const max = visible[0].value || 1
    visible.forEach((item, index) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'statistics-comment-row'
      const rank = document.createElement('span')
      rank.textContent = String(index + 1)
      const name = document.createElement('span')
      name.className = 'statistics-comment-name'
      name.textContent = item.name || labels.comment_anonymous
      const bar = document.createElement('span')
      bar.className = 'statistics-comment-bar'
      bar.style.setProperty('--fill', `${item.value / max * 100}%`)
      bar.textContent = String(item.value)
      button.append(rank, name, bar)
      button.onclick = () => open(name.textContent!, item.filter)
      panel.body.append(button)
    })
  }
  const limit = tagsLimit(panel, labels, signal, render)
  const update = async () => {
    const done = panel.begin()
    try {
      data = await source.load()
      if (signal.aborted) return
      panel.ready()
      render()
    } catch (error) { if (!signal.aborted) panel.fail(error) }
    finally { done() }
  }
  panel.button.onclick = () => { void update() }
  render()
  void update()
}
