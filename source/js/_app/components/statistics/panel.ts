import type { ChartKey, Labels } from './types'

export function createPanel(element: HTMLElement, key: ChartKey, labels: Labels, pendingChange: (delta: number) => void) {
  element.replaceChildren()
  element.classList.add('statistics-panel')
  element.classList.remove('is-ready')
  element.dataset.chart = key
  const heading = document.createElement('h1')
  heading.className = 'statistics-heading'
  heading.id = `statistics-${key}`
  heading.textContent = labels[key]
  const anchor = document.createElement('a')
  anchor.className = 'anchor'
  anchor.href = `#${heading.id}`
  anchor.setAttribute('aria-label', labels[key])
  heading.append(anchor)
  const header = document.createElement('div')
  header.className = 'statistics-header'
  header.append(heading)
  const status = document.createElement('p')
  status.className = 'statistics-status'
  status.setAttribute('role', 'status')
  status.hidden = true
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = labels.retry
  button.hidden = true
  const body = document.createElement('div')
  body.className = 'statistics-chart'
  body.hidden = true
  const feedback = document.createElement('div')
  feedback.className = 'statistics-feedback'
  const loader = document.createElement('div')
  loader.className = 'statistics-loading'
  loader.setAttribute('role', 'status')
  loader.setAttribute('aria-label', labels.loading)
  feedback.append(loader, status, button)
  element.append(header, feedback, body)
  let pending = 0
  return {
    element, header, body, button,
    begin() {
      pending++
      pendingChange(1)
      loader.hidden = false
      status.hidden = button.hidden = true
      feedback.hidden = false
      let finished = false
      return () => {
        if (finished) return
        finished = true
        pending--
        pendingChange(-1)
        loader.hidden = pending === 0
        feedback.hidden = pending === 0 && Boolean(status.hidden) && Boolean(button.hidden)
      }
    },
    ready() { element.classList.add('is-ready'); body.hidden = false; status.hidden = button.hidden = true; feedback.hidden = pending === 0 },
    empty() { status.textContent = labels.empty; status.hidden = false; feedback.hidden = false },
    success() { status.hidden = true },
    fail(error: unknown) {
      const reason = error instanceof Error ? error.message : ''
      status.textContent = reason === 'expired' ? labels.expired : labels[`failed_${reason}`] || labels.failed
      status.hidden = false
      button.hidden = false
      feedback.hidden = false
    },
  }
}
export type Panel = ReturnType<typeof createPanel>
