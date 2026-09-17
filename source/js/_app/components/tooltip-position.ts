export function pointerTooltipPosition(pointer: { x: number; y: number }, size: { width: number; height: number }, viewport: { width: number; height: number }) {
  const edge = 12
  const gap = 12
  const right = pointer.x + gap
  const left = pointer.x - gap - size.width
  const below = pointer.y + gap
  const above = pointer.y - gap - size.height
  const x = right + size.width <= viewport.width - edge ? right : left >= edge ? left : right
  const y = below + size.height <= viewport.height - edge ? below : above
  return {
    x: Math.max(edge, Math.min(x, viewport.width - size.width - edge)),
    y: Math.max(edge, Math.min(y, viewport.height - size.height - edge)),
  }
}
