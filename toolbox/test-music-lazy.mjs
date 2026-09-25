import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { build } from 'esbuild'

const source = await fs.readFile(new URL('../source/js/_app/player.ts', import.meta.url), 'utf8')
const result = await build({ stdin: { contents: source, loader: 'ts' }, bundle: true, format: 'cjs', write: false,
  plugins: [{ name: 'player-fixture', setup(builder) {
    builder.onResolve({ filter: /.*/ }, args => ({ path: args.path, namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
      export const CONFIG={audio:[],playerAPI:''};
      export const createMusicQueue=(...args)=>fixture.queue(...args);
      export const subscribeMusicState=callback=>fixture.subscribe(callback);
      export const initPlayer=()=>fixture.mount();
      export const initMusicOverlay=()=>{}; export const initMusicVisualizer=()=>{};
      export const initMusicQueueViewport=()=>{}; export const initMusicSeek=()=>{}; export const initMusicVolumeTooltip=()=>{};` }))
  } }] })
const button = () => {
  const listeners = [], attributes = new Map()
  return { dataset: {}, disabled: false, addEventListener: (_type, fn) => listeners.push(fn),
    setAttribute: (name, value) => attributes.set(name, value), getAttribute: name => attributes.get(name),
    click() { if (this.disabled) return; let stopped = false; for (const fn of listeners) { fn({ stopImmediatePropagation() { stopped = true } }); if (stopped) break } } }
}
async function scenario(trigger, cancel = false, failFirst = false) {
  const play = button(), show = button(), host = { dataset: { show: 'show', play: 'play', pause: 'pause', loading: 'loading', error: 'retry', close: 'close' } }
  const listeners = new Set(), shells = []
  let requests = 0, mounts = 0, plays = 0, opens = 0, queues = 0
  const element = () => ({ ...button(), children: [], append(...children) { this.children.push(...children) }, remove() { this.removed = true }, querySelector() { return this.children.find(child => child.getAttribute('role') === 'status') } })
  const fixture = {
    queue() { queues++; return { urls: [{ name: 'Songs', url: 'queue' }], start() { requests++ } } },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
    mount() { mounts++; if (failFirst && mounts === 1) throw Error('Unavailable module'); queueMicrotask(() => {
      listeners.forEach(fn => fn({ playing: false }))
      play.addEventListener('click', () => plays++)
      show.addEventListener('click', () => opens++)
    }) }
  }
  const module = { exports: {} }
  new Function('module', 'exports', 'fixture', 'document', 'window', 'MutationObserver', 'sessionStorage', 'console', result.outputFiles[0].text)(
    module, module.exports, fixture, { createElement: element, body: { append: node => shells.push(node) }, addEventListener() {}, getElementById: id => ({ player: host, playBtn: play, showBtn: show })[id] },
    { setTimeout }, class { observe() {} }, { removeItem() {} }, { warn() {} })
  module.exports.initAudioPlayer()
  module.exports.initAudioPlayer()
  assert.equal(requests, 0, 'page initialization must not request music metadata')
  assert.equal(mounts, 0)
  const action = trigger === 'play' ? play : show
  action.click()
  assert.equal(shells.length, 1, 'first click synchronously displays a shell before importing Nyx or fetching metadata')
  assert.equal(shells[0].hidden, false)
  assert.equal(action.disabled, false, 'loading must leave controls responsive')
  assert.equal(queues, 1)
  if (cancel) action.click()
  await new Promise(resolve => setImmediate(resolve))
  if (failFirst) {
    assert.equal(requests, 0)
    assert.equal(shells[0].querySelector().textContent, 'retry')
    action.click()
    await new Promise(resolve => setImmediate(resolve))
  }
  assert.equal(mounts, failFirst ? 2 : 1)
  assert.equal(requests, 1, 'metadata starts after mounting, without blocking the panel')
  assert.equal(queues, 1, 'repeated actions reuse one queue')
  assert.equal(plays, trigger === 'play' && !cancel ? 1 : 0)
  assert.equal(opens, trigger === 'play' || (!cancel && !failFirst) ? 1 : 0)
  assert.equal(shells[0].removed, true)
  action.click()
  assert.equal(requests, 1, 'ready player must reuse the queue')
  assert.equal(listeners.size, 0, 'mount subscription must be cleaned up')
}
await scenario('show')
await scenario('play')
await scenario('show', true)
await scenario('play', true)
await scenario('show', false, true)
console.log('Music lazy load: immediate shell, zero initial requests, queued/cancelled intent, single mount and module retry passed.')
