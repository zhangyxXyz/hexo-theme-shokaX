/** An explicit scope builds the full tree; omitted scope preserves classic pagination. */
hexo.extend.helper.register('archive_tree', function (this: localsPlus, posts, allPosts = posts, scope?: { year?: number | string, month?: number | string }) {
  const toArray = collection => Array.isArray(collection) ? collection : collection?.toArray() || []
  const complete = toArray(allPosts)
  const yearCounts = new Map<string, number>()
  const monthCounts = new Map<string, number>()
  const dates = post => ({ year: String(this.date(post.date, 'YYYY')), month: String(this.date(post.date, 'MM')) })
  const visible = scope ? complete.filter(post => {
    const { year, month } = dates(post)
    return (scope.year == null || year === String(scope.year)) &&
      (scope.month == null || Number(month) === Number(scope.month))
  }).sort((a, b) => Number(b.date) - Number(a.date)) : toArray(posts)
  let latest = -Infinity
  let firstYear = ''
  let lastYear = ''
  for (const post of complete) {
    const { year, month } = dates(post)
    yearCounts.set(year, (yearCounts.get(year) || 0) + 1)
    monthCounts.set(`${year}-${month}`, (monthCounts.get(`${year}-${month}`) || 0) + 1)
    latest = Math.max(latest, Number(post.date))
    if (!firstYear || year < firstYear) firstYear = year
    if (!lastYear || year > lastYear) lastYear = year
  }
  const groups = new Map<string, { year: string, total: number, count: number, months: Map<string, { month: string, total: number, posts: any[], latest: boolean, categories: string[] }> }>()
  for (const post of visible) {
    const { year, month } = dates(post)
    if (!groups.has(year)) groups.set(year, { year, total: yearCounts.get(year) || 0, count: 0, months: new Map() })
    const group = groups.get(year)!
    group.count++
    if (!group.months.has(month)) group.months.set(month, { month, total: monthCounts.get(`${year}-${month}`) || 0, posts: [], latest: false, categories: [] })
    const branch = group.months.get(month)!
    branch.posts.push(post)
    branch.latest ||= Number(post.date) === latest
    const categories = toArray(post.categories)
    const leaf = categories.find(category => !categories.some(other => other.parent === category._id))
    if (leaf?.name && !branch.categories.includes(leaf.name)) branch.categories.push(leaf.name)
  }
  return {
    years: Array.from(groups.values(), group => ({ ...group, months: Array.from(group.months.values()) })),
    total: complete.length,
    count: visible.length,
    firstYear,
    lastYear
  }
})
