const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { transformSync } = require('esbuild')
const pug = require('node:module').createRequire(require.resolve('hexo-renderer-pug'))('pug')
const root = path.resolve(__dirname, '..')
let helper
const now = Date.now()
const day = 86400000
const theme = { isOutdated: { enable: true, days: 30 }, outime: { enable: false, days: 90 } }
vm.runInNewContext(transformSync(fs.readFileSync(path.join(root, 'scripts/helpers/article-info.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code, {
  hexo: { extend: { helper: { register: (_, fn) => { helper = fn } } } }, URL, Date, require
})
const model = (post, config = theme) => helper.call({ theme: config }, post)
const recent = { date: new Date(now - day), updated: new Date(now - day) }
const old = { date: new Date(now - 100 * day), updated: new Date(now - 60 * day) }
assert.equal(model(recent).visible, false, 'Neither condition: no visible card')
assert.equal(model({ ...recent, reprintlink: 'Internet' }).outdated, false, 'Source only')
assert.equal(model(old).outdated, true, 'Age only; legacy config wins')
assert.equal(model({ ...old, reprintlink: 'Example||https://example.com/article' }).url, 'https://example.com/article')
assert.equal(model({ ...old, isOutdated: false }).visible, false, 'Legacy per-post disable')
assert.equal(model({ ...old, isOutdated: false, outime: true }).visible, false, 'Legacy override wins')
assert.equal(model(old, { isOutdated: { enable: false }, outime: { enable: true } }).visible, false)
assert.equal(model(old, { outime: { enable: true, days: 30 } }).outdated, true, 'ShokaX fallback')
assert.equal(model({ date: new Date('invalid') }).visible, false)
assert.equal(model({ date: new Date(now + day) }).visible, false)
assert.equal(model({ ...recent, reprintlink: 'Example||javascript:alert(1)' }).url, '', 'Unsafe URL is not linked')
assert.equal(model({ ...recent, reprintlink: 'https://example.com/' }).source, 'https://example.com/')
const render = post => pug.renderFile(path.join(root, 'layout/_partials/post/article-info.pug'), {
  post, article_info: model, __: (key, arg) => key + (arg === undefined ? '' : ' ' + arg),
  date: timestamp => new Date(timestamp).toISOString().slice(0, 10)
})
assert.match(render(recent), /<aside[^>]* hidden/)
assert.equal(render({ ...old, isOutdated: false }), '')
assert.match(render({ ...old, reprintlink: '<script>alert(1)</script>' }), /&lt;script&gt;/)
assert.doesNotMatch(render({ ...old, reprintlink: 'Example||javascript:alert(1)' }), /href=/)
for (const post of [recent, old, { ...recent, reprintlink: 'Internet' }, { ...old, reprintlink: 'Internet' }]) {
  const html = render(post)
  assert.equal((html.match(/<aside/g) || []).length, 1)
}
const componentCode = transformSync(fs.readFileSync(path.join(root, 'source/js/_app/components/article-info.ts'), 'utf8'), { loader: 'ts', format: 'cjs' }).code
const moduleStub = { exports: {} }
const makeCard = (source, updated) => {
  const rows = [{ hidden: false }]
  const elapsed = { textContent: '' }
  const published = { textContent: '' }
  return {
    dataset: { source: String(source), updated: String(updated), published: String(updated), days: '30', durationYear: 'y', durationMonth: 'm', durationDay: 'd' },
    hidden: false, rows, elapsed,
    querySelectorAll: () => rows,
    querySelector: selector => selector === '[data-article-elapsed]' ? elapsed : published
  }
}
const cards = [makeCard(false, now - day), makeCard(true, now - day), makeCard(false, now - 60 * day), makeCard(true, now - 60 * day)]
vm.runInNewContext(componentCode, { module: moduleStub, exports: moduleStub.exports, Date, document: { querySelectorAll: () => cards } })
moduleStub.exports.refreshArticleInfo()
assert.deepEqual(cards.map(card => card.hidden), [true, false, false, false])
assert.deepEqual(cards.map(card => card.rows[0].hidden), [true, true, false, false])
assert.match(cards[2].elapsed.textContent, /m/)
moduleStub.exports.refreshArticleInfo()
assert.deepEqual(cards.map(card => card.hidden), [true, false, false, false], 'Repeated PJAX initialization stays stable')
const fixedNow = new Date(2026, 8, 17, 12).getTime()
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])) }
  static now() { return fixedNow }
}
const ages = [new Date(2022, 4, 7, 12), new Date(2026, 5, 12, 12), new Date(2026, 7, 30, 12), new Date(2022, 8, 17, 12), new Date(2026, 5, 17, 12)]
const ageCards = ages.map(date => makeCard(true, date.getTime()))
ageCards.forEach(card => { card.dataset.days = '1' })
const ageModule = { exports: {} }
vm.runInNewContext(componentCode, { module: ageModule, exports: ageModule.exports, Date: FixedDate, document: { querySelectorAll: () => ageCards } })
ageModule.exports.refreshArticleInfo()
assert.deepEqual(ageCards.map(card => card.elapsed.textContent), ['4y4m10d', '3m5d', '18d', '4y', '3m'], 'Retain day precision even after a full year')
ageCards.forEach(card => Object.assign(card.dataset, { durationYear: '年', durationMonth: '个月', durationDay: '天', durationJoin: '零' }))
ageModule.exports.refreshArticleInfo()
assert.deepEqual(ageCards.map(card => card.elapsed.textContent), ['4年零4个月零10天', '3个月零5天', '18天', '4年', '3个月'], 'Chinese duration joins nonzero units with 零')
console.log('Article info: condition matrix, legacy settings, dates, source parsing, escaping and repeated client refresh passed.')
