// Waline 3.15.2 renders restored drafts before the async emoji map is ready.
// Keep the native renderer, but make that map part of its reactive dependencies.
export function adaptWalinePreview(source: string): string {
  const pattern = /([\w$]+)\(\(\)=>([\w$]+)\.value,e=>\{let\{highlighter:t,texRenderer:n\}=([\w$]+)\.value;([\s\S]{0,150}?)emojiMap:([\w$]+)\.value.map/g
  const matches = [...source.matchAll(pattern)]
  if (matches.length !== 1) {
    throw new Error('Waline preview adapter expects @waline/client 3.15.2; review it before upgrading the client.')
  }
  return source.replace(pattern, (_, watch, text, config, body, emoji) =>
    `${watch}(()=>[${text}.value,${emoji}.value.map],([e])=>{let{highlighter:t,texRenderer:n}=${config}.value;${body}emojiMap:${emoji}.value.map`)
}
