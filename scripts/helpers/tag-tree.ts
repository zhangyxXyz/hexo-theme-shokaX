import { load } from 'cheerio'

const toArray = collection => Array.isArray(collection) ? collection : collection?.toArray() || []

function previewText(value: unknown, limit = 320) {
  if (typeof value !== 'string' || !value.trim()) return ''
  const $ = load(value)
  $('script, style, pre, code, svg, img, iframe, table, h1, h2, h3, h4, h5, h6, .anchor, .post-meta, .note.warning').remove()
  $('p, li, div, br').append(' ')
  const chars = Array.from($.root().text().replace(/\s+/g, ' ').trim())
  return chars.slice(0, limit).join('') + (chars.length > limit ? '…' : '')
}

// Use the tag's complete collection, not the current classic pagination slice.
hexo.extend.helper.register('tag_tree', function (this: localsPlus, tagName, tags, fallback) {
  const tag = toArray(tags).find(tag => tag.name === tagName)
  const posts = toArray(tag ? tag.posts : fallback).slice().sort((a, b) => Number(b.date) - Number(a.date))
  const years = new Map<string, any[]>()
  for (const post of posts) {
    const year = String(this.date(post.date, 'YYYY'))
    if (!years.has(year)) years.set(year, [])
    years.get(year)!.push(post)
  }
  return { total: posts.length, years: Array.from(years, ([year, posts]) => {
    const months = new Map<string, any[]>()
    for (const post of posts) {
      const month = String(this.date(post.date, 'MM'))
      if (!months.has(month)) months.set(month, [])
      months.get(month)!.push(post)
    }
    return { year, posts, months: Array.from(months, ([month, posts]) => ({ month, posts })) }
  }) }
})

hexo.extend.helper.register('article_preview', function (this: localsPlus, post) {
  // Never extract even a description from a protected article.
  if (post.encrypt || post.password) return null
  const cached = typeof this.summary_card === 'function' ? this.summary_card(post) : null
  const available = (cached || []).map(version => ({ ...version, text: previewText(version.text, 600) })).filter(version => version.text)
  // The article chooses the configured default before applying display order.
  const defaultVersion = available[0]
  const versions = typeof this.sort_summary_models === 'function' ? this.sort_summary_models(available) : available
  const original = [post.description, post.excerpt, post.content].map(value => previewText(value)).find(Boolean) || ''
  if (!versions.length && !original) return null
  return {
    versions, original, defaultIndex: Math.max(0, versions.indexOf(defaultVersion)),
    text: defaultVersion?.text || original, ai: Boolean(defaultVersion)
  }
})
