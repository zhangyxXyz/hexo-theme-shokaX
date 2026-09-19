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
