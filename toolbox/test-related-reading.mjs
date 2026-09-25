import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
const require = createRequire(import.meta.url)
const result = await build({ entryPoints: [fileURLToPath(new URL('../scripts/utils/related-reading.ts', import.meta.url))], bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false })
const module = { exports: {} }
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require)
const { relatedReading } = module.exports
const post = (id, title, content, extra = {}) => ({ path: `posts/${id}.html`, title, content, date: new Date('2020-01-01'), ...extra })
const a = post('a', '数组双指针去重', '<p>双指针遍历有序数组，删除重复元素。</p><a href="b.html">引用文章</a>')
const b = post('b', '数组双指针去重', a.content)
const c = post('c', '数组双指针删除', '<p>双指针遍历数组，删除相同元素，保留剩余数组。</p>')
const incoming = post('in', c.title, c.content + '<a href="a.html">A</a>')
const secret = post('secret', a.title, a.content, { password: 'secret' })
const unrelated = post('z', '星空摄影', '<p>月亮星空银河摄影曝光。</p>')
const config = { url: 'https://example.test', root: '/', future: false }
let matches = relatedReading([a, b, c, incoming, secret, unrelated], config)
assert.equal(matches.get(a.path)[0].post.path, c.path)
assert.ok(!matches.get(a.path).some(item => [a.path,b.path,incoming.path,secret.path,unrelated.path].includes(item.post.path)))
assert.ok(!matches.has(secret.path))
assert.equal(matches.get(unrelated.path).length, 0)
assert.equal(relatedReading([], config).size, 0)
const many = Array.from({length: 8}, (_, i) => post('match' + i, c.title, c.content))
assert.equal(relatedReading([a,...many], config).get(a.path).length, 4)
assert.deepEqual(relatedReading([a,...many], config).get(a.path).map(x => x.post.path), relatedReading([...many,a], config).get(a.path).map(x => x.post.path))
// Same tags alone should not turn unrelated topics into recommendations.
a.tags = [{ name: 'blog' }]; unrelated.tags = a.tags
assert.equal(relatedReading([a,unrelated], config).get(a.path).length, 0)
// Exercise the render-time helpers: select navigation once, then fill four
// recommendations after excluding its two actual destinations.
const helpers = new Map()
let beforeGenerate
const fixturePosts = [a, ...many, secret]
const hexo = { config, theme: { config: {} }, locals: { get: () => ({ toArray: () => fixturePosts }) }, extend: {
  helper: { register: (name, helper) => helpers.set(name, helper), get: name => helpers.get(name) },
  filter: { register: (_name, handler) => { beforeGenerate = handler } }, generator: { register() {} }
} }
const filterBuild = await build({ entryPoints: [fileURLToPath(new URL('../scripts/filters/related-reading.ts', import.meta.url))], bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false })
new Function('hexo', 'require', filterBuild.outputFiles[0].text)(hexo, require)
beforeGenerate()
a.next = many[0]; a.prev = many[1]
const navigation = helpers.get('reading_navigation')(a)
assert.equal(navigation.left, a.next)
assert.equal(navigation.right, a.prev)
const deduped = helpers.get('related_reading')(a, [navigation.left.path, navigation.right.path])
assert.equal(deduped.length, 4)
assert.ok(deduped.every(match => ![a.next.path, a.prev.path].includes(match.post.path)))
a.next = secret; a.prev = null
const fallback = helpers.get('reading_navigation')(a)
assert.ok(![a.path, secret.path].includes(fallback.left.path))
assert.notEqual(fallback.left.path, fallback.right.path)
assert.equal(fallback.leftType, 'random')
a.related_reading = false
assert.deepEqual(helpers.get('related_reading')(a), [])
assert.ok(helpers.get('reading_navigation')(a).left, 'disabling recommendations preserves navigation')
console.log('Related reading: ranking, limits, navigation deduplication/refill, privacy, fallback, empty matches, deterministic ordering passed.')
