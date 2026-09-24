import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'

const result = await build({
  entryPoints: [new URL('../source/js/_app/components/visitors.ts', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')],
  bundle: true, write: false, format: 'iife', globalName: 'visitorModule',
  plugins: [{ name: 'config', setup(build) {
    build.onResolve({ filter: /globals\/globalVars$/ }, () => ({ path: 'config', namespace: 'test' }))
    build.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const CONFIG = globalThis.testConfig' }))
  } }]
})

const config = { hostname: 'https://example.com', visitor: { enable: true, type: 'busuanzi' }, waline: { serverURL: 'https://comments.example' } }
const node = () => ({ textContent: '—', removeAttribute() {} })
let page = {}, article = node()
const site = node(), display = node(), scripts = [], timers = new Map()
let timerId = 0
const context = vm.createContext({
  testConfig: config, URL, URLSearchParams, AbortController, console,
  location: { hostname: 'example.com', pathname: '/posts/1.html' },
  document: {
    getElementById: () => page,
    querySelectorAll: selector => selector.includes(',') ? [article, display] : selector === '[data-visitor-page]' ? [article] : [site],
    createElement: () => ({ remove() { this.removed = true } }),
    head: { appendChild: script => scripts.push(script) }
  },
  setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId },
  clearTimeout: id => timers.delete(id)
})
context.window = context
vm.runInContext(result.outputFiles[0].text, context)
const refresh = () => context.visitorModule.refreshVisitors()
const flush = async () => { await Promise.resolve(); await Promise.resolve() }
const reply = (script, data) => context[new URL(script.src).searchParams.get('jsonpCallback')](data)
const navigate = path => { page = {}; article = node(); context.location.pathname = path; refresh() }

refresh()
assert.equal(scripts.length, 1)
assert.equal(scripts[0].referrerPolicy, 'no-referrer-when-downgrade')
refresh()
assert.equal(scripts.length, 1, 'same-page setup must not increment twice')
reply(scripts[0], { page_pv: 42, site_uv: 12345 })
await flush()
assert.equal(article.textContent, '42')
assert.equal(site.textContent, '12345')
assert.ok(scripts[0].removed)

navigate('/posts/2.html')
const stale = scripts.at(-1)
navigate('/posts/3.html')
reply(stale, { page_pv: 999, site_uv: 999 })
await flush()
assert.equal(article.textContent, '—', 'late response must not update the next article')
reply(scripts.at(-1), { page_pv: 0, site_uv: 10 })
await flush()
assert.equal(article.textContent, '0', 'zero is a valid count')
navigate('/posts/1.html')
assert.equal(scripts.length, 4, 'return navigation is a new visit')
reply(scripts.at(-1), { page_pv: -1, site_uv: 'bad' })
await flush()
assert.equal(article.textContent, '—')
assert.equal(site.textContent, '')

config.visitor.type = 'custom'
navigate('/custom')
await flush()
assert.equal(scripts.length, 4)
config.visitor.type = 'busuanzi'
config.visitor.enable = false
navigate('/disabled')
assert.equal(scripts.length, 4)
config.visitor.enable = true
for (const hostname of ['localhost', '127.0.0.1', '[::1]', 'preview.example.com']) {
  context.location.hostname = hostname
  navigate('/preview/' + hostname)
}
assert.equal(scripts.length, 4, 'previews must not send analytics requests')
context.location.hostname = 'example.com'
navigate('/failure')
scripts.at(-1).onerror()
await flush()
assert.equal(article.textContent, '—')
navigate('/timeout')
const timeout = [...timers.values()].find(timer => timer.delay === 10_000)
timeout.fn()
await flush()
assert.ok(scripts.at(-1).removed)
assert.equal(article.textContent, '—')
console.log('Visitors: shared request, duplicate setup, navigation, stale responses, zero/invalid data, disabled/custom/local, failure and timeout passed.')

// Exercise the site's Waline provider without writing any real statistics.
const requests = []
context.fetch = async (url, init) => {
  requests.push({ url: String(url), ...init })
  return { ok: true, json: async () => ({ errno: 0, data: String(url).includes('site=1') ? { pageViews: 100 } : [{ time: 7 }] }) }
}
config.visitor = { enable: true, type: 'waline', site: true, readOnly: false }
config.waline = { serverURL: 'https://comments.example' }
const settle = () => new Promise(resolve => setImmediate(resolve))
navigate('/posts/one.html'); await settle(); refresh(); await settle()
assert.equal(requests.filter(row => row.method === 'POST').length, 1)
navigate('/posts/two.html'); await settle()
navigate('/posts/one.html'); await settle()
assert.deepEqual(requests.filter(row => row.method === 'POST').map(row => JSON.parse(row.body)), [
  { path: '/posts/one.html', type: 'time', action: 'inc' },
  { path: '/posts/two.html', type: 'time', action: 'inc' },
  { path: '/posts/one.html', type: 'time', action: 'inc' }
])
assert.equal(article.textContent, '7')
assert.equal(site.textContent, '100')
context.location.hostname = 'localhost'; navigate('/posts/local.html'); await settle()
assert.equal(requests.filter(row => row.method === 'POST').length, 3)
assert.ok(requests.some(row => row.url.includes('path=%2Fposts%2Flocal.html') && !row.method))
console.log('Waline navigation: one increment per page, repeated init ignored, back visit incremented, updated page/site counts and localhost GET-only passed.')
