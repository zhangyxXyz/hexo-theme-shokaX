import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { load } from 'js-yaml'

const require = createRequire(import.meta.url)
const pug = createRequire(require.resolve('hexo-renderer-pug'))('pug')
const render = pug.compileFile(fileURLToPath(new URL('../layout/_partials/post/reward.pug', import.meta.url)))
const strings = load(readFileSync(new URL('../languages/zh-CN.yml', import.meta.url), 'utf8'))
const base = {
  page: { layout: 'post' }, author: 'Author <test>', config: { title: 'Example', author: 'Fallback' },
  theme: { reward: { enable: true, account: { wechatpay: '/wechat.png', alipay: '/ali.png' } }, statics: '/', assets: 'assets' },
  url_for: value => value,
  __: (key, value) => key.split('.').reduce((item, part) => item[part], strings).replace('%s', value ?? '')
}

assert.equal(render({ ...base, page: { reward: false } }).trim(), '')
assert.equal(render({ ...base, page: { layout: 'page', reward: false } }).trim(), '', 'Page front matter can disable the reward card')
assert.match(render({ ...base, page: { layout: 'page' } }), /data-reward-card/, 'Pages share the existing default behavior')
assert.match(render({ ...base, page: { layout: 'page', reward: true } }), /data-reward-card/, 'A page can explicitly opt in')
for (const account of [{}, null, { broken: null, empty: '', whitespace: '  ' }]) {
  assert.equal(render({ ...base, theme: { ...base.theme, reward: { ...base.theme.reward, account } } }).trim(), '')
}
const html = render(base)
assert.match(html, /aria-label="赞赏"/)
assert.doesNotMatch(html, /未完待续|一点共鸣/)
assert.match(html, /Author &lt;test&gt;/)
assert.match(html, /src="\/assets\/wechat.png"/)
assert.match(html, /src="\/assets\/ali.png"/)
assert.equal((html.match(/loading="eager"/g) || []).length, 2, 'hidden payment images must not wait for lazy viewport detection')
assert.match(html, /id="reward-back"[^>]*inert[^>]*aria-hidden="true"/)
assert.equal((html.match(/role="tabpanel"/g) || []).length, 2)
assert.equal((html.match(/aria-selected="true"/g) || []).length, 1)
assert.match(html, /id="reward-panel-1"[^>]*hidden/)
assert.match(html, /data-scan="使用支付宝扫一扫"/)

const custom = render({ ...base, theme: { ...base.theme, reward: { ...base.theme.reward, account: { '<custom>': '/custom.png' } } } })
assert.match(custom, /&lt;custom&gt;/)
assert.doesNotMatch(custom, /<custom>/)
assert.equal((custom.match(/role="tab"/g) || []).length, 1)
for (const language of ['en', 'ja', 'zh-CN', 'zh-HK', 'zh-TW']) {
  const reward = load(readFileSync(new URL(`../languages/${language}.yml`, import.meta.url), 'utf8')).reward
  for (const key of ['title', 'description', 'support', 'back', 'thanks', 'methods', 'scan', 'enlarge', 'zoom', 'note', 'close', 'save_hint', 'retry']) {
    assert.equal(typeof reward[key], 'string', `${language}: ${key}`)
  }
}
console.log('Reward template tests passed: article opt-out, empty/invalid accounts, payment selection, escaping and translations.')
