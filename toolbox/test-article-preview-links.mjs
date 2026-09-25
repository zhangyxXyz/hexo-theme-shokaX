import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
const output = await build({ entryPoints: [fileURLToPath(new URL('../source/js/_app/components/article-preview-links.ts', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', write: false })
const module = { exports: {} }
const manifest = { source: '/blog/article-previews.html', paths: ['/blog/posts/b.html', '/blog/中文/index.html'], origins: ['https://example.test', 'https://old.test'] }
let manifestElement = { textContent: JSON.stringify(manifest) }
const document = { querySelector: () => manifestElement }
const location = { href: 'http://localhost:4000/blog/posts/a.html', origin: 'http://localhost:4000', pathname: '/blog/posts/a.html' }
let requests = 0, parses = 0, scans = 0, fail = false
const fetch = async () => { requests++; if (fail) throw new Error('offline'); return { ok: true, text: async () => 'preview fixture' } }
class DOMParser {
  parseFromString() {
    parses++
    return { querySelectorAll: () => {
      scans++
      return manifest.paths.map(path => ({ dataset: { previewPath: path }, querySelector: () => ({ cloneNode: () => ({ path }) }) }))
    } }
  }
}
new Function('module', 'exports', 'document', 'location', 'fetch', 'DOMParser', output.outputFiles[0].text)(module, module.exports, document, location, fetch, DOMParser)
const target = (href, excluded = false, download = false) => {
  const anchor = { closest: () => excluded ? {} : null, getAttribute: () => href, hasAttribute: () => download }
  return module.exports.articlePreviewTarget({ closest: () => anchor })
}
assert.equal(target('b.html?x=1#section'), '/blog/posts/b.html')
assert.equal(target('https://old.test/blog/posts/b.html'), '/blog/posts/b.html')
assert.equal(target('/blog/%E4%B8%AD%E6%96%87/'), '/blog/中文/index.html')
for (const href of ['#section', 'a.html', 'https://evil.test/blog/posts/b.html', 'https://user:pass@example.test/blog/posts/b.html', 'javascript:void(0)', '/blog/posts/private.html', '/blog/tags/Hexo/']) assert.equal(target(href), undefined)
assert.equal(target('b.html', true), undefined)
assert.equal(target('b.html', false, true), undefined)
console.log('Article previews: public allowlist, relative URLs, root, canonical aliases, encoding, self/anchor/external/download exclusions passed.')
const { loadArticlePreview } = module.exports
const [one, two] = await Promise.all([loadArticlePreview(manifest.paths[0]), loadArticlePreview(manifest.paths[0])])
assert.equal(one.path, manifest.paths[0])
assert.notEqual(one, two, 'Each caller receives an independent clone')
await loadArticlePreview(manifest.paths[1])
assert.equal(await loadArticlePreview('/missing'), undefined)
assert.deepEqual([requests, parses, scans], [1, 1, 1], 'Cached lookups do not fetch, parse or scan the entire bank again')
manifest.paths = ['/blog/posts/new.html']
manifest.source = '/blog/new-previews.html'
manifestElement = { textContent: JSON.stringify(manifest) }
assert.equal(target('b.html'), undefined)
assert.equal(target('new.html'), manifest.paths[0], 'PJAX manifest replacement rebuilds the path index')
fail = true
await assert.rejects(loadArticlePreview(manifest.paths[0]), /offline/)
fail = false
assert.equal((await loadArticlePreview(manifest.paths[0])).path, manifest.paths[0], 'A failed download can be retried')
assert.deepEqual([requests, parses, scans], [3, 2, 2])
console.log('Article preview index: shared fetch, one-time parsing/indexing, independent clones, PJAX invalidation and failure retry passed.')
