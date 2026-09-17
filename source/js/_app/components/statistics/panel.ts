import type { ChartKey, Labels } from './types'

export function createPanel(element: HTMLElement, key: ChartKey, labels: Labels, pendingChange: (delta: number) => void) {
  element.replaceChildren()
  element.classList.add('statistics-panel')
  element.classList.remove('is-ready')
  element.dataset.chart = key
  const heading = document.createElement('h2')
  heading.className = 'statistics-heading'
  heading.textContent = labels[key]
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
  element.append(heading, feedback, body)
  let pending = 0
  return {
    element, body, button,
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
    ready() { element.classList.add('is-ready'); body.hidden = false; status.hidden = true },
    empty() { status.textContent = labels.empty; status.hidden = false; feedback.hidden = false },
    success() { status.hidden = true },
    fail(error: unknown) {
      status.textContent = error instanceof Error && error.message === 'expired' ? labels.expired : labels.failed
      status.hidden = false
      button.hidden = false
      feedback.hidden = false
    },
  }
}
export type Panel = ReturnType<typeof createPanel>
