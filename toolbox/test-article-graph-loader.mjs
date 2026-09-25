import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const output = await build({entryPoints:[fileURLToPath(new URL('../source/js/_app/components/article-graph-render.ts',import.meta.url))],
 bundle:true,write:false,format:'iife',globalName:'graph',plugins:[{name:'vendor-fixture',setup(build){
 build.onResolve({filter:/globals\/resources$/},()=>({path:'resources',namespace:'fixture'}))
 build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const resourceURL = () => "/resource/static/npm/d3@7.9.0/dist/d3.min.js"'}))
 }}]})
const scripts=[]
const context=vm.createContext({window:{},setTimeout,clearTimeout,document:{
 createElement:()=>({dataset:{},remove(){this.removed=true}}),head:{append:node=>scripts.push(node)}
}})
vm.runInContext(output.outputFiles[0].text,context)
const first=context.graph.loadGraphLibrary(), shared=context.graph.loadGraphLibrary()
assert.equal(first,shared,'simultaneous graph visits share one vendor request')
assert.equal(scripts.length,1)
assert.equal(scripts[0].src,'/resource/static/npm/d3@7.9.0/dist/d3.min.js')
scripts[0].onerror()
assert.equal((await Promise.allSettled([first,shared]))[0].status,'rejected')
assert.equal(scripts[0].removed,true)
const retried=context.graph.loadGraphLibrary()
assert.equal(scripts.length,2,'a failed request can be retried')
context.window.d3={forceSimulation(){}}
scripts[1].onload()
assert.equal(await retried,context.window.d3)
assert.equal(await context.graph.loadGraphLibrary(),context.window.d3)
assert.equal(scripts.length,2,'PJAX reuse does not insert duplicate script elements')
console.log('Article graph loader: localized URL, concurrent loading, failure cleanup, retry and cached reuse passed.')
