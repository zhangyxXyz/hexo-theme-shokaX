import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const config = { hostname: 'https://example.com', visitor: { baiduAnalytics: 'test-id', baiduSpa: 'manual', readOnly: false } }
async function compile(file, name) {
  const output = await build({
    entryPoints: [fileURLToPath(new URL(file, import.meta.url))], bundle: true, write: false, format: 'iife', globalName: name,
    plugins: [{ name: 'navigation-test-dependencies', setup(build) {
      build.onResolve({ filter: /globals\/globalVars$/ }, () => ({ path: 'globals', namespace: 'test' }))
      build.onResolve({ filter: /^(?:\.\/refresh|\.\.\/globals\/(?:tools|thirdparty))$/ }, () => ({ path: 'lifecycle', namespace: 'test' }))
      build.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => ({ contents: path === 'globals'
        ? 'export const CONFIG = globalThis.config; export const menuToggle = {}; export const sideBar = {}'
        : 'export const siteRefresh = async () => {}; export const pagePosition = () => {}; export const Loader = { show() {}, hide() {}, vanish() {} }' }))
    } }]
  })
  return output.outputFiles[0].text
}

let page = {}
const commands = []
const context = vm.createContext({ config, URL, console, location: { hostname: 'example.com', pathname: '/posts/1.html', search: '' }, document: { getElementById: () => page } })
context.window = { _hmt: { push: command => commands.push(Array.from(command)) } }
vm.runInContext(await compile('../source/js/_app/components/analytics.ts', 'analytics'), context)
const track = () => context.analytics.trackBaiduPageview()
track(); track()
assert.deepEqual(commands, [['_trackPageview', '/posts/1.html']], 'repeat setup must not duplicate a view')
page = {}; context.location.pathname = '/posts/2.html'; track()
page = {}; context.location.pathname = '/posts/1.html'; track()
assert.equal(commands.length, 3, 'back navigation must record a new view')
page = {}; context.location.search = '?page=2'; track()
assert.deepEqual(commands.at(-1), ['_trackPageview', '/posts/1.html?page=2'])
for (const hostname of ['localhost', '127.0.0.1', '[::1]', 'preview.example.com']) {
  page = {}; context.location.hostname = hostname; track()
}
assert.equal(commands.length, 4, 'previews must not send Baidu analytics')
context.location.hostname = 'example.com'
config.visitor.baiduSpa = 'auto'; page = {}; track()
assert.equal(commands.length, 4, 'dashboard auto tracking must exclude manual reporting')
config.visitor.baiduSpa = 'manual'; config.visitor.baiduAnalytics = false; page = {}; track()
assert.equal(commands.length, 4)

vm.runInContext(await compile('../source/js/_app/pjax/navigation.ts', 'navigation'), context)
const current = new URL('https://example.com/posts/1.html')
const event = { button: 0, defaultPrevented: false }
const link = (href, options = {}) => ({ href, target: '', getAttribute: name => name === 'href' ? href : name === 'target' ? options.target || '' : null, hasAttribute: name => name === 'download' && !!options.download, closest: () => options.optOut || null, ...options })
const target = (href, options, eventOptions) => context.navigation.navigationTarget(link(href, options), { ...event, ...eventOptions }, current)
assert.equal(target('https://example.com/posts/2.html#comments').href, 'https://example.com/posts/2.html#comments')
assert.equal(target('/posts/2.html', { href: { baseVal: '/posts/2.html' } }).pathname, '/posts/2.html', 'SVG anchors resolve attributes, not SVGAnimatedString')
assert.equal(target('https://example.com/posts/1.html#comments'), null)
assert.equal(target('https://example.com/file.mp3'), null)
assert.equal(target('https://other.example/posts/2.html'), null)
assert.equal(target('mailto:author@example.com'), null)
assert.equal(target('https://example.com/posts/2.html', { target: '_blank' }), null)
assert.equal(target('https://example.com/posts/2.html', { download: true }), null)
assert.equal(target('https://example.com/posts/2.html', { optOut: true }), null)
for (const option of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey', 'defaultPrevented']) assert.equal(target('https://example.com/posts/2.html', {}, { [option]: true }), null)
assert.equal(target('https://example.com/posts/2.html', {}, { button: 1 }), null)
console.log('Navigation: internal links, hashes, external/download/opt-out/modifier handling; Baidu paths, deduplication, back navigation, query, local/disabled/auto modes passed.')
