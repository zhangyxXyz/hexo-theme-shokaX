export function formatVisitorCount(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) return '—'
  const units = ['', 'k', 'M', 'B', 'T']
  let unit = 0
  while (value >= 1000 ** (unit + 1) && unit < units.length - 1) unit++
  const rounded = () => {
    const scaled = value / 1000 ** unit
    return Number(scaled.toFixed(unit && scaled < 100 ? 1 : 0))
  }
  if (rounded() >= 1000 && unit < units.length - 1) unit++
  return `${rounded()}${units[unit]}`
}

export function observeVisitorCount(container: HTMLElement, signal: AbortSignal) {
  const source = container.querySelector<HTMLElement>('#busuanzi_value_site_uv')
  const display = container.querySelector<HTMLElement>('[data-visitor-count]')
  if (!source || !display) return
  const update = () => {
    const text = source.textContent?.trim() || ''
    if (!/^\d+$/.test(text)) return
    const value = Number(text)
    if (!Number.isSafeInteger(value) || value < 0) return
    display.textContent = formatVisitorCount(value)
    const exact = value.toLocaleString(document.documentElement.lang || undefined)
    const description = (display.dataset.format || '{count}').replace('{count}', exact)
    display.title = description
    display.setAttribute('aria-label', description)
  }
  const observer = new MutationObserver(update)
  observer.observe(source, { childList: true, characterData: true, subtree: true })
  signal.addEventListener('abort', () => observer.disconnect(), { once: true })
  update()
}
