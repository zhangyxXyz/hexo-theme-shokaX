// Recalculate on each PJAX entry so static builds do not freeze the article age.
export const refreshArticleInfo = () => {
  document.querySelectorAll<HTMLElement>('[data-article-info]').forEach(card => {
    const updated = Number(card.dataset.updated)
    const interval = Date.now() - updated
    const outdated = card.dataset.updated !== undefined && Number.isFinite(updated)
      && interval > Number(card.dataset.days) * 86400000
    card.hidden = card.dataset.source !== 'true' && !outdated
    card.querySelectorAll<HTMLElement>('[data-article-age]').forEach(row => { row.hidden = !outdated })
    const elapsed = card.querySelector<HTMLElement>('[data-article-elapsed]')
    const duration = (timestamp: number) => {
      const start = new Date(timestamp)
      const end = new Date()
      if (!Number.isFinite(timestamp) || timestamp > end.getTime()) return `0${card.dataset.durationDay}`
      // Calendar months, clamping month-end dates instead of assuming 30-day months.
      let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth()
      const anniversary = (count: number) => {
        const value = new Date(start)
        value.setDate(1)
        value.setMonth(start.getMonth() + count)
        const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate()
        value.setDate(Math.min(start.getDate(), lastDay))
        return value
      }
      if (anniversary(months).getTime() > end.getTime()) months--
      const years = Math.floor(months / 12)
      const remainingMonths = months % 12
      const days = Math.floor((end.getTime() - anniversary(months).getTime()) / 86400000)
      return [years ? `${years}${card.dataset.durationYear}` : '', remainingMonths ? `${remainingMonths}${card.dataset.durationMonth}` : '', days || !months ? `${days}${card.dataset.durationDay}` : ''].filter(Boolean).join(card.dataset.durationJoin || '')
    }
    if (outdated) {
      if (elapsed) elapsed.textContent = duration(updated)
      const published = card.querySelector<HTMLElement>('[data-article-published]')
      if (published) published.textContent = duration(Number(card.dataset.published))
    }
  })
}
