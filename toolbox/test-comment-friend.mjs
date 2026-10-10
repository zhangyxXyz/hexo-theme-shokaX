import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { transform } from 'esbuild'

const source = await fs.readFile(new URL('../source/js/_app/components/comment-friend.ts', import.meta.url), 'utf8')
const { code } = await transform(source, { loader: 'ts', format: 'cjs' })
const module = { exports: {} }
new Function('module', 'exports', code)(module, module.exports)
const { matchesFriendWebsite: match } = module.exports
const friends = ['https://blog.lavender816.top/', 'https://blog.csdn.net/yanglingwell']
for (const url of ['http://BLOG.lavender816.top/posts/1?q=1#x', 'https://blog.lavender816.top', '//blog.lavender816.top/', 'https://blog.csdn.net/yanglingwell/', 'https://blog.csdn.net/yanglingwell/article/details/1']) assert.equal(match(url, friends), true, url)
for (const url of ['', '/friend-links/', 'javascript:alert(1)', 'https://blog.lavender816.top.evil.test', 'https://other.blog.lavender816.top/', 'https://blog.lavender816.top:444/', 'https://blog.csdn.net/other', 'https://blog.csdn.net/yanglingwell-other', 'https://user@blog.lavender816.top/']) assert.equal(match(url, friends), false, url)
assert.equal(match(friends[0], []), false)
console.log('Friend website matching: 15 cases passed.')
// A native level badge must not suppress the independent friend label.
const { syncFriendBadges } = module.exports
for (const nativeClasses of [[], ['wl-badge', 'level2'], ['wl-badge', 'shokax-private-badge'], ['wl-badge']]) {
  let inserted = false
  const native = { classList: Object.assign([...nativeClasses], { contains: value => nativeClasses.includes(value) }) }
  const nick = { getAttribute: () => friends[0], after: () => { inserted = true } }
  const head = {
    querySelector: selector => selector === 'a.wl-nick' ? nick : null,
    querySelectorAll: () => nativeClasses.length ? [native] : [],
    parentElement: { parentElement: { querySelector: () => null } }
  }
  globalThis.document = { createElement: () => ({}) }
  syncFriendBadges({ querySelectorAll: () => [head] }, friends, 'Friend')
  assert.equal(inserted, nativeClasses.length === 0 || nativeClasses.length === 2, nativeClasses.join(' '))
}
console.log('Friend labels coexist with levels and private labels; native identity labels take precedence.')
