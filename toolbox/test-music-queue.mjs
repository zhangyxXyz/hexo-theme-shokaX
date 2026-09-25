import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { reactive, watch, nextTick } from 'vue'

const result = await build({ stdin: { contents: "export * from './source/js/_app/components/music-queue'; export {createMusicPanelLyrics} from './source/js/_app/components/music-state'", resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, bundle: true, format: 'cjs', write: false })
const module = { exports: {} }
new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
const { createMusicQueue, bindMusicQueue, activateMusicRow, moveMusicTrack, createMusicPanelLyrics } = module.exports
const labels = { loading: 'Loading', error: 'Retry' }
const song = id => ({ name: `Song ${id}`, artist: 'Artist', url: `https://audio.example/${id}`, pic: '', lrc: '' })
const waiting = new Map(), starts = []
let allStarted
const started = new Promise(resolve => { allStarted = resolve })
const queue = createMusicQueue([{ title: 'Songs', list: [0, 1, 2, 3].map(id => `https://music.163.com/song?id=${id}`) }], 'https://api.example/', labels, async url => {
  const id = Number(new URL(url).searchParams.get('id'))
  starts.push(id)
  if (starts.length === 4) allStarted()
  return new Promise(resolve => waiting.set(id, resolve))
})
const state = reactive({ currentPlaylistIndex: 0, currentTime: 55, songDuration: 120, playing: true,
  playlists: queue.urls.map(({ url }) => ({ url, playlist: queue.rows(url), index: 0, lastIdx: 0 })),
  get currentSong() { const row = this.playlists[this.currentPlaylistIndex]?.playlist[this.playlists[this.currentPlaylistIndex].index]; return row?.url ? row : null }
})
bindMusicQueue(state)
assert.equal(starts.length, 0)
assert.equal(state.currentSong, null)
queue.start(); queue.start()
// Simulate the visible range explicitly requesting the remaining three slots.
queue.request('0:1'); queue.request('0:2'); queue.request('0:3')
await started
assert.deepEqual(starts, [0, 1, 2, 3], 'default source has first priority and queue starts only once')
const finish = async (id, body, status = 200) => {
  waiting.get(id)(Response.json(body, { status }))
  await new Promise(resolve => setImmediate(resolve))
  await nextTick()
}
await finish(2, [song('C')])
assert.equal(state.playlists[0].playlist[2].name, 'Song C', 'fast responses appear before all sources finish')
assert.equal(state.currentSong, null, 'late default source must not choose an arbitrary fast response')
assert.equal(activateMusicRow(state, 0, 0), false)
assert.equal(activateMusicRow(state, 0, 2), true)
state.playlists[0].index = 2 // User chooses the ready song while others load.
const chosen = state.currentSong
let resets = 0
watch([() => state.currentSong?.url], () => { resets++ }, { flush: 'post' })
await finish(0, [song('A1'), song('A2')])
assert.equal(state.playlists[0].index, 3, 'insertion before current row shifts its index')
assert.equal(state.currentSong, chosen, 'same selected object survives insertion')
assert.equal(resets, 0, 'batched source watchers must not reset audio on list updates')
assert.equal(state.currentTime, 55)
assert.equal(state.songDuration, 120)
const warn = console.warn
console.warn = () => {}
try { await finish(1, [], 503) } finally { console.warn = warn }
assert.equal(state.playlists[0].playlist[2].status, 'error')
assert.equal(state.currentSong, chosen)
await finish(3, [song('D')])
await queue.idle()
assert.equal(activateMusicRow(state, 0, 2), false, 'retry is not track activation')
activateMusicRow(state, 0, 2)
// Wait for the paced manual retry to start without resolving other sources.
while (starts.length < 5) await new Promise(resolve => setTimeout(resolve, 20))
assert.deepEqual(starts, [0, 1, 2, 3, 1], 'only the failed source retries once')
await finish(1, [song('B1'), song('B2')])
await queue.idle()
assert.equal(state.currentSong, chosen)
assert.equal(resets, 0, 'retry and insertion do not change the watched source')
moveMusicTrack(state.playlists[0], 'previous')
assert.equal(state.currentSong.name, 'Song B2')
moveMusicTrack(state.playlists[0], 'next')
assert.equal(state.currentSong, chosen)
assert.deepEqual(state.playlists[0].playlist.map(row => row.name), ['Song A1', 'Song A2', 'Song B1', 'Song B2', 'Song C', 'Song D'])

const defaults = createMusicQueue([{ title: 'Defaults', list: ['https://music.163.com/song?id=1'] }], 'https://api.example/', labels, async () => Response.json([song('Default')]))
const idle = reactive({ currentPlaylistIndex: 0, playlists: defaults.urls.map(({ url }) => ({ url, playlist: defaults.rows(url), index: 0, lastIdx: 0 })), get currentSong() { return this.playlists[0].playlist[this.playlists[0].index] } })
bindMusicQueue(idle)
defaults.start(); await defaults.idle()
assert.equal(idle.currentSong.name, 'Song Default')
let preview, finishLyrics
const panel = createMusicPanelLyrics(rows => { preview = rows }, () => new Promise(resolve => { finishLyrics = resolve }))
panel.update({ song: { ...song('Default'), lrc: 'https://lyrics.example/a' }, time: 0, panelOpen: true, playing: false })
finishLyrics([{ start: 10, end: 20, text: 'First preview' }, { start: 20, end: Infinity, text: 'Next' }])
await Promise.resolve()
assert.equal(preview[0].text, 'First preview', 'opening a paused panel renders lyrics as soon as they arrive')
panel.update({ song: { ...song('Other'), lrc: '' }, time: 0, panelOpen: true, playing: false })
assert.deepEqual(preview, [], 'new song clears the previous lyric preview')
console.log('Music queue: progressive order, placeholders, stable reactive selection, uninterrupted clock, partial retry, navigation and paused preview passed.')

const demandRequests = []
const demand = createMusicQueue([{ title: 'Demand', list: Array.from({length: 8}, (_,id) => `https://music.163.com/song?id=${id}`) }], 'https://api.example/', labels, async url => {
  const id = Number(new URL(url).searchParams.get('id')); demandRequests.push(id); return Response.json([song(id)])
})
demand.request('0:6')
demand.release('0:6')
assert.equal(demand.rows(demand.urls[0].url)[6].status, 'pending', 'leaving the viewport cancels a queued but unstarted request')
demand.start(); await demand.idle()
assert.deepEqual(demandRequests, [0], 'opening does not request offscreen sources')
demand.request('0:4'); demand.request('0:4'); await demand.idle()
assert.deepEqual(demandRequests, [0, 4], 'viewport demand requests only that source and deduplicates repeats')
assert.equal(demand.rows(demand.urls[0].url)[7].status, 'pending')
console.log('Music viewport queue: no eager offscreen work, cancelled pending requests and demand deduplication passed.')

const empty = createMusicQueue([{title: 'Empty result', list: ['https://music.163.com/song?id=0', 'https://music.163.com/song?id=1']}], 'https://api.example/', labels, async url => Response.json(new URL(url).searchParams.get('id') === '0' ? [] : [song('Available')]))
empty.start(); await empty.idle()
assert.equal(empty.rows(empty.urls[0].url).length, 1, 'an explicit empty result removes only its placeholder')
assert.equal(empty.rows(empty.urls[0].url)[0].sourceKey, '0:1')
assert.equal(empty.rows(empty.urls[0].url)[0].status, 'pending', 'other sources remain available for viewport loading')
empty.request('0:1'); await empty.idle()
assert.equal(empty.rows(empty.urls[0].url)[0].name, 'Song Available')
console.log('Music empty result: unavailable sources disappear without becoming retry errors or removing other rows.')

const collectionRequests = []
const collections = createMusicQueue([{title:'Collections',list:[
  'https://music.163.com/song?id=0',
  'https://music.163.com/#/playlist?id=1',
  'https://y.qq.com/n/ryqq/playsquare/2',
  'https://music.163.com/album?id=3',
  'https://y.qq.com/n/ryqq/singer/4',
  'https://music.163.com/song?id=5',
  'https://music.163.com/playlist?id=6'
]}], 'https://api.example/', labels, async url=>{
  const id=new URL(url).searchParams.get('id'); collectionRequests.push(id)
  return Response.json(id==='1'?[song('Expanded1'),song('Expanded2')]:[song('Collection'+id)])
})
for(let i=1;i<=5;i++) { collections.request(`0:${i}`); collections.release(`0:${i}`) }
assert.deepEqual(collections.rows(collections.urls[0].url).map(row=>row.status), ['pending','loading','loading','loading','loading','pending','pending'], 'queued collections survive viewport exit; single songs cancel and untouched collections remain pending')
collections.start(); await collections.idle()
assert.deepEqual(collectionRequests,['0','1','2','3','4'])
assert.deepEqual(collections.rows(collections.urls[0].url).slice(1,3).map(row=>row.name), ['Song Expanded1','Song Expanded2'], 'offscreen collection response expands its original slot')
assert.equal(collections.rows(collections.urls[0].url).at(-1).status,'pending', 'retention does not eagerly request untouched playlists')
console.log('Music collection queue: playlist/album/artist retention, song cancellation and offscreen expansion passed.')
