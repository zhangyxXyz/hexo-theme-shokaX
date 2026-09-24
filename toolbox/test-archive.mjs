import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { transform } from 'esbuild'
import { load } from 'js-yaml'
import { url_for } from 'hexo-util'

const require = createRequire(import.meta.url)
const pug = createRequire(require.resolve('hexo-renderer-pug'))('pug')
const { parseDocument } = createRequire(require.resolve('hexo-util'))('htmlparser2')
const moment = createRequire(require.resolve('hexo'))('moment-timezone')
const root = new URL('../', import.meta.url)
const helpers = new Map()
for (const file of ['scripts/helpers/archive.ts', 'scripts/helpers/engine.ts']) {
  const filename = fileURLToPath(new URL(file, root))
  const { code } = await transform(await fs.readFile(filename, 'utf8'), { loader: 'ts', format: 'cjs' })
  const module = { exports: {} }
  vm.runInNewContext(code, {
    hexo: { extend: { helper: { register: (name, helper) => helpers.set(name, helper) } } },
    require, module, exports: module.exports, console, Buffer
  }, { filename })
}
const translations = load(await fs.readFile(new URL('languages/zh-CN.yml', root), 'utf8'))
const translate = (key, ...args) => {
  const value = key.split('.').reduce((value, part) => value?.[part], translations)
  return (typeof value === 'string' ? value : key).replace(/%[sd]/g, () => String(args.shift()))
}
const plural = (key, count) => {
  const value = key.split('.').reduce((value, part) => value?.[part], translations)
  return translate(typeof value === 'string' ? key : `${key}.${count === 0 ? 'zero' : count === 1 ? 'one' : 'other'}`, count)
}
const date = (value, pattern) => moment(value).tz('Asia/Shanghai').format(pattern)
const group = (visible, all = visible, scope) => helpers.get('archive_tree').call({ date }, visible, all, scope)
const collection = posts => ({ length: posts.length, toArray: () => posts })
const plain = value => JSON.parse(JSON.stringify(value))
const category = Object.freeze([
  Object.freeze({ _id: 'parent', name: 'Parent' }),
  Object.freeze({ _id: 'leaf', parent: 'parent', name: '<b>Leaf</b> & notes' })
])
const times = [
  '2026-08-31T16:30:00Z', '2026-08-31T16:30:00Z', '2026-08-31T16:10:00Z',
  '2026-08-31T16:05:00Z', '2026-08-31T16:00:00Z', '2026-08-31T15:59:00Z',
  '2025-12-31T16:30:00Z', '2025-12-31T15:30:00Z', '2024-06-01T00:00:00Z',
  '2023-06-01T00:00:00Z', '2022-06-01T00:00:00Z'
]
const posts = Object.freeze(times.map((time, index) => Object.freeze({
  date: new Date(time), path: `posts/${index}.html`, categories: collection(category),
  title: index < 2 ? '<img src=x onerror="boom()"> & "literal"' : index < 4 ? '' : `Post ${index}`,
  link: index === 0 || index === 2 ? `https://example.test/external/${index}?a=1&b=2` : undefined
})))
const before = JSON.stringify(posts)
const visible = Object.freeze([posts[2], posts[3], posts[5], posts[7]])

function elements(node, predicate) {
  const found = []
  for (const child of node.children || []) {
    if (child.type === 'tag' && predicate(child)) found.push(child)
    found.push(...elements(child, predicate))
  }
  return found
}
const hasClass = (node, name) => (node.attribs?.class || '').split(/\s+/).includes(name)
const byClass = (node, name) => elements(node, child => hasClass(child, name))
const text = node => node.type === 'text' ? node.data : (node.children || []).map(text).join('')
const postLinks = node => elements(node, child => child.name === 'a' && child.attribs.itemprop === 'url')
const owns = (node, name) => Object.hasOwn(node.attribs, name)

function render(view, { visiblePosts = posts, allPosts = posts, scope = '', siteRoot = '/', mode = 'tree', switchable = true } = {}) {
  const context = {
    config: { root: siteRoot, url: `https://blog.test${siteRoot}`, archive_dir: 'archives', date_format: 'YYYY-MM-DD' },
    page: { year: 2026, month: 9, posts: collection(visiblePosts) }, site: { posts: collection(allPosts) },
    theme: { archive_view: { mode: view === 'page' ? mode : view, switchable } }, archive_tree: group, _css: () => '',
    is_year: () => scope === 'year', is_month: () => scope === 'month',
    date, moment, __: translate, _p: plural
  }
  context.url_for = path => url_for.call(context, path)
  context._url = (...args) => helpers.get('_url').call(context, ...args)
  // Render the real page content without unrelated global navigation/footer helpers.
  const options = {
    plugins: [{ read: filename => filename.replaceAll('\\', '/').endsWith('/_partials/layout.pug')
      ? 'block head\nblock title\nblock header\nblock content\n'
      : readFileSync(filename) }]
  }
  const html = pug.renderFile(fileURLToPath(new URL('layout/archive.pug', root)), { ...context, ...options })
  const document = parseDocument(html)
  if (view !== 'page') {
    // Keep the real shared heading/toolbar and selected panel. The full-page
    // checks below retain both panels and verify their visibility and controls.
    const panels = elements(document, node => owns(node, 'data-archive-panel'))
    assert.equal(panels.length, 2)
    for (const panel of panels) {
      if (panel.attribs['data-archive-panel'] === view) continue
      panel.parent.children = panel.parent.children.filter(node => node !== panel)
    }
  }
  return { document, context }
}

let passed = 0
const failures = []
function check(name, test) {
  try { test(); passed++; console.log(`PASS ${name}`) }
  catch (error) { failures.push({ name, error }); console.error(`FAIL ${name}: ${error.message}`) }
}

check('pagination keeps only visible posts and counts the complete archive', () => {
  const result = group(collection(visible), collection(posts))
  assert.equal(result.count, 4)
  assert.equal(result.total, 11)
  assert.deepEqual(plain(result.years.map(year => [year.year, year.total, year.count])), [['2026', 7, 3], ['2025', 1, 1]])
  assert.deepEqual(plain(result.years[0].months.map(month => [month.month, month.total, month.posts.length])), [['09', 5, 2], ['08', 1, 1]])
  assert.deepEqual(Array.from(result.years.flatMap(year => year.months.flatMap(month => month.posts))), Array.from(visible))
  assert.ok(result.years.every(year => year.months.every(month => !month.latest)), 'a page without the newest post is not marked latest')
})

check('rendered timezone controls year/month boundaries and same-day order is stable', () => {
  const result = group(posts)
  assert.deepEqual(plain(result.years.map(year => year.year)), ['2026', '2025', '2024', '2023', '2022'])
  assert.deepEqual(plain(result.years[0].months.map(month => month.month)), ['09', '08', '01'])
  assert.deepEqual(Array.from(result.years[0].months[0].posts), Array.from(posts.slice(0, 5)))
  assert.equal(result.years[0].months[0].latest, true)
  assert.equal(result.years[0].months[2].posts[0], posts[6], 'UTC December 31 becomes January 1 in Shanghai')
  assert.deepEqual(plain(result.years[0].months[0].categories), ['<b>Leaf</b> & notes'])
  assert.equal(result.firstYear, '2022')
  assert.equal(result.lastYear, '2026')
  assert.equal(JSON.stringify(posts), before, 'grouping must not mutate posts, dates or categories')
})

check('empty collections and missing collection values are safe', () => {
  for (const value of [[], collection([]), undefined, null]) {
    const result = group(value)
    assert.equal(result.total, 0)
    assert.equal(result.count, 0)
    assert.equal(result.years.length, 0)
  }
  for (const view of ['tree', 'classic']) {
    const { document } = render(view, { visiblePosts: [], allPosts: [] })
    assert.equal(postLinks(document).length, 0)
    if (view === 'tree') assert.equal(text(byClass(document, 'archive-empty')[0]), translate('archive_view.empty'))
  }
})

check('tree renders every post once and exposes month paging with a full-list fallback', () => {
  const { document } = render('tree')
  assert.equal(postLinks(document).length, posts.length)
  assert.equal(new Set(postLinks(document).map(link => link.attribs.href)).size, posts.length)
  const firstCard = byClass(document, 'archive-month-card')[0]
  assert.equal(postLinks(firstCard).length, 5)
  assert.equal(byClass(firstCard, 'archive-month-pagination').length, 0)
  const expandedFixture = [...posts, ...posts.slice(0, 2).map((post, i) => ({ ...post, path: `posts/extra-${i}.html` }))]
  const large = render('tree', { allPosts: expandedFixture }).document
  const pager = byClass(large, 'archive-month-pagination')[0]
  assert.ok(owns(pager, 'hidden'), 'without JS all rows remain visible and paging is hidden')
  assert.equal(postLinks(byClass(large, 'archive-month-card')[0]).length, 7)
  const all = elements(byClass(large, 'archive-month-card')[0], node => owns(node, 'data-archive-month-all'))[0]
  assert.equal(all.attribs['data-expand-label'], translate('archive_view.show_all', 7))
  assert.equal(all.attribs['data-collapse-label'], translate('archive_view.paged_view'))
  assert.equal(text(elements(pager, node => owns(node, 'data-archive-month-page'))[0]), '1 / 2')
  assert.equal(byClass(document, 'archive-year').filter(year => owns(year, 'open')).length, 3)
})

check('classic root has only month headings; scoped classic has only this page’s articles', () => {
  const root = render('classic').document
  assert.equal(postLinks(root).length, 0)
  assert.equal(byClass(root, 'section').length, 7)
  const heading = elements(root, node => node.name === 'h2' && hasClass(node, 'header'))[0]
  assert.ok(text(heading).includes(plural('counter.archive_posts', posts.length)))
  assert.equal(text(byClass(root, 'archive-heading-description')[0]).trim(), translate('archive_view.heading'))
  const scoped = render('classic', { visiblePosts: visible, scope: 'year' }).document
  assert.equal(postLinks(scoped).length, visible.length)
  const month = render('classic', { visiblePosts: visible.slice(0, 2), scope: 'month' }).document
  assert.equal(postLinks(month).length, 2)
  assert.equal(byClass(month, 'section').length, 0)
})

check('icon-only view buttons retain names, state, target panels and configuration control', () => {
  for (const mode of ['tree', 'classic']) {
    const document = render('page', { mode }).document
    const headings = elements(document, node => node.name === 'h2' && hasClass(node, 'header'))
    assert.equal(headings.length, 1, 'both modes share one archive heading')
    for (let parent = headings[0].parent; parent; parent = parent.parent) {
      assert.ok(!parent.attribs?.['data-archive-panel'], 'the shared heading remains outside switchable panels')
    }
    const buttons = elements(document, node => node.name === 'button' && owns(node, 'data-archive-mode'))
    assert.equal(buttons.length, 2)
    for (const button of buttons) {
      const buttonMode = button.attribs['data-archive-mode']
      assert.equal(button.attribs['aria-label'], translate(`archive_view.${buttonMode}`))
      assert.equal(button.attribs['aria-pressed'], String(mode === buttonMode))
      assert.equal(text(button).trim(), '')
      const panel = elements(document, node => node.attribs.id === button.attribs['aria-controls'])
      assert.equal(panel.length, 1)
      assert.equal(owns(panel[0], 'hidden'), mode !== buttonMode)
    }
  }
  const locked = render('page', { switchable: false }).document
  assert.equal(elements(locked, node => node.name === 'button' && owns(node, 'data-archive-mode')).length, 0)
})

check('mobile year picker has an accessible name and controls the available year links', () => {
  const document = render('tree').document
  const toggle = elements(document, node => node.name === 'button' && owns(node, 'data-archive-rail-toggle'))[0]
  assert.equal(toggle.attribs['aria-label'], translate('archive_view.rail_toggle'))
  assert.equal(toggle.attribs['aria-expanded'], 'false')
  const nav = elements(document, node => node.attribs.id === toggle.attribs['aria-controls'])[0]
  assert.equal(nav.name, 'nav')
  assert.equal(elements(nav, node => node.name === 'a').length, group(posts).years.length)
  for (const link of elements(nav, node => node.name === 'a')) {
    assert.equal(elements(document, node => node.attribs.id === link.attribs.href.slice(1)).length, 1)
  }
})

check('monthly tree contains the complete month regardless of the classic page', () => {
  const { document } = render('tree', { visiblePosts: visible.slice(0, 2), scope: 'month' })
  assert.equal(postLinks(document).length, 5)
  assert.ok(text(byClass(document, 'archive-month-heading')[0]).includes(translate('archive_view.posts', 5)))
  assert.equal(text(byClass(document, 'archive-tree-count')[0]), translate('archive_view.posts', 5))
  assert.ok(owns(byClass(document, 'archive-year')[0], 'open'))
  assert.equal(byClass(document, 'archive-month-pagination').length, 0)
  const emptyPage = render('tree', { visiblePosts: [], scope: 'month' }).document
  assert.equal(postLinks(emptyPage).length, 5)
  assert.equal(byClass(emptyPage, 'archive-empty').length, 0)
})

check('full trees ignore pagination, sort newest first and filter using the rendered timezone', () => {
  const all = [...posts].reverse()
  const full = group(visible, all, {})
  assert.equal(full.count, posts.length)
  assert.deepEqual(plain(full.years.map(year => year.year)), ['2026', '2025', '2024', '2023', '2022'])
  const year = group([], all, { year: 2026 })
  assert.equal(year.count, 7)
  assert.equal(year.years.length, 1)
  const month = group([], all, { year: 2026, month: '09' })
  assert.equal(month.count, 5)
  assert.equal(month.years[0].months.length, 1)
  assert.equal(group([], all, { year: 2000 }).count, 0)
  assert.deepEqual(all, [...posts].reverse(), 'sorting must not mutate the site collection')
  assert.equal(postLinks(render('tree', { visiblePosts: visible }).document).length, posts.length)
})

for (const view of ['tree', 'classic']) {
  check(`${view} escapes titles/categories and preserves external/untitled posts`, () => {
    const { document, context } = render(view, { scope: 'year' })
    const links = postLinks(document)
    const expected = view === 'tree' ? posts.slice(0, 7) : posts
    assert.equal(links.length, expected.length)
    expected.forEach((post, index) => {
      assert.equal(links[index].attribs.href, post.link || context.url_for(post.path))
      assert.equal(text(links[index]).trim().replace(/^\d{2}/, value => view === 'tree' ? '' : value).trim(), post.title || post.link || translate('post.untitled'))
      assert.equal(elements(links[index], node => ['img', 'script', 'b'].includes(node.name)).length, 0)
    })
    assert.equal(elements(document, node => ['img', 'script', 'b'].includes(node.name)).length, 0)
  })
  check(`${view} respects root/subpath URLs and scoped page counts`, () => {
    for (const siteRoot of ['/', '/journal/']) {
      const { document } = render(view, { visiblePosts: visible, scope: 'year', siteRoot })
      const links = elements(document, node => node.name === 'a')
      assert.equal(links[0].attribs.href, `${siteRoot}archives`)
      for (const link of links.filter(link => link.attribs.href.startsWith('/'))) {
        assert.ok(link.attribs.href.startsWith(siteRoot))
        assert.ok(!link.attribs.href.includes('/journal/journal/'), 'root prefix must be added once')
      }
      const home = render(view, { siteRoot }).document
      const homeLinks = elements(home, node => node.name === 'a')
      assert.equal(homeLinks[0].attribs.href, siteRoot)
      if (view === 'tree') {
        assert.equal(byClass(document, 'archive-year').filter(year => owns(year, 'open')).length, 1)
        assert.equal(text(byClass(document, 'archive-year-count')[0]).trim(), translate('archive_view.posts', 7))
        assert.ok(text(document).includes(translate('archive_view.page_posts', 4)))
        assert.ok(text(byClass(document, 'archive-month-heading')[0]).includes(translate('archive_view.posts', 5)))
        assert.ok(!text(byClass(document, 'archive-month-heading')[0]).includes(translate('archive_view.page_posts', 2)))
        assert.equal(postLinks(document).length, 7)
      }
    }
  })
}

assert.equal(JSON.stringify(posts), before, 'template rendering must not mutate input posts')
if (failures.length) process.exitCode = 1
console.log(`Archive regression: ${passed} passed, ${failures.length} failed.`)
