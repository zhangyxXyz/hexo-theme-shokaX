import fs from 'node:fs/promises'
import type { Plugin } from 'esbuild'

// nyx-player 0.1.1 has no custom API or multi-source hook. Adapt only its
// playlist resolver; fail explicitly if an upstream upgrade changes the code.
export function adaptMusicPlayer(source: string): string {
  const methods = /parserURL\(\)\{[\s\S]*?\}async fetchPlaylist\(\)\{[\s\S]*?\}(?=getCurrentSong\(\))/g
  const playback = /([\w$]+)\.mode===`loop`&&\(([\w$]+)\.value\.loop=!0\),await \2\.value\.play\(\)/g
  const canplay = /onCanplay:t\[1\]\|\|=e=>L\(i\)\.currentId\+\+/g
  const lyrics = /async fetchLyric\(\)\{this\.rawContent=await\(await fetch\(this\.url\)\)\.text\(\)\}parseLyric\(\)\{[\s\S]*?this\.lyrics\.push\(\{text:\w+,start:\w+,end:\w+\}\)\}\}/g
  const audioElement = 'X(`audio`,{ref:`audio`,src:s.value'
  const playbackWatch = 'Sr(()=>{W(()=>i.currentId,async()=>'
  const clockStart = 'let o=Zc(e=>{let t=e.target.currentTime;'
  const automaticAdvance = 't.currentTime>=t.songDuration&&(n(),t.currentTime=0)'
  const previousTrack = 'async function n(){var e;if(t.currentTime=0,t.mode==='
  const nextTrack = 'async function n(){var e,n,r;t.currentTime=0,t.mode==='
  const lyricURL = 'i=$(()=>{var e;return(e=r.currentSong)?.lrc??``}),a=new WeakMap'
  const coverURL = 'return(e=t.currentSong)?.pic??``'
  const resetLyrics = 'o.value=[],t.value=0'
  const pageSeek = 'i.lastPage===window.location.pathname?i.setCurrentTime(t):(e.target.currentTime=i.currentTime,i.lastPage=window.location.pathname)'
  const selectTrack = 'function s(e,n){t.currentTime=0,t.setCurrentPlaylist(e),t.currentPlaylist&&(t.currentPlaylist.index=n)}'
  const trackClick = 'onClick:t=>s(e.sIndex,r)'
  const volumeState = 'enableVolume:!0,lastPage:``'
  const controller = 'setup(e){return(e,t)=>(J(),Y(`div`,fl,[Z(sl),Z(rl),Z(ll),Z(al),Z(dl)]))}'
  const volumeControl = 'setup(e){let t=tl(),n=$(()=>t.enableVolume);function r(){t.enableVolume=!t.enableVolume}return(e,t)=>(J(),Y(`div`,{class:O([`w-18% text-xl`,{"i-ri:volume-up-line":n.value,"i-ri:volume-mute-line":!n.value}]),onClick:r},null,2))}'
  if ([...source.matchAll(methods)].length !== 1 || [...source.matchAll(playback)].length !== 1 || [...source.matchAll(canplay)].length !== 1 || [...source.matchAll(lyrics)].length !== 1
    || [audioElement, playbackWatch, clockStart, automaticAdvance, previousTrack, nextTrack, lyricURL, coverURL, resetLyrics, pageSeek, selectTrack, trackClick, volumeState, volumeControl, controller].some(marker => source.split(marker).length !== 2)) {
    throw new Error('Music adapter expects nyx-player 0.1.1; review it before upgrading.')
  }
  return `import { getPreparedPlaylist as shokaxPlaylist, playMusic as shokaxPlayMusic, resetMusicSource as shokaxResetMusic, loadMusicLyrics as shokaxLoadLyrics } from 'shokax:music-source';\nimport { publishMusicState as shokaxMusicState, activateMusicTrack as shokaxActivateTrack, musicTrackHint as shokaxTrackHint, readMusicVolume as shokaxReadVolume, saveMusicVolume as shokaxSaveVolume, musicVolumeLabels as shokaxVolumeLabels, musicLyricsLabels as shokaxLyricsLabels } from 'shokax:music-state';\n` + source
    .replace(methods, 'parserURL(){}async fetchPlaylist(){this.playlist=shokaxPlaylist(this.url)}')
    .replace(playback, (_, state, audio) => `${audio}.value.loop=${state}.mode===\`loop\`,await shokaxPlayMusic(${audio}.value,()=>${state}.paused())`)
    .replace(canplay, '$&,onError:e=>{L(i).paused();e.target.dispatchEvent(new Event(`shokax:music-error`,{bubbles:true}))}')
    .replace(lyrics, 'async fetchLyric(){this.lyrics=await shokaxLoadLyrics(this.url)}parseLyric(){}')
    .replace(audioElement, 'X(`audio`,{ref:`audio`,preload:`none`,src:s.value')
    // Changing tracks while playing must explicitly load a preload=none element.
    .replace(playbackWatch, 'Sr(()=>{W(()=>i.volume,v=>{if(a.value)a.value.volume=v},{immediate:true});W(()=>[i.currentSong,i.currentTime,i.playing,i.showPlayer,i.desktopLyrics],()=>shokaxMusicState({song:i.currentSong,time:i.currentTime,playing:i.playing,panelOpen:i.showPlayer,lyricsEnabled:i.desktopLyrics,closeLyrics:()=>{i.desktopLyrics=false},next:()=>{i.currentTime=0;i.restartId++;if(i.mode===`random`)i.currentPlaylist?.getRandSong();else i.currentPlaylist?.getNextSong();i.currentId++}}),{immediate:true});W(()=>[i.currentSong?.url,i.restartId],()=>{i.currentTime=0;i.songDuration=0;if(a.value){shokaxResetMusic(a.value);if(i.playing)void shokaxPlayMusic(a.value,()=>i.paused())}},{flush:`post`});W(()=>i.currentId,async()=>')
    .replace(clockStart, 'let o=Zc(e=>{if(e.target.readyState===0||e.target.currentSrc!==i.currentSong?.url)return;let t=e.target.currentTime;')
    .replace(automaticAdvance, 't.songDuration>0&&t.currentTime>=t.songDuration&&(n(),t.currentTime=0)')
    .replace(previousTrack, 'async function n(){var e;if(t.currentTime=0,t.restartId++,t.mode===')
    .replace(nextTrack, 'async function n(){var e,n,r;t.currentTime=0,t.restartId++,t.mode===')
    .replace(lyricURL, 'i=$(()=>{var e;return r.playing||r.showPlayer?(e=r.currentSong)?.lrc??``:``}),a=new WeakMap')
    .replace(coverURL, 'return t.playing||t.showPlayer?(e=t.currentSong)?.pic??``:void 0')
    .replace(resetLyrics, 'o.value=[],t.value=0,s=-1')
    // PJAX keeps the audio element alive. Restoring the throttled store time on
    // a pathname change seeks backwards and interrupts the decoder unnecessarily.
    .replace(pageSeek, 'i.setCurrentTime(t)')
    .replace(selectTrack, 'function s(e,n){shokaxActivateTrack(t,e,n)}')
    .replace(trackClick, 'role:`button`,tabindex:0,onDblclick:()=>s(e.sIndex,r),onKeydown:n=>{if(n.key===`Enter`||n.key===` `){n.preventDefault();s(e.sIndex,r)}},onClick:n=>{if(n.detail===0||matchMedia(`(pointer:coarse)`).matches)s(e.sIndex,r)}')
    .replace(volumeState, 'enableVolume:shokaxReadVolume()>0,volume:shokaxReadVolume(),desktopLyrics:true,restartId:0,lastPage:``')
    .replace(controller, 'setup(e){let state=tl(),labels=shokaxLyricsLabels();return()=>X(`div`,fl,[Z(sl,{"data-music-action":`mode`,"data-music-mode":state.mode}),Z(rl,{"data-music-action":`previous`}),Z(ll,{"data-music-action":`toggle`,"data-music-playing":state.playing}),Z(al,{"data-music-action":`next`}),Z(dl),X(`button`,{type:`button`,class:`music-lyrics-toggle`,"aria-pressed":state.desktopLyrics,"aria-label":state.desktopLyrics?labels.disable:labels.enable,title:state.desktopLyrics?labels.disable:labels.enable,onClick:()=>{state.desktopLyrics=!state.desktopLyrics}},labels.glyph)])}')
    .replace(volumeControl, 'setup(e){let t=tl(),n=$(()=>t.enableVolume),labels=shokaxVolumeLabels(),level=$(()=>n.value?Math.round(t.volume*100):0);function r(){if(!t.enableVolume&&t.volume===0){t.volume=.6;shokaxSaveVolume(.6)}t.enableVolume=!t.enableVolume}return()=>X(`div`,{class:`music-volume`},[X(`button`,{type:`button`,"aria-label":n.value?labels.mute:labels.unmute,onClick:r},[X(`span`,{"aria-hidden":`true`,class:O({"i-ri:volume-up-line":n.value,"i-ri:volume-mute-line":!n.value})})]),X(`input`,{type:`range`,min:0,max:100,step:1,value:level.value,style:{"--volume":level.value+`%`},"aria-label":labels.volume,"aria-valuetext":level.value+`%`,onInput:e=>{t.volume=Number(e.target.value)/100;t.enableVolume=t.volume>0;shokaxSaveVolume(t.volume)}})])}')
}

export function musicPlayerPlugin(sourcePath: string): Plugin {
  return {
    name: 'shokax-music-player',
    setup(build) {
      let applied = false
      build.onResolve({ filter: /^shokax:music-source$/ }, () => ({ path: sourcePath }))
      build.onResolve({ filter: /^shokax:music-state$/ }, () => ({ path: sourcePath.replace(/music-source\.ts$/, 'music-state.ts') }))
      build.onLoad({ filter: /[\\/]nyx-player[\\/]dist[\\/]nyx-player\.js$/ }, async ({ path }) => {
        applied = true
        return { contents: adaptMusicPlayer(await fs.readFile(path, 'utf8')), loader: 'js' }
      })
      build.onEnd(result => {
        if (!applied && !result.errors.length) return { errors: [{ text: 'Music adapter did not match the nyx-player entry.' }] }
      })
    }
  }
}
