import assert from 'node:assert/strict'
import {fileURLToPath} from 'node:url'
import {build} from 'esbuild'

const result=await build({entryPoints:[fileURLToPath(new URL('../source/js/_app/components/music-queue-view.ts',import.meta.url))],bundle:true,format:'cjs',write:false})
const module={exports:{}}; new Function('module','exports',result.outputFiles[0].text)(module,module.exports)
const {focusMusicRow}=module.exports
let nextFrame=0
const frames=new Map(),events=new Map()
globalThis.requestAnimationFrame=fn=>{frames.set(++nextFrame,fn);return nextFrame}
globalThis.cancelAnimationFrame=id=>frames.delete(id)
const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())}
const root={clientHeight:200,_top:1120,
  get scrollTop(){return this._top},set scrollTop(value){this._top=Math.max(0,Math.min(1120,value))},
  getBoundingClientRect:()=>({top:100,bottom:300,height:200})}
let rows=[]
const row=(key,index)=>({dataset:{musicKey:key},closest:()=>root,getBoundingClientRect(){const top=100+index*32-root.scrollTop;return {top,bottom:top+32,height:32}}})
const panel={querySelectorAll:()=>rows,addEventListener:(event,fn)=>events.set(event,fn),removeEventListener:event=>events.delete(event)}
globalThis.document={getElementById:()=>panel}
rows=[row('first',0),row('last',40)]
focusMusicRow('first');flush()
assert.equal(root.scrollTop,0,'opening at the old tail locates the current first song')
root.scrollTop=1120;focusMusicRow('last');flush()
assert.equal(root.scrollTop,1120,'a fully visible selected song does not move')
root.scrollTop=0;focusMusicRow('not-ready');flush()
assert.equal(frames.size,1,'wait for playlist expansion or a tab transition to mount the row')
rows.push(row('not-ready',30));flush()
assert.equal(root.scrollTop,876,'delayed target is centered after rendering')
root.scrollTop=1120;focusMusicRow('first');events.get('wheel')();flush()
assert.equal(root.scrollTop,1120,'manual browsing cancels pending focus')
focusMusicRow('first');focusMusicRow();flush()
assert.equal(root.scrollTop,1120,'closing cancels focus')
focusMusicRow('first');focusMusicRow('last');flush()
assert.equal(root.scrollTop,1120,'the newest selection wins')
assert.equal(events.size,0,'gesture listeners are cleaned up')
console.log('Music focus: reopen, current visibility, delayed expansion, manual scroll cancellation and newest selection passed.')
