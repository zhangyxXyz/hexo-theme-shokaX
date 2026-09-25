import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
const bundle = await build({entryPoints:[fileURLToPath(new URL('../source/js/_app/components/fireworks/renderer.js',import.meta.url))],bundle:true,write:false,format:'iife',globalName:'fireworks'})
const emitter=()=>{const listeners=new Map();return {addEventListener(t,f){if(!listeners.has(t))listeners.set(t,new Set());listeners.get(t).add(f)},removeEventListener(t,f){listeners.get(t)?.delete(f)},emit(t,e){for(const f of listeners.get(t)||[])f(e)},count(t){return listeners.get(t)?.size||0}}}
let now=0,id=0,created=0,clears=0,positions=[];const frames=new Map();
const ctx=new Proxy({clearRect(){clears++;positions=[]},translate(x,y){positions.push([x,y])}},{get:(o,k)=>o[k]||(()=>{})});
const doc={...emitter(),hidden:false,documentElement:{clientWidth:390,clientHeight:844},body:{appendChild(){}},createElement(){created++;return {style:{},getContext:()=>ctx,remove(){}}}};
const win={...emitter(),devicePixelRatio:2},media={...emitter(),matches:false};
const context=vm.createContext({document:doc,window:win,matchMedia:()=>media,Date:{now:()=>now},performance:{now:()=>now},requestAnimationFrame(f){frames.set(++id,f);return id},cancelAnimationFrame(i){frames.delete(i)}});
vm.runInContext(bundle.outputFiles[0].text,context);
const options={excludeElements:['a'],particles:[{shape:'circle',move:['emit'],colors:['pink'],number:30,duration:1800,shapeOptions:{radius:20}},{shape:'circle',move:['diffuse'],colors:['white'],number:1,duration:1800,shapeOptions:{radius:20}}]};
const init=()=>context.fireworks.default(options);
const click=(pointerType='mouse',x=10,excluded=false,button=0)=>doc.emit('click',{pointerType,button,clientX:x,clientY:10,target:{closest:()=>excluded}});
const tick=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(f=>f())};
let cleanup=init();click('touch');click('pen');click('');click('mouse',10,true);click('mouse',10,false,2);assert.equal(created,0);assert.equal(frames.size,0);
click();assert.equal(created,1);assert.equal(frames.size,1);tick();assert.equal(positions.length,31);
now=100;click();tick();assert.equal(positions.length,31,'150ms rate limit');
for(let i=1;i<=3;i++){now=i*200;click('mouse',100*i)}
assert.equal(frames.size,1,'one shared frame');tick();assert.equal(positions.length,93);assert.ok(positions.every(([x])=>x!==10),'oldest burst replaced');assert.ok(positions.some(([x])=>x===300),'latest click rendered');
now=2500;tick();assert.equal(frames.size,0);assert.equal(positions.length,0);const endClears=clears;tick();assert.equal(clears,endClears,'no idle clears');
click();doc.hidden=true;doc.emit('visibilitychange');assert.equal(frames.size,0);assert.equal(positions.length,0);click();assert.equal(frames.size,0);
doc.hidden=false;click();assert.equal(frames.size,1);media.matches=true;media.emit('change');assert.equal(frames.size,0);click();assert.equal(frames.size,0);media.matches=false;
cleanup=init();assert.equal(doc.count('click'),1,'reinitialization has one listener');click();cleanup();assert.equal(frames.size,0);assert.equal(doc.count('click'),0);assert.equal(doc.count('visibilitychange'),0);
console.log('Fireworks: input filtering, rate limit, oldest replacement, shared frame, idle stop, visibility, reduced motion and cleanup passed.')
