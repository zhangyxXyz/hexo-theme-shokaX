import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const require = createRequire(import.meta.url)
const helperPath = fileURLToPath(new URL('../source/js/_app/components/music-source.ts', import.meta.url))
async function load(path) {
  const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'cjs', write: false })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, module, module.exports)
  return module.exports
}
const { parseMusicSource, musicApiUrl, prepareMusic, getPreparedPlaylist, playMusic, handleMusicError, resetMusicSource, isMusicRestartPending, cancelMusicRestart, requestMusic, parseMusicLyrics, fetchMusicLyric, loadMusicLyrics } = await load(helperPath)
const { activateMusicTrack, createMusicLyricView, parseMusicVolume } = await load(fileURLToPath(new URL('../source/js/_app/components/music-state.ts', import.meta.url)))
const { adaptMusicPlayer, musicPlayerPlugin } = await load(fileURLToPath(new URL('../scripts/utils/music-player.ts', import.meta.url)))
assert.deepEqual(parseMusicSource('https://y.qq.com/n/ryqq/songDetail/003jjoM94WLiTf'), { server: 'tencent', type: 'song', id: '003jjoM94WLiTf' })
assert.deepEqual(parseMusicSource('https://y.qq.com/n/yqq/song/003jjoM94WLiTf.html'), { server: 'tencent', type: 'song', id: '003jjoM94WLiTf' })
assert.deepEqual(parseMusicSource('https://music.163.com/#/playlist?id=123'), { server: 'netease', type: 'playlist', id: '123' })
assert.deepEqual(parseMusicSource('https://music.163.com/discover/toplist?id=123'), { server: 'netease', type: 'playlist', id: '123' })
assert.throws(() => parseMusicSource('https://music.163.com.evil.test/playlist?id=123'))
assert.throws(() => parseMusicSource('javascript:alert(1)'))
assert.equal(musicApiUrl('https://music-api.example/nested/meting/?token=test', 'https://music.163.com/song?id=1'), 'https://music-api.example/nested/meting/?token=test&server=netease&type=song&id=1')
assert.ok(musicApiUrl('https://music-api.example', 'https://music.163.com/song?id=1').includes('/meting/?'))

const song = id => ({ name: `Song ${id}`, artist: 'Artist', url: `https://audio.example/${id}`, pic: '', lrc: '' })
const groups = [
  { title: 'QQ', list: Array.from({ length: 6 }, (_, i) => `https://y.qq.com/n/ryqq/songDetail/${i}`) },
  { title: 'NetEase', list: ['https://music.163.com/#/playlist?id=1', 'https://music.163.com/#/playlist?id=2'] }
]
let active = 0, maximum = 0
const starts = []
const warnings = []
const warn = console.warn
console.warn = (...args) => warnings.push(args)
try {
  const result = await prepareMusic(groups, 'https://custom-api.example/meting/', async (url, options) => {
    assert.ok(url.startsWith('https://custom-api.example/meting/'))
    assert.ok(options.signal instanceof AbortSignal)
    starts.push(Date.now())
    maximum = Math.max(maximum, ++active)
    const params = new URL(url).searchParams, id = Number(params.get('id'))
    await new Promise(resolve => setTimeout(resolve, (6 - id) * 3))
    active--
    if (params.get('server') === 'tencent' && id === 2) throw new DOMException('Timed out', 'TimeoutError')
    if (params.get('server') === 'tencent' && id === 4) return new Response('Unavailable', { status: 503 })
    return Response.json(params.get('server') === 'tencent' ? [song(id)] : [song(id + 10), song(20)])
  })
  assert.ok(maximum > 0 && maximum <= 4)
  assert.ok(starts.slice(1).every((start, i) => start - starts[i] >= 120), 'cached responses must still be paced')
  assert.deepEqual(result.urls.map(row => row.name), ['QQ', 'NetEase'])
  assert.deepEqual(getPreparedPlaylist(result.urls[0].url).map(row => row.name), ['Song 0', 'Song 1', 'Song 3', 'Song 5'])
  assert.deepEqual(getPreparedPlaylist(result.urls[1].url).map(row => row.name), ['Song 11', 'Song 20', 'Song 12'])
  assert.equal(result.failed.length, 2)
  const failed = await prepareMusic(groups, 'https://custom-api.example/meting/', async () => Response.json({ error: 'invalid' }))
  assert.equal(failed.urls.length, 0)
  assert.equal(failed.failed.length, 8)
  const retry = await prepareMusic(groups, 'https://custom-api.example/meting/', async () => Response.json([song('retry')]))
  assert.equal(retry.urls.length, 2)
  assert.equal(getPreparedPlaylist(retry.urls[0].url)[0].name, 'Song retry')
} finally { console.warn = warn }

const dist = await fs.readFile(new URL('../node_modules/nyx-player/dist/nyx-player.js', import.meta.url), 'utf8')
assert.deepEqual(parseMusicLyrics('[ti:Title]\n[ar:Artist]\n\n[00:20.00]Second\r\n[00:10.5][00:30.005]First\n[00:10.50]翻译\n[00:99.00]Invalid'), [
  { start: 10.5, end: 20, text: 'First / 翻译' },
  { start: 20, end: 30.005, text: 'Second' },
  { start: 30.005, end: Infinity, text: 'First' }
])
assert.deepEqual(parseMusicLyrics('[offset:-500]\n[00:00.2]Intro'), [{ start: 0, end: Infinity, text: 'Intro' }])
assert.deepEqual(parseMusicLyrics('[ti:Instrumental]\nNo timed lyrics'), [])
assert.equal(await fetchMusicLyric('https://go-api.example/lrc', async () => new Response('', { status: 404 })), '')
let attempts = 0
await requestMusic('https://go-api.example/api', async () => {
  attempts++
  if (attempts === 1) return new Response('', { status: 429 })
  if (attempts === 2) throw new TypeError('Failed to fetch')
  return Response.json([])
}, '')
assert.equal(attempts, 3, 'rate limits and CORS-masked network failures should retry')
attempts = 0
const denied = await requestMusic('https://go-api.example/api', async () => {
  attempts++
  return new Response('', { status: 403 })
}, '')
assert.equal(denied.status, 403)
assert.equal(attempts, 1, 'authorization failures must not retry')
const apiKey = 'local-music-fixture-'.repeat(3)
const modernGroups = [{ title: 'Go API', list: ['https://music.163.com/song?id=591321'] }]
const modern = await prepareMusic(modernGroups, 'https://go-api.example/meting-api/api', async (url, options) => {
  assert.equal(new URL(url).pathname, '/meting-api/api')
  assert.equal(new URL(url).searchParams.has('key'), false)
  assert.ok(!url.includes(apiKey))
  assert.equal(options.headers.Authorization, `Bearer ${apiKey}`)
  return Response.json([{ title: 'Will', author: '梶浦由記', url: 'https://go-api.example/audio?expires=999&access=grant', pic: '', lrc: 'https://go-api.example/lrc' },
    { title: 123, url: 'https://audio.example/invalid' }, { title: 'Invalid', url: 'javascript:alert(1)' }])
}, apiKey)
assert.deepEqual(getPreparedPlaylist(modern.urls[0].url), [{ name: 'Will', artist: '梶浦由記', url: 'https://go-api.example/audio?expires=999&access=grant', pic: '', lrc: 'https://go-api.example/lrc' }])
assert.ok(!JSON.stringify(modern.urls).includes(apiKey), 'playlist identifiers must not persist the API key')
await prepareMusic(modernGroups, 'https://production-api.example/api', async (_url, options) => {
  assert.equal(options.headers, undefined, 'production calls use origin authorization without a key')
  return Response.json([{ title: 'Production', author: 'Artist', url: 'https://audio.example/production' }])
})
let paused = 0, playbackErrors = 0
const audio = new EventTarget()
audio.addEventListener('shokax:music-error', () => playbackErrors++)
audio.play = async () => { throw new DOMException('Unavailable', 'NotSupportedError') }
await playMusic(audio, () => paused++)
assert.equal(paused, 1)
assert.equal(playbackErrors, 1)
let corsAttempts = 0, corsLoads = 0
audio.src = 'https://audio.example/cors'
audio.crossOrigin = 'anonymous'
audio.removeAttribute = name => { assert.equal(name, 'crossorigin'); audio.crossOrigin = null }
audio.load = () => { corsLoads++ }
audio.play = async () => { corsAttempts++; if (audio.crossOrigin) throw new DOMException('CORS blocked', 'NotSupportedError') }
await playMusic(audio, () => paused++)
assert.equal(corsAttempts, 2, 'CORS failure retries once as ordinary media')
assert.equal(corsLoads, 1)
assert.equal(paused, 1, 'successful ordinary playback must not pause')
audio.crossOrigin = 'anonymous'
audio.play = async () => { throw new DOMException('Unavailable', 'NotSupportedError') }
await playMusic(audio, () => paused++)
assert.equal(paused, 2, 'unavailable media stops after the single fallback')
assert.equal(playbackErrors, 2)
paused = 1; playbackErrors = 1
audio.play = async () => { throw new DOMException('Track changed', 'AbortError') }
await playMusic(audio, () => paused++)
assert.equal(paused, 1, 'an interrupted old track must not pause the new song')
audio.play = async () => {}
await playMusic(audio, () => paused++)
assert.equal(playbackErrors, 1)
// Native error can arrive before the rejected play Promise, or mid-track.
const racedAudio = new EventTarget()
let rejectOriginal, racePauses = 0, racePlays = 0
racedAudio.src = 'https://audio.example/race'
racedAudio.crossOrigin = 'anonymous'
racedAudio.removeAttribute = () => { racedAudio.crossOrigin = null }
racedAudio.load = () => {}
racedAudio.play = () => { racePlays++; return racedAudio.crossOrigin ? new Promise((_, reject) => { rejectOriginal = reject }) : Promise.resolve() }
const originalPlay = playMusic(racedAudio, () => racePauses++)
await handleMusicError(racedAudio, () => racePauses++)
rejectOriginal(new DOMException('Late CORS rejection', 'NotSupportedError'))
await originalPlay
assert.equal(racePlays, 2)
assert.equal(racePauses, 0, 'old rejected promise cannot pause successful fallback')
await handleMusicError(racedAudio, () => racePauses++)
assert.equal(racePauses, 1, 'mid-track native errors remain visible')
assert.ok(adaptMusicPlayer(dist).includes('this.playlist=shokaxPlaylist(this.url)'))
assert.ok(adaptMusicPlayer(dist).includes('this.lyrics=await shokaxLoadLyrics(this.url)'))
assert.ok(adaptMusicPlayer(dist).includes('preload:`none`'))
assert.ok(adaptMusicPlayer(dist).includes('view=shokaxPanelLyrics'))
assert.ok(adaptMusicPlayer(dist).includes('s=$(()=>i.loadedSongUrl===i.currentSong?.url?i.currentSong?.url:void 0)'))
// Exercise the actual adapted Nyx timeupdate callback across route changes.
// A preserved audio element must be the clock source, never seek to stale state.
const timeUpdateBody = adaptMusicPlayer(dist).match(/let o=Zc\(e=>\{([\s\S]*?)\},250\)/)?.[1]
assert.ok(timeUpdateBody, 'review the Nyx timeupdate callback after an upgrade')
const timeUpdate = new Function('e', 'i', 'window', 'shokaxRestartPending', timeUpdateBody)
const runTimeUpdate = (event, state, view) => timeUpdate(event, state, view, () => false)
const clockState = { currentSong: { url: 'https://audio.example/current' }, currentTime: 40, lastPage: '/', songDuration: 0, setCurrentTime(time) { this.currentTime = time } }
let mediaTime = 40.25
const mediaClock = {
  currentSrc: 'https://audio.example/current', readyState: 4,
  get currentTime() { return mediaTime },
  set currentTime(_time) { assert.fail('navigation must not seek the preserved audio element') },
  duration: 292.947
}
runTimeUpdate({ target: { ...mediaClock, currentSrc: 'https://audio.example/previous', currentTime: 251 } }, clockState, {})
assert.equal(clockState.currentTime, 40, 'late events from the old source must not restore its playhead')
runTimeUpdate({ target: { ...mediaClock, readyState: 0, currentTime: 251 } }, clockState, {})
assert.equal(clockState.currentTime, 40, 'ignore stale progress while the new source is empty')
for (const pathname of ['/', '/posts/27651.html', '/posts/42926.html', '/', '/posts/27651.html']) {
  mediaTime += 0.25
  runTimeUpdate({ target: mediaClock }, clockState, { location: { pathname } })
  assert.equal(clockState.currentTime, mediaTime)
  assert.equal(clockState.songDuration, mediaClock.duration)
}
assert.throws(() => adaptMusicPlayer('unexpected upgraded bundle'))
let loads = 0
const reusedAudio = Object.assign(new EventTarget(), { currentTime: 251, load() { loads++; assert.equal(this.currentTime, 0) } })
resetMusicSource(reusedAudio)
assert.equal(loads, 1)
assert.equal(reusedAudio.currentTime, 0)
const sourceWatch = adaptMusicPlayer(dist).match(/W\(\[\(\)=>i\.currentSong\?\.url,\(\)=>i\.restartId,\(\)=>i\.loadedSongUrl\],\(\)=>\{(.*?)\},\{flush:`post`\}\)/)?.[1]
assert.ok(sourceWatch)
const changeSource = new Function('i', 'a', 'shokaxResetMusic', 'shokaxPlayMusic', sourceWatch)
const switchedState = { playing: true, currentTime: 251, songDuration: 253, currentSong: { url: 'selected' }, loadedSongUrl: 'selected' }
let sourceStarts = 0
changeSource(switchedState, { value: reusedAudio }, resetMusicSource, () => { sourceStarts++ })
assert.equal(switchedState.currentTime, 0)
assert.equal(switchedState.songDuration, 0)
assert.equal(sourceStarts, 1)
changeSource({ ...switchedState, playing: false, loadedSongUrl: '' }, { value: reusedAudio }, () => assert.fail('opening the panel must not load audio'), () => assert.fail('opening the panel must not play'))

// Reproduce the real Chrome userscript: restore a saved 4:11 position from a
// playing listener AFTER the player has reset/load()ed the media element.
const extensionAudio = Object.assign(new EventTarget(), {
  src: 'https://audio.example/unique', currentSrc: 'https://audio.example/unique',
  readyState: 4, currentTime: 70, duration: 253.73517, playbackRate: 1,
  load() { this.currentTime = 0 }
})
resetMusicSource(extensionAudio)
extensionAudio.addEventListener('playing', () => { extensionAudio.currentTime = 251.388 }, { once: true })
extensionAudio.dispatchEvent(new Event('playing'))
assert.equal(extensionAudio.currentTime, 251.388, 'reproduce late userscript progress restore')
const protectedState = { ...clockState, currentSong: { url: extensionAudio.src }, currentTime: 0 }
timeUpdate({ target: extensionAudio }, protectedState, {}, isMusicRestartPending)
assert.equal(protectedState.currentTime, 0, 'ignore restored end time until restart settles; must not skip to next track')
await new Promise(resolve => setTimeout(resolve, 5))
assert.equal(extensionAudio.currentTime, 0, 'explicit restart wins over the userscript playing listener')
assert.equal(isMusicRestartPending(extensionAudio), false)
extensionAudio.currentTime = 60
extensionAudio.dispatchEvent(new Event('playing'))
await new Promise(resolve => setTimeout(resolve, 5))
assert.equal(extensionAudio.currentTime, 60, 'normal pause/resume is not a restart')
resetMusicSource(extensionAudio)
extensionAudio.dispatchEvent(new Event('playing'))
cancelMusicRestart(extensionAudio) // Called by an explicit seek.
extensionAudio.currentTime = 90
await new Promise(resolve => setTimeout(resolve, 5))
assert.equal(extensionAudio.currentTime, 90, 'a user seek cancels the pending restart correction')
resetMusicSource(extensionAudio)
extensionAudio.dispatchEvent(new Event('playing'))
extensionAudio.src = extensionAudio.currentSrc = 'https://audio.example/new'
resetMusicSource(extensionAudio)
extensionAudio.currentTime = 25
await new Promise(resolve => setTimeout(resolve, 5))
assert.equal(extensionAudio.currentTime, 25, 'a stale timer cannot seek a newer source')
assert.equal(isMusicRestartPending(extensionAudio), true)
cancelMusicRestart(extensionAudio)
cancelMusicRestart(reusedAudio)


const trackGroups = [{ index: 0 }, { index: 0 }]
assert.equal(parseMusicVolume(null), .6)
assert.equal(parseMusicVolume(''), .6)
assert.equal(parseMusicVolume('invalid'), .6)
assert.equal(parseMusicVolume('0'), 0)
assert.equal(parseMusicVolume('0.35'), .35)
assert.equal(parseMusicVolume('2'), 1)
assert.equal(parseMusicVolume('-1'), 0)
const volumeWatch = adaptMusicPlayer(dist).match(/W\(\(\)=>i\.volume,v=>\{([^}]+)\},\{immediate:true\}\)/)?.[1]
assert.ok(volumeWatch, 'volume must be applied at mount and whenever it changes')
const applyVolume = new Function('a', 'v', volumeWatch)
const volumeRef = { value: { volume: 1 } }
for (const level of [.6, .35, 0, 1]) {
  applyVolume(volumeRef, level)
  assert.equal(volumeRef.value.volume, level)
}
applyVolume({ value: null }, .6)
const controlCallbacks = adaptMusicPlayer(dist).match(/lyricsEnabled:i\.desktopLyrics,closeLyrics:\(\)=>\{(.*?)\},next:\(\)=>\{(.*?)\}\}\),\{immediate:true\}/)
assert.ok(controlCallbacks, 'desktop controls must connect to the mounted player state')
let sequentialSkips = 0, randomSkips = 0
const controlsState = { desktopLyrics: true, playing: true, currentTime: 42, currentId: 0, restartId: 0, mode: 'order',
  currentPlaylist: { getNextSong() { sequentialSkips++ }, getRandSong() { randomSkips++ } } }
new Function('i', controlCallbacks[1])(controlsState)
assert.equal(controlsState.desktopLyrics, false)
assert.equal(controlsState.playing, true, 'closing desktop controls must not pause music')
assert.equal(controlsState.currentTime, 42, 'closing desktop controls must not seek')
const skipDesktopTrack = new Function('i', controlCallbacks[2])
for (const mode of ['order', 'loop', 'random']) { controlsState.mode = mode; skipDesktopTrack(controlsState) }
assert.equal(sequentialSkips, 2)
assert.equal(randomSkips, 1)
assert.equal(controlsState.currentId, 3)
assert.equal(controlsState.restartId, 3)
assert.equal(controlsState.currentTime, 0)
const trackState = {
  currentPlaylistIndex: 0, currentTime: 37, currentId: 1, playing: false,
  get currentPlaylist() { return trackGroups[this.currentPlaylistIndex] },
  setCurrentPlaylist(index) { this.currentPlaylistIndex = index },
  start() { this.playing = true }
}
activateMusicTrack(trackState, 0, 0)
assert.equal(trackState.currentTime, 0, 'explicit track activation restarts the selected song')
assert.equal(trackState.restartId, 1, 'restart must also notify the native audio when the URL is unchanged')
assert.equal(trackState.playing, true)
activateMusicTrack(trackState, 1, 3)
assert.equal(trackState.currentTime, 0)
assert.equal(trackState.currentPlaylistIndex, 1)
assert.equal(trackState.currentPlaylist.index, 3)
assert.equal(trackState.currentId, 3)

const lyricA = { ...song('a'), lrc: 'https://lyric.example/a' }
const lyricB = { ...song('b'), lrc: 'https://lyric.example/b' }
const pendingLyrics = new Map()
let lyricView
let nextLyric
const lyricController = createMusicLyricView(view => { lyricView = { text: view.text, visible: view.visible }; nextLyric = view.nextText }, url => new Promise(resolve => pendingLyrics.set(url, resolve)))
const snapshot = { song: lyricA, time: 2, playing: false, panelOpen: false }
lyricController.update(snapshot)
assert.equal(pendingLyrics.size, 0, 'idle initialization must not download lyrics')
lyricController.update({ ...snapshot, panelOpen: true, mediaRequested: false })
assert.equal(pendingLyrics.size, 0, 'opening the panel must not download lyrics')
lyricController.update({ ...snapshot, playing: true })
lyricController.update({ ...snapshot, song: lyricB, playing: true })
pendingLyrics.get(lyricB.lrc)([{ start: 0, end: 5, text: 'B first' }, { start: 5, end: Infinity, text: 'B next' }])
await Promise.resolve()
assert.deepEqual(lyricView, { text: 'B first', visible: true })
assert.equal(nextLyric, 'B next')
pendingLyrics.get(lyricA.lrc)([{ start: 0, end: Infinity, text: 'Stale A' }])
await Promise.resolve()
assert.equal(lyricView.text, 'B first', 'late responses must not restore a previous song')
lyricController.update({ ...snapshot, song: lyricB, playing: true, time: 5 })
assert.deepEqual(lyricView, { text: 'B next', visible: true })
assert.equal(nextLyric, '', 'the final line has no invented next lyric')
lyricController.update({ ...snapshot, song: lyricB, playing: true, lyricsEnabled: false })
assert.equal(lyricView.visible, false, 'desktop controls stay hidden while disabled, even during playback')
lyricController.update({ ...snapshot, song: lyricB, playing: true, lyricsEnabled: true })
assert.equal(lyricView.visible, true, 'desktop lyrics can be re-enabled without restarting playback')
lyricController.update({ ...snapshot, song: lyricB, playing: true, panelOpen: true })
assert.equal(lyricView.visible, true, 'opening the panel keeps enabled desktop lyrics visible')
lyricController.update({ ...snapshot, song: lyricB, playing: true, panelOpen: true, lyricsEnabled: false })
assert.equal(lyricView.visible, false, 'the lyrics switch also hides lyrics while the panel is open')
lyricController.update({ ...snapshot, song: lyricB, playing: false, panelOpen: true, lyricsEnabled: true })
assert.equal(lyricView.visible, false, 'pausing hides enabled lyrics while the panel is open')
lyricController.update({ ...snapshot, song: lyricB, playing: true, panelOpen: true, lyricsEnabled: true })
assert.equal(lyricView.visible, true, 'resuming restores lyrics without closing the panel')
lyricController.update({ ...snapshot, song: lyricB })
assert.equal(lyricView.visible, false, 'paused lyrics are hidden')
lyricController.update({ ...snapshot, song: song('instrumental'), playing: true })
assert.deepEqual(lyricView, { text: '', visible: false })
lyricController.destroy()

// QQ LRC contains timed blank records between real lines (including this gap).
// They must not hide the controller or erase its next-line preview.
let gapView
const gapController = createMusicLyricView(view => { gapView = view }, async () => parseMusicLyrics(
  '[00:00.00]\n[00:38.13]First sentence\n[00:44.33]\n[00:45.00]   \n[00:45.74]Next sentence\n[00:49.07]Final sentence\n[00:54.75]'
))
const gapState = { song: lyricA, time: 38.2, playing: true, panelOpen: false }
gapController.update(gapState)
await Promise.resolve()
for (const time of [38.2, 44.5, 45.5]) {
  gapController.update({ ...gapState, time })
  assert.equal(gapView.text, 'First sentence')
  assert.equal(gapView.nextText, 'Next sentence')
  assert.equal(gapView.visible, true)
}
gapController.update({ ...gapState, time: 45.74 })
assert.equal(gapView.text, 'Next sentence')
assert.equal(gapView.nextText, 'Final sentence')
gapController.update({ ...gapState, time: 55 })
assert.equal(gapView.text, 'Final sentence')
assert.equal(gapView.nextText, '')
assert.equal(gapView.visible, true)
gapController.update({ ...gapState, time: 55, playing: false })
assert.equal(gapView.visible, false)
gapController.update({ ...gapState, time: 1 })
assert.equal(gapView.visible, false, 'do not display future lyrics before the first line starts')
gapController.update({ ...gapState, time: 44.5 })
assert.equal(gapView.text, 'First sentence', 'seeking back into an instrumental gap restores the prior line')
gapController.destroy()

const originalFetch = globalThis.fetch
let lyricRequests = 0
try {
  globalThis.fetch = async () => { lyricRequests++; return new Response('[00:00.00]Shared lyric') }
  const [panelLyrics, desktopLyrics] = await Promise.all([loadMusicLyrics('https://lyric.example/shared'), loadMusicLyrics('https://lyric.example/shared')])
  assert.equal(lyricRequests, 1, 'both views share one fetch and parsed lyric array')
  assert.equal(panelLyrics, desktopLyrics)
} finally { globalThis.fetch = originalFetch }
const result = await build({
  stdin: { contents: "export { initPlayer } from 'nyx-player'", resolveDir: fileURLToPath(new URL('..', import.meta.url)) },
  bundle: true, write: false, platform: 'browser', format: 'esm',
  plugins: [musicPlayerPlugin(helperPath)]
})
assert.ok(!result.outputFiles[0].text.includes('https://api.injahow.cn/meting/'), 'bundled player must not use the upstream hardcoded API')
console.log('Music: QQ/NetEase parsing, configured API, full groups, order, deduplication, concurrency, partial failures, retry and real Nyx bundle passed.')
