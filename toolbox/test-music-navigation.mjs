import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { reactive, nextTick } from 'vue'

const result = await build({ stdin: { contents: "export * from './source/js/_app/components/music-queue';export {activateMusicTrack} from './source/js/_app/components/music-state'", resolveDir: fileURLToPath(new URL('..', import.meta.url)) }, bundle: true, format: 'cjs', write: false })
const module = { exports: {} }
new Function('module', 'exports', result.outputFiles[0].text)(module, module.exports)
const { createMusicQueue, bindMusicQueue, moveMusicTrack, navigateMusicTrack, activateMusicTrack } = module.exports
const song = id => ({ name: id, artist: 'Artist', url: `https://audio.example/${id}`, pic: '', lrc: '' })
const tick = async () => { await new Promise(resolve => setImmediate(resolve)); await nextTick() }
async function fixture() {
  const calls = [], pending = new Map()
  const queue = createMusicQueue([{ title: 'Songs', list: Array.from({length: 6}, (_,id) => `https://music.163.com/song?id=${id}`) }], 'https://api.example/', { loading: 'Loading', error: 'Retry' }, url => {
    const id = Number(new URL(url).searchParams.get('id')); calls.push(id)
    return id === 0 ? Promise.resolve(Response.json([song('A')])) : new Promise(resolve => pending.set(id, resolve))
  })
  const state = reactive({ currentPlaylistIndex: 0, currentTime: 42, currentId: 0, playing: true,
    playlists: queue.urls.map(({url}) => ({url, playlist: queue.rows(url), index: -1, lastIdx: -1})),
    get currentPlaylist() { return this.playlists[this.currentPlaylistIndex] },
    get currentSong() { const row = this.currentPlaylist.playlist[this.currentPlaylist.index]; return row?.url ? row : null },
    setCurrentPlaylist(index) { this.currentPlaylistIndex = index }, start() { this.playing = true }
  })
  bindMusicQueue(state); queue.start(); await queue.idle()
  const finish = async (id, body, status = 200) => {
    for (let i=0; !pending.has(id) && i<200; i++) await new Promise(resolve => setTimeout(resolve, 10))
    assert.ok(pending.has(id), `source ${id} requested`)
    pending.get(id)(Response.json(body, { status })); pending.delete(id); await tick()
  }
  return {queue,state,calls,finish,list: state.currentPlaylist}
}

const f = await fixture()
moveMusicTrack(f.list, 'next')
assert.equal(f.state.currentSong, null, 'unloaded next is awaited instead of skipped')
assert.equal(f.list.playlist[f.list.index].sourceKey, '0:1')
f.queue.release('0:1')
assert.equal(f.list.playlist[f.list.index].status, 'loading', 'explicit playback demand survives leaving viewport')
await f.finish(1, [song('B1'), song('B2')])
assert.equal(f.state.currentSong.name, 'B1', 'playlist expands and next chooses its first song')
assert.equal(f.state.currentTime, 0)
moveMusicTrack(f.list, 'next')
assert.equal(f.state.currentSong.name, 'B2', 'next uses the updated expanded index')
moveMusicTrack(f.list, 'next')
moveMusicTrack(f.list, 'next')
await f.finish(2, [song('Old request')])
assert.equal(f.state.currentSong, null, 'old response cannot steal a newer next operation')
await f.finish(3, [song('Latest')])
assert.equal(f.state.currentSong.name, 'Latest')
moveMusicTrack(f.list, 'next')
activateMusicTrack(f.state, 0, 0)
await f.finish(4, [song('Late after manual selection')])
assert.equal(f.state.currentSong.name, 'A', 'manual selection invalidates pending navigation')
moveMusicTrack(f.list, 'previous')
await f.finish(5, [song('Tail1'), song('Tail2')])
assert.equal(f.state.currentSong.name, 'Tail2', 'previous wraps and chooses the last song in a returned playlist')
await f.queue.idle()

const g = await fixture()
moveMusicTrack(g.list, 'next')
await g.finish(1, [])
assert.equal(g.list.playlist.some(row => row.sourceKey === '0:1'), false, 'empty source disappears')
const warn = console.warn; console.warn = () => {}
try { await g.finish(2, [], 503) } finally { console.warn = warn }
assert.equal(g.list.playlist[g.list.index].sourceKey, '0:3', 'only confirmed empty/error advances')
await g.finish(3, [song('After error')])
assert.equal(g.state.currentSong.name, 'After error')
navigateMusicTrack(g.state, g.list, 'next', 400)
await new Promise(resolve => setTimeout(resolve, 430))
assert.equal(g.list.playlist[g.list.index].sourceKey, '0:5', 'timeout advances the bounded itinerary')
await g.finish(5, [song('After timeout')])
await g.finish(4, [song('Late timeout result')])
assert.equal(g.state.currentSong.name, 'After timeout', 'late timed out response remains cached without taking selection')
await g.queue.idle()

const h = await fixture()
const random = Math.random; Math.random = () => .9999
try { moveMusicTrack(h.list, 'random') } finally { Math.random = random }
assert.equal(h.list.playlist[h.list.index].sourceKey, '0:1', 'random includes unloaded sources')
Math.random = () => .9999
try { await h.finish(1, [song('Random1'), song('Random2')]) } finally { Math.random = random }
assert.equal(h.state.currentSong.name, 'Random2', 'random chooses a song from an expanded playlist')
assert.deepEqual(h.calls, [0,1], 'navigation does not hydrate the whole group')
await h.queue.idle()
const k = await fixture()
moveMusicTrack(k.list, 'next')
k.queue.request('0:2')
await k.finish(2, [song('Expanded while waiting')])
await k.finish(1, [])
assert.equal(k.state.currentSong.name, 'Expanded while waiting', 'fallback resolves a placeholder expanded by another request during the wait')
await k.queue.idle()
console.log('Music navigation: demand loading, playlist expansion, current index, random, timeout, empty/error fallback and stale intent isolation passed.')
