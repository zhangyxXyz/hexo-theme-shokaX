import type { FireworkOptions } from 'mouse-firework/dist/types'
export default function firework(options: FireworkOptions, attachLayer?: (canvas: HTMLCanvasElement) => void | (() => void)): () => void
