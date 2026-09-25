import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { load as yaml } from 'js-yaml'
const require = createRequire(import.meta.url)
const entry = fileURLToPath(new URL('../scripts/utils/article-graph.ts', import.meta.url))
const result = await build({ entryPoints: [entry], bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false })
const module = { exports: {} }
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require)
const { buildGraphIndex, graphViews, publicGraphPost } = module.exports
const config = { url: 'https://example.test/blog/', root: '/blog/', future: false, encrypt: { tags: [{ name: 'private', password: 'fixture-only' }] } }
const post = (path, content = '', extra = {}) => ({ path, title: path, published: true, date: new Date('2020-01-01'), content, ...extra })
const a = post('posts/a.html', `<a href="b.html#part">B</a><a href="/blog/posts/b.html?q=1">duplicate</a>
 <a href="https://old.test/blog/posts/b.html">alias</a><a href="https://external.test/blog/posts/c.html">external</a>
 <a href="/blog/posts/c.html">C</a><a href="/blog/posts/a.html">self</a><a href="#section">anchor</a>
 <a href="/blog/posts/secret.html">secret</a><a href="/blog/posts/hidden.html">hidden</a><a href="/blog/posts/draft.html">draft</a>
 <a href="/blog/posts/tag.html">tagged secret</a><a href="/blog/posts/optout.html">index optout</a>
 <a href="/blog/posts/missing.html">missing</a><a href="/outside.html">outside root</a>
 <pre><a href="/blog/posts/example.html">code example</a></pre><code><a href="/blog/posts/example.html">inline code</a></code>
 <a href="/blog/%E4%B8%AD%E6%96%87/">encoded</a><a href="/blog/中文/index.html">index alias</a><a href="javascript:alert(1)">scheme</a>`)
const b = post('posts/b.html', '<a href="a.html">A</a>', { title: 'Same title' })
const c = post('posts/c.html', '', { title: 'Same title', article_graph: false })
const privatePosts = [
 post('posts/secret.html', '', { password: 'fixture-only' }), post('posts/hidden.html', '', { hidden: true }),
 post('posts/draft.html', '', { published: false }), post('posts/tag.html', '', { tags: { toArray: () => [{ name: 'private' }] } }),
 post('posts/optout.html', '', { graph_index: false }), post('posts/future.html', '', { date: new Date('2999-01-01') }),
 post('posts/encrypted.html', '<div id="hexo-blog-encrypt">ciphertext</div>'),
 post('posts/draft-source.html', '', { source: '_drafts/example.md' })
]
const posts = [a, b, c, post('posts/example.html'), post('中文/index.html'), ...privatePosts]
let index = buildGraphIndex(posts, config, ['https://old.test'])
assert.equal(index.nodes.size, 5)
assert.deepEqual([...index.outgoing.get(a.path)].sort(), [b.path, c.path, '中文/index.html'].sort())
assert.deepEqual([...index.incoming.get(a.path)], [b.path])
assert.deepEqual([...index.incoming.get(c.path)], [a.path], 'hiding the widget does not remove the node')
let views = graphViews(index, 3)
assert.equal(views.get(a.path).nodes.length, 3)
assert.equal(views.get(a.path).truncated, true)
assert.equal(views.get(a.path).outgoing.length, 3, 'full reference lists survive graph limits')
assert.equal(views.get(a.path).nodes.find(node => node.id === b.path).relation, 'mutual')
assert.equal(views.has('posts/example.html'), false, 'isolated pages have no empty widget')
assert.equal(publicGraphPost(post('public', '', { tags: [{name:'private'}], password: '' }), config), true)
assert.equal(publicGraphPost(post('future', '', {date:new Date('2999-01-01')}), {...config,future:true}), true)
assert(!JSON.stringify([...views]).includes('fixture-only'))
a.content = '<a href="b.html">B</a>'
index = buildGraphIndex(posts, config)
assert.equal(index.incoming.get(c.path).size, 0, 'editing a cached post removes stale backlinks')
index = buildGraphIndex(posts.filter(p => p !== b), config)
assert.equal(index.incoming.get(a.path).size, 0, 'deleting a post removes incoming references')
const cases = buildGraphIndex([post('A.html','<a href="a.html">case</a>'), post('a.html'), post('double%2520.html')], {...config,root:'/'})
assert.deepEqual([...cases.outgoing.get('A.html')], ['a.html'], 'identities retain case')
const pug = createRequire(require.resolve('hexo-renderer-pug'))('pug')
const render = pug.compileFile(fileURLToPath(new URL('../layout/_partials/post/article-graph.pug', import.meta.url)))
const malicious = post('posts/x.html','<a href="y.html">Y</a>',{title:'</script><img src=x onerror=alert(1)>'})
const graph = graphViews(buildGraphIndex([malicious, post('posts/y.html')],config)).get(malicious.path)
const language = yaml(readFileSync(new URL('../languages/zh-CN.yml', import.meta.url),'utf8'))
const strings = language.article_graph
const locals = { post:malicious, site:{posts:{findOne:()=>null}}, article_graph:()=>graph, url_for:p=>'/blog/'+p, __:(key,...args)=>args.reduce((s,v)=>s.replace('%s',v),key.split('.').reduce((value,part)=>value?.[part],language) || key) }
const html = render(locals)
assert(!html.includes('<img src=x'), 'titles are not executable markup')
assert(html.includes('\\u003c/script>'), 'JSON cannot terminate its script container')
assert(html.includes('href="/blog/posts/y.html"'), 'reference links respect deployment root')
const previewHTML = render({...locals, site:{posts:{findOne:query=>query.path === 'posts/y.html' ? {title:'Related'} : null}},
 article_preview:()=>({ai:false,versions:[],original:'<img src=x onerror=alert(1)>',defaultIndex:0})})
assert(previewHTML.includes('class="article-preview"'), 'graph references reuse the shared archive preview')
assert(previewHTML.includes('article-graph-preview-outgoing-0'), 'reference preview IDs are scoped by direction and row')
assert(!previewHTML.includes('<img src=x'), 'related excerpts are rendered as escaped text')
assert(!html.includes('data-graph-reference-footer'), 'small lists do not need pagination controls')
const pagedHTML = render({...locals, article_graph:()=>({...graph,total:7,outgoing:Array.from({length:6},(_,i)=>({id:`posts/ref-${i}.html`,title:`Reference ${i}`}))})})
assert(pagedHTML.includes('data-graph-reference-footer'), 'more than five references expose pagination controls')
assert(pagedHTML.includes('展开全部 6 篇'), 'expand-all reports the complete group count')
assert(pagedHTML.includes('href="/blog/posts/ref-5.html"'), 'later pages remain in HTML for the no-JavaScript fallback')
assert(/article-graph-references[^>]*open/.test(pagedHTML), 'large reference lists default to expanded')
assert.equal(render({...locals,article_graph:()=>null}).trim(), '')
for (const lang of ['en','ja','zh-CN','zh-TW','zh-HK']) {
 const values=yaml(readFileSync(new URL(`../languages/${lang}.yml`,import.meta.url),'utf8')).article_graph
 for(const key of Object.keys(strings)) assert.equal(typeof values[key],'string',`${lang}: ${key}`)
}
const hookBuild = await build({entryPoints:[fileURLToPath(new URL('../scripts/filters/article-graph.ts',import.meta.url))],bundle:true,packages:'external',platform:'node',format:'cjs',write:false})
let beforeGenerate, helper, cachedPosts = [post('one.html','<a href="two.html">two</a>'),post('two.html')]
const theme = {article_graph:{enable:true}}
const hexo = {config, theme:{config:theme},locals:{get:()=>({toArray:()=>cachedPosts})},extend:{
 filter:{register:(name,fn,priority)=>{assert.equal(name,'before_generate');assert(priority>10);beforeGenerate=fn}},
 helper:{register:(_,fn)=>{helper=fn}}
}}
new Function('hexo','require',hookBuild.outputFiles[0].text)(hexo,require)
await beforeGenerate()
assert.equal(helper.call({theme},cachedPosts[1]).incoming.length,1)
cachedPosts[0].content=''
await beforeGenerate()
assert.equal(helper.call({theme},cachedPosts[1]),null,'a repeated generation replaces the helper index for cached pages')
cachedPosts[0].content='<a href="two.html">two</a>'
await beforeGenerate()
assert.equal(helper.call({theme},{...cachedPosts[1],article_graph:false}),null)
cachedPosts.pop()
await beforeGenerate()
assert.equal(helper.call({theme},cachedPosts[0]),null,'deleted destinations cannot remain in cached widget data')
console.log('Article graph: direction, mutual links, URL/root/encoding/case, privacy, cached edits/deletions, limits, template escaping and languages passed.')
