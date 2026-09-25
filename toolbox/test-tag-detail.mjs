import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { transformSync } from 'esbuild'

const require = createRequire(import.meta.url)
const pug = createRequire(require.resolve('hexo-renderer-pug'))('pug')
const { load } = require('cheerio')
const moment = createRequire(require.resolve('hexo'))('moment-timezone')
const helpers = new Map()
vm.runInNewContext(transformSync(readFileSync(new URL('../scripts/helpers/tag-tree.ts', import.meta.url), 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
  require, hexo: { extend: { helper: { register: (name, callback) => helpers.set(name, callback) } } }
})
const collection = posts => ({ toArray: () => posts })
const context = { date: (value, format) => moment(value).tz('Asia/Shanghai').format(format) }
const posts = [
  { title: '<script>unsafe</script>', path: 'first/', date: new Date('2025-12-31T16:01:00Z'), description: '<p>First &amp; second</p><script>private()</script>' },
  ...Array.from({ length: 12 }, (_, index) => ({ title: `Article ${index}`, path: `post/${index}/`, date: new Date(`${2025 - index % 4}-06-01T00:00:00Z`), content: '<h2>Heading</h2><pre>secret code</pre><p>Body text</p>' }))
]
const before = JSON.stringify(posts)
const data = helpers.get('tag_tree').call(context, 'One', collection([{ name: 'One', posts: collection(posts) }, { name: 'Other', posts: collection([{ date: new Date(), path: 'wrong/' }]) }]), collection(posts.slice(0, 2)))
assert.equal(data.total, 13)
assert.equal(data.years[0].year, '2026', 'Grouping respects the site timezone')
assert.equal(data.years.length, 5)
assert.equal(data.years[0].months[0].month, '01', 'Month grouping uses the same local timezone')
assert.equal(JSON.stringify(posts), before, 'Grouping does not mutate source order')
assert.equal(helpers.get('tag_tree').call(context, 'Missing', [], collection([])).total, 0)
const preview = post => helpers.get('article_preview').call(context, post)
assert.equal(preview(posts[0]).text, 'First & second')
assert.equal(preview(posts[1]).text, 'Body text')
assert.equal(preview({ password: 'secret', description: 'private text' }), null)
assert.equal(preview({ encrypt: true, content: 'private text' }), null)
assert.equal(preview({ content: '<pre>code only</pre>' }), null)
assert.equal(preview({ content: '😀'.repeat(360) }).text, '😀'.repeat(320) + '…')
assert.equal(helpers.get('article_preview').call({ summary_card: () => [{ text: 'Cached summary' }] }, { description: 'Original' }).ai, true)
const choices = helpers.get('article_preview').call({
  summary_card: () => [{ id: 'configured', model: 'Second', text: 'Configured default' }, { id: 'other', model: 'First', text: 'Other summary' }],
  sort_summary_models: values => values.slice().reverse()
}, { description: 'Original' })
assert.equal(choices.defaultIndex, 1, 'Display sorting does not change the article default')
assert.equal(choices.versions[choices.defaultIndex].id, 'configured')
assert.equal(choices.original, 'Original')
const choiceHTML = pug.renderFile(fileURLToPath(new URL('../layout/_partials/tag-tree.pug', import.meta.url)), {
  tagTreeData: data, article_preview: () => choices, page: {}, config: { language: 'en' },
  moment, date: context.date, url_for: path => path, __: key => key,
  summary_model_icon: model => model === 'First' ? 'i-first' : 'i-second', summary_model_label: model => model
})
const choiceDOM = load(choiceHTML)
assert.equal(choiceDOM('select').first().find('option[selected]').attr('data-preference'), 'configured')
assert.equal(choiceDOM('select').first().find('option').last().attr('value'), 'original')
assert.equal(choiceDOM('.article-preview-model > .ic').first().attr('class'), 'ic i-second')
const crowded = helpers.get('tag_tree').call(context, 'Missing', [], collection(Array.from({ length: 11 }, (_, index) => ({ ...posts[1], title: `May ${index}`, date: new Date('2025-05-01T00:00:00Z') }))))
const crowdedHTML = pug.renderFile(fileURLToPath(new URL('../layout/_partials/tag-tree.pug', import.meta.url)), {
  tagTreeData: crowded, article_preview: preview, moment, date: context.date, url_for: path => path, __: key => key
})
const crowdedDOM = load(crowdedHTML)
assert.equal(crowdedDOM('[data-archive-month-page]').text(), '1 / 3')
assert.equal(crowdedDOM('.article-preview-row[hidden]').length, 0, 'No-JS month includes every article')
assert.equal(crowdedDOM('[data-archive-month-pages][hidden]').length, 1)
const render = file => pug.renderFile(new URL(`../layout/_partials/${file}.pug`, import.meta.url).pathname.replace(/^\/(?=[A-Za-z]:)/, ''), {
  tagTreeData: data, page: { posts: collection(posts.slice(0, 2)) }, article_preview: preview, config: { date_format: 'YYYY-MM-DD' },
  __: (key, count) => key + (count == null ? '' : ` ${count}`), moment, date: context.date, url_for: path => '/blog/' + path
})
const tree = load(render('tag-tree'))
assert.equal(tree('.article-preview-row').length, 13, 'Tree includes articles beyond classic pagination')
assert.equal(tree('.archive-year[open]').length, 3)
assert.equal(tree('.article-preview-link').first().attr('href'), '/blog/first/')
assert.equal(tree('.article-preview-link script').length, 0, 'Titles are escaped')
assert.equal(tree('.article-preview-link').first().text(), '<script>unsafe</script>')
assert.equal(tree('.article-preview-content script').length, 0)
assert.equal(new Set(tree('.article-preview-content').map((_, element) => element.attribs.id).get()).size, 13)
assert.equal(load(render('tag-classic'))('.item.normal').length, 2, 'Classic preserves the original page slice')
for (const mode of ['tree', 'classic']) {
  const html = pug.renderFile(fileURLToPath(new URL('../layout/tag.pug', import.meta.url)), {
    plugins: [{ read: filename => filename.replaceAll('\\', '/').endsWith('/_partials/layout.pug')
      ? 'block head\nblock title\nblock header\nblock content\n'
      : filename.replaceAll('\\', '/').endsWith('/_partials/pagination.pug') ? 'nav.pagination Pagination' : readFileSync(filename) }],
    theme: { tag_view: { mode, switchable: false } }, site: { tags: [] },
    page: { tag: '<b>Tag</b>', posts: collection(posts.slice(0, 2)) },
    config: { tag_dir: 'tags', date_format: 'YYYY-MM-DD' }, _css: () => '', _p: () => '',
    tag_tree: () => data, article_preview: preview, moment, date: context.date,
    url_for: path => '/blog/' + path, __: key => key
  })
  const $ = load(html)
  assert.equal($('.tag-detail-page').attr('data-mode'), mode)
  assert.equal($('.tag-detail-controls').length, 0, 'Fixed mode omits the switch')
  assert.equal($(`[data-archive-panel="${mode}"]`).attr('hidden'), undefined)
  assert.equal($(`[data-archive-panel="${mode === 'tree' ? 'classic' : 'tree'}"]`).is('[hidden]'), true)
  assert.equal($('.tag-detail-heading b').length, 0, 'Tag names are escaped')
}
console.log('Tag detail: complete collection, timezone, privacy, text extraction, Unicode, template escaping, and classic pagination passed.')
