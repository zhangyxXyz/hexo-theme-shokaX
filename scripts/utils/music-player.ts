import fs from 'node:fs/promises'
import type { Plugin } from 'esbuild'

// nyx-player 0.1.1 has no custom API or multi-source hook. Adapt only its
// playlist resolver; fail explicitly if an upstream upgrade changes the code.
export function adaptMusicPlayer(source: string): string {
  const methods = /parserURL\(\)\{[\s\S]*?\}async fetchPlaylist\(\)\{[\s\S]*?\}(?=getCurrentSong\(\))/g
  const playback = /([\w$]+)\.mode===`loop`&&\(([\w$]+)\.value\.loop=!0\),await \2\.value\.play\(\)/g
  const canplay = /onCanplay:t\[1\]\|\|=e=>L\(i\)\.currentId\+\+/g
  const lyrics = /async fetchLyric\(\)\{this\.rawContent=await\(await fetch\(this\.url\)\)\.text\(\)\}parseLyric\(\)\{[\s\S]*?this\.lyrics\.push\(\{text:\w+,start:\w+,end:\w+\}\)\}\}/g
  const currentSong = 'getCurrentSong(){return this.playlist[this.index]}'
  const navigation = /getNextSong\(\)\{.*?\}getPrevSong\(\)\{.*?\}getRandSong\(\)\{.*?\}(?=getCycleSong)/g
  const panelLyrics = /__name:`MusicLRC`,setup\(e\)\{[\s\S]*?\}\}\),Rl=/g
  const audioElement = 'X(`audio`,{ref:`audio`,src:s.value'
  const audioSource = 's=$(()=>{var e;return(e=i.currentSong)?.url??``})'
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
  const listMount = 'Sr(()=>{t.playlists.forEach(e=>{o.value.push(e.name)})})'
  const volumeState = 'enableVolume:!0,lastPage:``'
  const controller = 'setup(e){return(e,t)=>(J(),Y(`div`,fl,[Z(sl),Z(rl),Z(ll),Z(al),Z(dl)]))}'
  const volumeControl = 'setup(e){let t=tl(),n=$(()=>t.enableVolume);function r(){t.enableVolume=!t.enableVolume}return(e,t)=>(J(),Y(`div`,{class:O([`w-18% text-xl`,{"i-ri:volume-up-line":n.value,"i-ri:volume-mute-line":!n.value}]),onClick:r},null,2))}'
  if ([...source.matchAll(methods)].length !== 1 || [...source.matchAll(playback)].length !== 1 || [...source.matchAll(canplay)].length !== 1 || [...source.matchAll(lyrics)].length !== 1
    || [...source.matchAll(navigation)].length !== 1 || [...source.matchAll(panelLyrics)].length !== 1
    || [currentSong, audioElement, audioSource, playbackWatch, clockStart, automaticAdvance, previousTrack, nextTrack, lyricURL, coverURL, resetLyrics, pageSeek, selectTrack, trackClick, listMount, volumeState, volumeControl, controller].some(marker => source.split(marker).length !== 2)) {
    throw new Error('Music adapter expects nyx-player 0.1.1; review it before upgrading.')
  }
  return `import { focusMusicRow as shokaxFocusMusicRow, preserveMusicListScroll as shokaxPreserveListScroll } from 'shokax:music-queue-view';\nimport { resolveMusicPlaylist as shokaxPlaylist, bindMusicQueue as shokaxBindQueue, activateMusicRow as shokaxActivateRow, moveMusicTrack as shokaxMoveTrack } from 'shokax:music-queue';\nimport { playMusic as shokaxPlayMusic, handleMusicError as shokaxMusicError, resetMusicSource as shokaxResetMusic, isMusicRestartPending as shokaxRestartPending, loadMusicLyrics as shokaxLoadLyrics } from 'shokax:music-source';\nimport { publishMusicState as shokaxMusicState, activateMusicTrack as shokaxActivateTrack, musicTrackHint as shokaxTrackHint, readMusicVolume as shokaxReadVolume, saveMusicVolume as shokaxSaveVolume, musicVolumeLabels as shokaxVolumeLabels, musicLyricsLabels as shokaxLyricsLabels, createMusicPanelLyrics as shokaxPanelLyrics } from 'shokax:music-state';\nimport { seekMusicAudio as shokaxSeekAudio } from 'shokax:music-seek';\nimport { readMusicVisualizer as shokaxReadVisualizer, toggleMusicVisualizer as shokaxToggleVisualizer } from 'shokax:music-visualizer';\n` + source
    .replace(methods, 'parserURL(){}async fetchPlaylist(){this.playlist=shokaxPlaylist(this.url)}')
    .replace(currentSong, 'getCurrentSong(){let song=this.playlist[this.index];return song?.url&&!song.status?song:null}')
    .replace(navigation, 'getNextSong(){return shokaxMoveTrack(this,`next`)}getPrevSong(){return shokaxMoveTrack(this,`previous`)}getRandSong(){return shokaxMoveTrack(this,`random`)}')
    .replace(playback, (_, state, audio) => `(${state}.currentSong?.url&&${audio}.value.getAttribute(\`src\`)===${state}.currentSong.url)&&(${audio}.value.loop=${state}.mode===\`loop\`,await shokaxPlayMusic(${audio}.value,()=>${state}.paused()))`)
    .replace(canplay, '$&,onError:e=>{void shokaxMusicError(e.target,()=>L(i).paused())}')
    .replace(lyrics, 'async fetchLyric(){this.lyrics=await shokaxLoadLyrics(this.url)}parseLyric(){}')
    .replace(audioElement, 'X(`audio`,{ref:`audio`,preload:`none`,crossorigin:`anonymous`,src:s.value')
    .replace(audioSource, 's=$(()=>i.loadedSongUrl===i.currentSong?.url?i.currentSong?.url:void 0)')
    // Changing tracks while playing must explicitly load a preload=none element.
    .replace(playbackWatch, 'Sr(()=>{shokaxBindQueue(i,shokaxPreserveListScroll);W([()=>i.currentSong?.url,()=>i.playing],()=>{if(i.playing)i.loadedSongUrl=i.currentSong?.url??``},{immediate:true});W(()=>i.volume,v=>{if(a.value)a.value.volume=v},{immediate:true});W(()=>[i.currentSong,i.currentTime,i.songDuration,i.playing,i.showPlayer,i.desktopLyrics,i.loadedSongUrl],()=>shokaxMusicState({song:i.currentSong,time:i.currentTime,duration:i.songDuration,playing:i.playing,mediaRequested:i.showPlayer||i.playing||!!i.loadedSongUrl&&i.loadedSongUrl===i.currentSong?.url,panelOpen:i.showPlayer,seek:seconds=>shokaxSeekAudio(a.value,i.currentSong?.url,seconds,value=>i.setCurrentTime(value)),lyricsEnabled:i.desktopLyrics,closeLyrics:()=>{i.desktopLyrics=false},next:()=>{i.currentTime=0;i.restartId++;if(i.mode===`random`)i.currentPlaylist?.getRandSong();else i.currentPlaylist?.getNextSong();i.currentId++}}),{immediate:true});W([()=>i.currentSong?.url,()=>i.restartId,()=>i.loadedSongUrl],()=>{i.currentTime=0;i.songDuration=0;if(a.value&&i.loadedSongUrl===i.currentSong?.url){shokaxResetMusic(a.value);if(i.playing)void shokaxPlayMusic(a.value,()=>i.paused())}},{flush:`post`});W(()=>i.currentId,async()=>')
    .replace(clockStart, 'let o=Zc(e=>{if(shokaxRestartPending(e.target)||e.target.readyState===0||e.target.currentSrc!==i.currentSong?.url)return;let t=e.target.currentTime;')
    .replace(automaticAdvance, 't.songDuration>0&&t.currentTime>=t.songDuration&&(n(),t.currentTime=0)')
    .replace(previousTrack, 'async function n(){var e;if(!t.currentPlaylist)return;if(t.pendingTrack=0,t.currentTime=0,t.restartId++,t.mode===')
    .replace('e.index===e.lastIdx?', '(e.lastIdx<0||!e.playlist[e.lastIdx]?.url||e.index===e.lastIdx)?')
    .replace(nextTrack, 'async function n(){var e,n,r;t.currentTime=0,t.restartId++,t.mode===')
    .replace('t.mode===`order`?(e=t.currentPlaylist)?.getNextSong():t.mode===`random`?(n=t.currentPlaylist)?.getRandSong():(r=t.currentPlaylist)?.getCurrentSong()', 't.mode===`random`?(n=t.currentPlaylist)?.getRandSong():(e=t.currentPlaylist)?.getNextSong()')
    .replace(panelLyrics, '__name:`MusicLRC`,setup(e){let state=tl(),rows=I([]),view=shokaxPanelLyrics(value=>{rows.value=value});W(()=>[state.currentSong,state.currentTime,state.showPlayer,state.playing],()=>view.update({song:state.currentSong,time:state.currentTime,playing:state.playing,panelOpen:state.showPlayer}),{immediate:true});return()=>X(`div`,Fl,[X(`div`,Il,[X(`ul`,{class:`p-0`},rows.value.map((row,index)=>X(`li`,{key:row.start,class:`list-none`},[X(`p`,{class:{current:index===0}},row.text)])))])])}}),Rl=')
    .replace(coverURL, 'return(t.showPlayer||t.playing||t.loadedSongUrl===(e=t.currentSong)?.url)?t.currentSong?.pic:void 0')
    .replace(resetLyrics, 'o.value=[],t.value=0,s=-1')
    // PJAX keeps the audio element alive. Restoring the throttled store time on
    // a pathname change seeks backwards and interrupts the decoder unnecessarily.
    .replace(pageSeek, 'i.setCurrentTime(t)')
    .replace(listMount, listMount + ';W([()=>t.showPlayer,()=>t.currentSong?.key??t.currentSong?.url],([open,key])=>{shokaxFocusMusicRow();if(open){r.value=t.currentPlaylistIndex;shokaxFocusMusicRow(key)}})')
    .replace(selectTrack, 'function s(e,n){if(shokaxActivateRow(t,e,n))shokaxActivateTrack(t,e,n)}')
    .replaceAll('e.index===r&&L(t).currentPlaylistIndex===i.value.value', '!!n.url&&e.index===r&&L(t).currentPlaylistIndex===i.value.value')
    .replace('key:n.name,class:O(', 'key:n.key??n.url??n.name,class:O(')
    .replace('error:!1}', '"music-row-loading":(n.status===`loading`||n.status===`pending`),error:n.status===`error`}')
    .replace('bl=[`onClick`]', 'bl=[`onClick`,`role`,`tabindex`,`aria-disabled`,`data-music-status`,`data-music-source`,`data-music-playlist`,`data-music-key`]')
    .replace(trackClick, '"data-music-source":n.status?n.sourceKey:void 0,"data-music-playlist":e.url,"data-music-key":n.key??n.url,"data-music-status":n.status,"aria-disabled":(n.status===`loading`||n.status===`pending`),role:`button`,tabindex:(n.status===`loading`||n.status===`pending`)?-1:0,onDblclick:()=>s(e.sIndex,r),onKeydown:n=>{if(n.key===`Enter`||n.key===` `){n.preventDefault();s(e.sIndex,r)}},onClick:event=>{if(n.status===`error`||event.detail===0||matchMedia(`(pointer:coarse)`).matches)s(e.sIndex,r)}')
    .replace(volumeState, 'enableVolume:shokaxReadVolume()>0,volume:shokaxReadVolume(),desktopLyrics:true,restartId:0,pendingTrack:0,loadedSongUrl:``,lastPage:``')
    .replace(controller, [
      'setup(e){let state=tl(),labels=shokaxLyricsLabels(),visualizer=I(shokaxReadVisualizer());return()=>X(`div`,fl,[',
      'Z(sl,{"data-music-action":`mode`,"data-music-mode":state.mode}),',
      'X(`button`,{type:`button`,class:`music-lyrics-toggle`,"aria-pressed":state.desktopLyrics,"aria-label":state.desktopLyrics?labels.disable:labels.enable,title:state.desktopLyrics?labels.disable:labels.enable,onClick:()=>{state.desktopLyrics=!state.desktopLyrics}},[X(`i`,{class:state.desktopLyrics?`ic i-desktop-lyrics-on`:`ic i-desktop-lyrics-off`,"aria-hidden":`true`})]),',
      'Z(rl,{"data-music-action":`previous`}),',
      'Z(ll,{"data-music-action":`toggle`,"data-music-playing":state.playing}),',
      'Z(al,{"data-music-action":`next`}),',
      'X(`button`,{type:`button`,class:`music-visualizer-toggle`,"aria-pressed":visualizer.value,"aria-label":visualizer.value?labels.visualizerDisable:labels.visualizerEnable,title:visualizer.value?labels.visualizerDisable:labels.visualizerEnable,onClick:()=>{visualizer.value=shokaxToggleVisualizer()}},[X(`i`,{class:`ic i-audio-visualizer`,"aria-hidden":`true`})]),',
      'Z(dl)])}',
    ].join(''))
    .replace(volumeControl, 'setup(e){let t=tl(),n=$(()=>t.enableVolume),labels=shokaxVolumeLabels(),level=$(()=>n.value?Math.round(t.volume*100):0);function r(){if(!t.enableVolume&&t.volume===0){t.volume=.6;shokaxSaveVolume(.6)}t.enableVolume=!t.enableVolume}return()=>X(`div`,{class:`music-volume`},[X(`button`,{type:`button`,"aria-label":n.value?labels.mute:labels.unmute,onClick:r},[X(`span`,{"aria-hidden":`true`,class:O({"i-ri:volume-up-line":n.value,"i-ri:volume-mute-line":!n.value})})]),X(`input`,{type:`range`,min:0,max:100,step:1,value:level.value,style:{"--volume":level.value+`%`},"aria-label":labels.volume,"aria-valuetext":level.value+`%`,onInput:e=>{t.volume=Number(e.target.value)/100;t.enableVolume=t.volume>0;shokaxSaveVolume(t.volume)}})])}')
}

export function musicPlayerPlugin(sourcePath: string): Plugin {
  return {
    name: 'shokax-music-player',
    setup(build) {
      let applied = false
      build.onResolve({ filter: /^shokax:music-source$/ }, () => ({ path: sourcePath }))
      build.onResolve({ filter: /^shokax:music-visualizer$/ }, () => ({ path: sourcePath.replace(/music-source\.ts$/, 'music-visualizer.ts') }))
      build.onResolve({ filter: /^shokax:music-seek$/ }, () => ({ path: sourcePath.replace(/music-source\.ts$/, 'music-seek.ts') }))
      build.onResolve({ filter: /^shokax:music-queue-view$/ }, () => ({ path: sourcePath.replace(/music-source\.ts$/, 'music-queue-view.ts') }))
      build.onResolve({ filter: /^shokax:music-queue$/ }, () => ({ path: sourcePath.replace(/music-source\.ts$/, 'music-queue.ts') }))
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
