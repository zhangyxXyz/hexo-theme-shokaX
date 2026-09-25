import { relatedReading } from '../utils/related-reading'
import { publicGraphPost } from '../utils/article-graph'

let recommendations = new Map<string, any[]>()
let publicPosts = []
hexo.extend.filter.register('before_generate', () => {
  publicPosts = hexo.locals.get('posts').toArray().filter(post => post.path && publicGraphPost(post, hexo.config))
  const settings = hexo.theme.config as any
  const summary = hexo.extend.helper.get('summary_card')
  recommendations = settings.related_reading?.enable === false ? new Map() : relatedReading(publicPosts, hexo.config, settings.article_graph,
    post => summary?.call(hexo, post)?.[0]?.text || '', Infinity)
}, 110)
hexo.extend.helper.register('related_reading', function (post, excluded = []) {
  const matches = post.related_reading === false ? [] : recommendations.get(String(post.path).replace(/^\/+/, '')) || []
  return matches.filter(match => !excluded.includes(match.post.path)).slice(0, 4)
})
hexo.extend.helper.register('reading_navigation', function (post) {
  const allowed = item => item?.path && publicGraphPost(item, hexo.config)
  let left = allowed(post.next) ? post.next : null
  let right = allowed(post.prev) ? post.prev : null
  const excluded = new Set([post.path, left?.path, right?.path])
  const candidates = publicPosts.filter(item => !excluded.has(item.path))
  const pick = () => candidates.length ? candidates.splice(Math.floor(Math.random() * candidates.length), 1)[0] : null
  left ||= pick()
  right ||= pick()
  return { left, right, leftType: left === post.next ? 'prev' : 'random', rightType: right === post.prev ? 'next' : 'random' }
})
hexo.extend.helper.register('article_preview_manifest', function () {
  return { source: this.url_for('article-previews.html'), paths: publicPosts.map(post => this.url_for(post.path)),
    origins: [hexo.config.url, ...((hexo.theme.config as any).article_graph?.domain_aliases || [])] }
})
hexo.extend.generator.register('article-previews', () => ({ path: 'article-previews.html', layout: 'article-previews',
  data: { previewPosts: publicPosts, sitemap: false } }))
