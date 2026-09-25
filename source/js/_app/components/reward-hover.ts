type Point = { x: number; y: number }
type Bounds = { left: number; right: number; top: number; bottom: number }

export function insideRewardBounds(point: Point | undefined, bounds: Bounds, margin = 0) {
  return Boolean(point && point.x >= bounds.left - margin && point.x <= bounds.right + margin &&
    point.y >= bounds.top - margin && point.y <= bounds.bottom + margin)
}

/** Use the untransformed wallet rectangle, never the rotating faces' hit targets. */
export function createRewardHover(onChange: (inside: boolean) => void) {
  let active = false
  let suppressed = false
  let leaveTimer: ReturnType<typeof setTimeout> | undefined
  const pause = () => {
    if (leaveTimer !== undefined) clearTimeout(leaveTimer)
    leaveTimer = undefined
  }
  return {
    update(point: Point | undefined, bounds: Bounds) {
      // After an explicit Return/Escape, do not immediately reopen under the cursor.
      if (suppressed) {
        if (!insideRewardBounds(point, bounds, 8)) suppressed = false
        return
      }
      if (insideRewardBounds(point, bounds, active ? 8 : 0)) {
        pause()
        if (!active) { active = true; onChange(true) }
      } else if (active && leaveTimer === undefined) {
        // Small edge movements and brief excursions must not reverse the animation.
        leaveTimer = setTimeout(() => {
          leaveTimer = undefined
          active = false
          onChange(false)
        }, 120)
      }
    },
    pause,
    dismiss() { pause(); active = false; suppressed = true },
    destroy() { pause(); active = false; suppressed = false }
  }
}
