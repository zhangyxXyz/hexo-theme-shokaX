import { effectiveReducedMotion, subscribeReducedMotion } from './reading-preferences'

export { effectiveReducedMotion } from './reading-preferences'

// Keep component-owned listeners/AbortSignals while sharing one effective policy.
// The facade is lazy: a one-off .matches read never creates a subscription.
export function getReducedMotionQuery() {
  const listeners = new Map<() => void, () => void>()
  const remove = (listener: () => void) => {
    listeners.get(listener)?.()
    listeners.delete(listener)
  }
  return {
    get matches() { return effectiveReducedMotion() },
    addEventListener(_type: 'change', listener: () => void, options?: { signal?: AbortSignal }) {
      if (listeners.has(listener) || options?.signal?.aborted) return
      const abort = () => remove(listener)
      const unsubscribe = subscribeReducedMotion(listener)
      listeners.set(listener, () => {
        unsubscribe()
        options?.signal?.removeEventListener('abort', abort)
      })
      options?.signal?.addEventListener('abort', abort, { once: true })
    },
    removeEventListener(_type: 'change', listener: () => void) { remove(listener) }
  }
}
