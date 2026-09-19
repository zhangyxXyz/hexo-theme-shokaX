import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const render = createRequire(require.resolve('hexo-renderer-pug'))('pug').compile(
  fs.readFileSync(new URL('../layout/_mixin/comment.pug', import.meta.url), 'utf8') + '\n+CommentEntry()\n+CommentRender()\n'
)
const base = { shokax_inject: () => '', __: key => key }
for (const global of ['slide', 'bottom']) {
  for (const override of [undefined, 'slide', 'bottom']) {
    for (const side of ['left', 'right']) {
      const html = render({ ...base, page: { comment_layout: override }, theme: { waline: { enable: true, layout: global }, twikoo: {}, sidebar: { position: side } } })
      const layout = override ?? global
      assert.ok(html.includes(`data-comment-layout="${layout}"`))
      assert.ok(html.includes(`data-side="${side}"`))
      assert.equal(/class="comment-shell"[^>]*\shidden/.test(html), layout === 'slide')
      assert.ok(html.includes('comment-entry-button'))
      assert.ok(html.includes('href="#comments"'))
    }
  }
}
for (const enabled of [true, false]) {
  const html = render({ ...base, page: { comment: false }, theme: { waline: { enable: enabled }, twikoo: {}, sidebar: {} } })
  assert.ok(!html.includes('id="comments"'))
  assert.ok(!html.includes('comment-entry'))
}
assert.ok(!render({ ...base, page: {}, theme: { waline: {}, twikoo: {}, sidebar: {} } }).includes('id="comments"'))
console.log('Comment layout: 15 override, side and disabled cases passed.')
