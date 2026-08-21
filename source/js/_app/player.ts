import { CONFIG } from './globals/globalVars'
// nyx-player exports this CSS entry without a TypeScript declaration.
// @ts-expect-error side-effect-only CSS import
import 'nyx-player/style'

export const initAudioPlayer = async function () {
  const urls = []
  CONFIG.audio.forEach((item) => {
    urls.push({
      name: item.title,
      url: item.list[0]
    })
  })
  const { initPlayer } = await import('nyx-player')
  initPlayer("#player","#showBtn", urls, "#playBtn", "html[data-theme=&quot;dark&quot;]", "shokax")
}
