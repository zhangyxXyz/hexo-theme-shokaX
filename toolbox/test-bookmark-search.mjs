import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const result = await build({
  entryPoints: [fileURLToPath(new URL('../source/js/_app/components/bookmark-search.ts', import.meta.url))],
  bundle: true, platform: 'node', format: 'cjs', write: false
})
const module = { exports: {} }
new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
const { bookmarkSearchIndex, matchesBookmark } = module.exports
const photo = bookmarkSearchIndex(['Unsplash', 'Beautiful Free Images & Pictures', '素材', '壁纸 照片 wallpaper', 'https://unsplash.com/'])
const hosting = bookmarkSearchIndex(['Vercel', '云服务', '网站部署 静态托管', 'https://vercel.com/dashboard'])
for (const query of ['', '  ', 'UNSPLASH', 'Ｕｎｓｐｌａｓｈ', 'unspla', 'unsplsh', 'unspalsh', '壁纸', '素材 壁纸', 'pictures free', 'unsplash.com']) {
  assert.equal(matchesBookmark(photo, query), true, query)
}
for (const query of ['vercle', 'vercel 云服务', '网站部署']) assert.equal(matchesBookmark(hosting, query), true, query)
for (const query of ['Vercel', '壁纸 云服务', 'zzzzzz', 'un', '<script>', '17']) {
  // "un" is a real substring, while short misspellings must not get fuzzy expansion.
  assert.equal(matchesBookmark(photo, query), query === 'un', query)
}
assert.equal(matchesBookmark(hosting, 'vex'), false)
assert.equal(matchesBookmark(hosting, '云素材'), false)
assert.equal(matchesBookmark(photo, 'x'.repeat(10000)), false)
console.log('Bookmark search tests passed')
