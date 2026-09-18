import type { Labels, Point } from './types'

export function createMapRanking(labels: Labels, chart: any, signal: AbortSignal) {
  const list = document.createElement('ol')
  list.className = 'statistics-map-ranking'
  list.setAttribute('aria-label', labels.ranking)
  let timer: ReturnType<typeof setTimeout> | undefined
  list.addEventListener('scroll', () => {
    list.classList.add('is-scrolling')
    clearTimeout(timer)
    timer = setTimeout(() => list.classList.remove('is-scrolling'), 650)
  }, { passive: true, signal })
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  return {
    element: list,
    update(data: Point[], pending = false) {
      list.replaceChildren()
      list.hidden = pending
      if (pending) return
      const ordered = data.filter(item => Number.isFinite(item.value) && item.value >= 0).sort((a, b) => b.value - a.value).slice(0, 10)
      const nameWidth = Math.max(2, ...ordered.map(item => Math.min(4, Array.from(item.name).length)))
      list.style.setProperty('--region-width', `${nameWidth + .25 + (ordered.some(item => Array.from(item.name).length > 4) ? .75 : 0)}em`)
      if (!ordered.length) {
        const empty = document.createElement('li')
        empty.className = 'statistics-map-ranking-empty'
        empty.textContent = labels.empty
        list.append(empty)
        return
      }
      const max = Math.max(1, ordered[0].value)
      ordered.forEach((item, index) => {
        const row = document.createElement('li')
        const button = document.createElement('button')
        const rank = document.createElement('span')
        rank.className = 'statistics-map-rank'
        rank.textContent = String(index + 1)
        const name = document.createElement('span')
        name.className = 'statistics-map-region'
        const characters = Array.from(item.name)
        name.textContent = characters.length > 4 ? `${characters.slice(0, 4).join('')}…` : item.name
        name.title = item.name
        const bar = document.createElement('span')
        bar.className = 'statistics-map-bar'
        bar.style.setProperty('--visit-share', `${item.value / max * 100}%`)
        const count = document.createElement('span')
        count.textContent = item.value.toLocaleString()
        bar.append(count)
        button.type = 'button'
        button.setAttribute('aria-label', `${item.name}: ${item.value.toLocaleString()} ${labels.visits}`)
        const highlight = () => {
          chart.dispatchAction({ type: 'highlight', seriesIndex: 0, name: item.name })
          chart.dispatchAction({ type: 'showTip', seriesIndex: 0, name: item.name })
        }
        const reset = () => {
          chart.dispatchAction({ type: 'downplay', seriesIndex: 0, name: item.name })
          chart.dispatchAction({ type: 'hideTip' })
        }
        button.onmouseenter = button.onfocus = button.onclick = highlight
        button.onmouseleave = button.onblur = reset
        button.append(rank, name, bar)
        row.append(button)
        list.append(row)
      })
    },
  }
}
