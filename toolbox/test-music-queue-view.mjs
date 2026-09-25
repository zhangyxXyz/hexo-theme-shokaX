import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const calls = [], frames = [], observers = []
globalThis.requestAnimationFrame = fn => { frames.push(fn); return frames.length }
globalThis.window = { addEventListener() {} }
globalThis.ResizeObserver = class { observe() {} unobserve() {} }
let mutate
globalThis.MutationObserver = class { constructor(fn) { mutate=fn } observe() {} }
globalThis.IntersectionObserver = class {
  constructor(fn) { this.callback=fn; observers.push(this) }
  observe() {} unobserve() {} disconnect() {}
}
const root = { scrollTop: 0, isConnected: true, listeners: {},
  getBoundingClientRect: () => ({top:100,bottom:164,height:64}),
  addEventListener(name,fn) { this.listeners[name]=fn }, removeEventListener(name) { delete this.listeners[name] }
}
let rows = Array.from({length:15}, (_,index) => ({
  dataset: {musicPlaylist:'group',musicSource:String(index)}, isConnected:true,
  getBoundingClientRect() { const top=100+index*32-root.scrollTop; return {top,bottom:top+32,height:32} },
  closest: () => root
}))
let expanded='true'
globalThis.document = {getElementById: id => id==='showBtn'?{getAttribute:()=>expanded}:{querySelectorAll: () => rows}}
globalThis.queueTestCalls = calls
const result = await build({ entryPoints:[fileURLToPath(new URL('../source/js/_app/components/music-queue-view.ts',import.meta.url))], bundle:true, format:'cjs', write:false,
  plugins:[{name:'queue-spy',setup(build){build.onResolve({filter:/^\.\/music-queue$/},()=>({path:'queue',namespace:'spy'}));build.onLoad({filter:/.*/,namespace:'spy'},()=>({contents:'export const requestMusicRow=(p,s)=>globalThis.queueTestCalls.push(["request",s]); export const releaseMusicRow=(p,s)=>globalThis.queueTestCalls.push(["release",s]);'}))}}]
})
const module={exports:{}}; new Function('module','exports',result.outputFiles[0].text)(module,module.exports)
const flush=()=>{while(frames.length)frames.shift()()}
module.exports.initMusicQueueViewport()
assert.deepEqual(calls.splice(0), [0,1,2,3,4].map(i=>['request',String(i)]), 'only visible rows plus three below')
root.scrollTop=160; root.listeners.scroll(); flush()
assert.deepEqual(calls.filter(c=>c[0]==='release'), [['release','0'],['release','1']])
assert.deepEqual(calls.filter(c=>c[0]==='request').map(c=>c[1]), ['2','3','4','5','6','7','8','9'])
calls.length=0
// Reproduce a delayed observer exit for a source that is actually visible.
observers.at(-1).callback([{target:rows[5],isIntersecting:false}]); flush()
assert.ok(calls.some(([kind,key])=>kind==='request'&&key==='5'))
assert.ok(!calls.some(([kind])=>kind==='release'), 'stale exit never cancels visible demand')
calls.length=0
const old=rows[5]; old.isConnected=false; rows[5]={...old,isConnected:true}
mutate(); flush()
assert.ok(!calls.some(([kind,key])=>kind==='release'&&key==='5'), 'DOM replacement retains demand by source identity')
assert.ok(calls.some(([kind,key])=>kind==='request'&&key==='5'))
calls.length=0; expanded='false'; mutate(); flush()
assert.equal(calls.filter(([kind])=>kind==='release').length,8, 'closing the translated panel releases viewport demand even when its layout box stays nonzero')
assert.equal(calls.filter(([kind])=>kind==='request').length,0)
calls.length=0; expanded='true'; mutate(); flush()
assert.equal(calls.filter(([kind])=>kind==='request').length,8, 'reopening restores current demand')
console.log('Music viewport: exact three-row margin, scroll cancellation, stale observer exit and DOM replacement passed.')
