import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { renderFile } = createRequire(require.resolve('hexo-renderer-pug'))('pug')
const collection = rows => ({ sort: () => collection(rows), toArray: () => rows })
const posts = Array.from({ length: 8 }, (_, i) => ({ title: `Post ${i}`, path: `posts/${i}/`, date: new Date() }))
const tags = Array.from({ length: 8 }, (_, i) => ({ name: `Tag ${i}`, path: `tags/${i}/`, length: i + 1 }))
const render = (footer = {}, widgets = { random_posts: true, recent_comments: true }) => renderFile(
  fileURLToPath(new URL('../layout/_partials/footer-discovery.pug', import.meta.url)), {
    theme: { footer: { icon: { name: 'sakura' }, icp: { enable: false }, ...footer }, widgets, waline: { enable: true }, social: { github: 'https://github.com/example' } },
    site: { posts: collection(posts), tags: collection(tags), pages: collection([]) },
    config: { url: 'https://example.com', subtitle: '', feed: { rss: { output: 'atom.xml' } } },
    title: 'Blog', alternate: '', author: 'Author',
    __: key => key, url_for: path => path, date: () => '2026', _striptags: text => text, shokax_inject: () => ''
  }
)
const count = (html, pattern) => (html.match(pattern) || []).length
const baseline = render()
assert.equal(count(baseline, /class="footer-article-number"/g), 3)
assert.match(baseline, /id="footer-tags" data-limit="6"/)
assert.match(baseline, /data-limit="3"/)
assert.match(baseline, /footer-latest/)
const custom = render({ tags: { limit: 2 }, random_posts: { limit: 5 }, recent_comments: { limit: 4 } })
assert.equal(count(custom, /class="footer-article-number"/g), 5)
assert.equal(count(custom, /class="footer-tag"[^>]* hidden/g), 6)
assert.match(custom, /data-limit="4"/)
const off = render({ latest_post: false, tags: { enable: false }, random_posts: { enable: false }, recent_comments: { enable: false }, navigation: {}, social_links: { rss: false, github: false } })
assert.match(off, /footer-layout-intro-only/)
assert.doesNotMatch(off, /footer-latest|id="footer-tags"|id="new-comment"|class="footer-articles"|i-rss|i-github/)
const legacyOff = { random_posts: false, recent_comments: false }
assert.doesNotMatch(render({}, legacyOff), /id="new-comment"|class="footer-article-number"/)
assert.doesNotMatch(render({ random_posts: { enable: null }, recent_comments: { enable: null } }, legacyOff), /id="new-comment"|class="footer-article-number"/)
assert.match(render({ random_posts: { enable: true } }, legacyOff), /class="footer-article-number"/)
assert.match(render({ recent_comments: { enable: true } }, legacyOff), /id="new-comment"/)
assert.match(render({ random_posts: { enable: false } }), /footer-stories-single/)
for (const limit of [0, -1, 1.5, '4', null]) {
  const html = render({ tags: { limit }, random_posts: { limit }, recent_comments: { limit } })
  assert.equal(count(html, /class="footer-article-number"/g), 3)
  assert.match(html, /id="footer-tags" data-limit="6"/)
}
console.log('Footer configuration: defaults, limits, disable, legacy overrides and single-column rendering passed.')
