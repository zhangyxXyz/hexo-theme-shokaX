import { chartPalette } from './palette'

export function chartTooltip(root: HTMLElement) {
  const styles = getComputedStyle(root)
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  const palette = chartPalette(dark)
  return {
    renderMode: 'html', confine: true,
    backgroundColor: styles.getPropertyValue('--tooltip-bg').trim() || palette.surface,
    borderColor: styles.getPropertyValue('--tooltip-border').trim() || palette.border,
    borderWidth: 1, borderRadius: 8, padding: [6, 10],
    shadowBlur: 14, shadowOffsetY: 4, shadowColor: dark ? 'rgba(0,0,0,.28)' : 'rgba(35,62,83,.14)',
    textStyle: { color: styles.getPropertyValue('--tooltip-text').trim() || palette.text, fontSize: 12 },
    extraCssText: 'backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%);border-radius:8px;line-height:1.45;max-width:min(320px,calc(100vw - 24px));white-space:normal;overflow-wrap:anywhere;box-sizing:border-box;',
    axisPointer: { lineStyle: { color: palette.axis, type: 'dashed' }, shadowStyle: { color: dark ? 'rgba(150,190,220,.10)' : 'rgba(80,130,170,.08)' } },
  }
}
