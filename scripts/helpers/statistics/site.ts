type Collection<T> = { toArray(): T[] }
type Post = { published?: boolean; date: { format(pattern: string): string } }
type Taxonomy = { name: string; length: number }

hexo.extend.helper.register('statistics_data', (site: { posts: Collection<Post>; tags: Collection<Taxonomy>; categories: Collection<Taxonomy> }, page: { statistics_start?: string }) => {
  const months: Record<string, number> = {}
  site.posts.toArray().filter(post => post.published !== false).forEach(post => {
    const month = post.date.format('YYYY-MM')
    months[month] = (months[month] || 0) + 1
  })
  const first = /^\d{4}-(0[1-9]|1[0-2])$/.test(page.statistics_start || '') ? page.statistics_start! : Object.keys(months).sort()[0]
  Object.keys(months).filter(month => month < first).forEach(month => delete months[month])
  const today = new Date()
  const current = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  if (first) {
    const cursor = new Date(first + '-01T00:00:00Z')
    while (cursor.toISOString().slice(0, 7) <= current) {
      months[cursor.toISOString().slice(0, 7)] ??= 0
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
  }
  return {
    posts: Object.keys(months).sort().map(name => ({ name, value: months[name] })),
    tags: site.tags.toArray().map(tag => ({ name: tag.name, value: tag.length })).sort((a, b) => b.value - a.value).slice(0, 10),
    categories: site.categories.toArray().map(category => ({ name: category.name, value: category.length })),
  }
})
