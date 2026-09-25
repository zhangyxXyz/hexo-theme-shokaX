export type ThemeMode = 'light' | 'dark'

/** Effects describe visuals only; the runner owns state, timers and cleanup. */
export interface ThemeEffectContext {
  from: ThemeMode
  to: ThemeMode
  origin: { x: number; y: number }
  mount: (element: HTMLElement) => void
  after: (milliseconds: number, callback: () => void) => void
  animate: (element: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions, complete: () => void) => void
  afterPaint: (callback: () => void) => void
  commit: () => void
  finish: () => void
}

export type ThemeEffect = (context: ThemeEffectContext) => void
