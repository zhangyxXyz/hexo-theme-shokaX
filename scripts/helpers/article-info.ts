// Keep the original Shoka front matter and configuration authoritative.
hexo.extend.helper.register('article_info', function (this: localsPlus, post) {
  const theme = this.theme
  const settings = theme.isOutdated ?? theme.outime ?? {}
  const enabled = !!settings.enable && (post.isOutdated ?? post.outime) !== false
  const configuredDays = Number(settings.days)
  const days = Number.isFinite(configuredDays) && configuredDays > 0 ? configuredDays : 30
  const published = Number(post.date?.valueOf())
  const updated = Number(post.updated?.valueOf() ?? post.date?.valueOf())
  const trackAge = enabled && Number.isFinite(updated) && Number.isFinite(published)
  const age = trackAge ? Math.max(0, Math.floor((Date.now() - updated) / 86400000)) : 0
  const outdated = trackAge && Date.now() - updated > days * 86400000
  const changelogs = Array.isArray(post.changelogs) ? post.changelogs.filter(entry => entry && typeof entry === 'object' && !Array.isArray(entry) && (entry.summary || (Array.isArray(entry.list) && entry.list.length))).slice().reverse().map(entry => {
    const summary = String(entry.summary || '')
    const match = summary.match(/^(\d{4}[-/]\d{1,2}[-/]\d{1,2})(?:\s+|$)(.*)$/)
    return { date: match?.[1] || '', title: match ? match[2] : summary, list: Array.isArray(entry.list) ? entry.list : [] }
  }) : []
  const raw = typeof post.reprintlink === 'string' ? post.reprintlink.trim() : ''
  const [name, target] = raw.split('||').map(value => value.trim())
  let url = ''
  try {
    const parsed = new URL(target || name)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') url = parsed.href
  } catch { /* A plain source name is valid; it simply has no traceable URL. */ }
  return {
    source: name || url,
    changelogs,
    url,
    published,
    updated,
    days,
    age,
    trackAge,
    outdated,
    visible: !!(name || url || outdated || changelogs.length)
  }
})
