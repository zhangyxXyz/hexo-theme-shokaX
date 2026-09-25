import { buildGraphIndex, graphViews } from '../utils/article-graph'

let views = new Map<string, any>()
// Body rendering (including encryption) finishes in the default priority-10 filter.
// Rebuild from the published collection on every generation, including cached posts.
hexo.extend.filter.register('before_generate', async () => {
  const settings = (hexo.theme.config as any).article_graph || {}
  const posts = hexo.locals.get('posts').toArray()
  views = new Map()
  if (!posts.some(post => (post.article_graph ?? settings.enable) === true)) return
  const index = buildGraphIndex(posts, hexo.config, settings.domain_aliases || [])
  views = await graphViews(index, settings.max_nodes)
}, 100)

hexo.extend.helper.register('article_graph', function (post) {
  const settings = (this.theme as any).article_graph || {}
  if ((post.article_graph ?? settings.enable) !== true) return null
  return views.get(String(post.path).replace(/^\/+/, '')) || null
})
