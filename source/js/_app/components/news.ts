let dispose: (() => void) | undefined

export function refreshNews() {
  dispose?.()
  dispose = undefined
  const root = document.querySelector<HTMLElement>('[data-news]')
  if (!root) return
  const labels: Record<string, string> = JSON.parse(root.dataset.labels || '{}')
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-news-channel]'))
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-news-panel]'))
  if (!buttons.length) return
  const search = root.querySelector<HTMLInputElement>('[data-news-search]')!
  const more = root.querySelector<HTMLButtonElement>('[data-news-more]')!
  const result = root.querySelector<HTMLElement>('[data-news-results]')!
  const empty = root.querySelector<HTMLElement>('[data-news-empty]')!
  const life = new AbortController()
  const options = { signal: life.signal }
  let selected = buttons[0].dataset.newsChannel
  let limit = 12
  const items = new Map(panels.map(panel => [panel, Array.from(panel.querySelectorAll<HTMLElement>('[data-news-item]')).map(element => ({ element, text: (element.textContent || '').toLocaleLowerCase() }))]))

  function render() {
    const query = search.value.trim().toLocaleLowerCase()
    let total = 0
    let shown = 0
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.newsChannel === selected)))
    panels.forEach(panel => {
      panel.hidden = panel.dataset.newsPanel !== selected
      if (panel.hidden) return
      for (const item of items.get(panel)!) {
        const matches = !query || item.text.includes(query)
        item.element.hidden = !matches || ++total > limit
        if (!item.element.hidden) shown++
      }
    })
    result.textContent = labels.results.replace('{shown}', String(shown)).replace('{total}', String(total))
    empty.hidden = total > 0 || !query
    more.hidden = shown >= total
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    selected = button.dataset.newsChannel
    limit = 12
    render()
  }, options))
  search.addEventListener('input', () => { limit = 12; render() }, options)
  more.addEventListener('click', () => {
    const panel = panels.find(panel => panel.dataset.newsPanel === selected)!
    const previous = new Set(items.get(panel)!.filter(item => !item.element.hidden).map(item => item.element))
    limit += 12
    render()
    const next = items.get(panel)!.find(item => !item.element.hidden && !previous.has(item.element))
    next?.element.querySelector<HTMLAnchorElement>('h3 a')?.focus({ preventScroll: true })
  }, options)
  root.querySelectorAll<HTMLElement>('[data-news-controls]').forEach(control => { control.hidden = false })
  render()
  dispose = () => life.abort()
}
