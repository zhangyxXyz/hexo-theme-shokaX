let cleanup: (() => void) | undefined

export function refreshIconPreview() {
  cleanup?.()
  cleanup = undefined
  const root = document.querySelector<HTMLElement>('.icon-preview')
  if (!root) return
  const controller = new AbortController()
  const timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>()
  cleanup = () => { controller.abort(); timers.forEach(clearTimeout) }
  const search = root.querySelector<HTMLInputElement>('input')!
  const clear = root.querySelector<HTMLButtonElement>('.icon-preview-clear')!
  const status = root.querySelector<HTMLElement>('.icon-preview-status')!
  const empty = root.querySelector<HTMLElement>('.icon-preview-empty')!
  const cards = [...root.querySelectorAll<HTMLElement>('.icon-preview-card')]
  search.addEventListener('input', () => {
    clear.hidden = search.value.length === 0
    const query = search.value.trim().toLowerCase().replace(/^\\/, '')
    let visible = 0
    cards.forEach(card => {
      card.hidden = !`${card.dataset.name} ${card.dataset.code}`.toLowerCase().includes(query)
      if (!card.hidden) visible++
    })
    status.textContent = `${visible} / ${cards.length}`
    empty.hidden = visible !== 0
  }, { signal: controller.signal })
  clear.addEventListener('click', () => {
    search.value = ''
    search.dispatchEvent(new Event('input'))
    search.focus()
  }, { signal: controller.signal })
  root.addEventListener('click', async event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-copy]')
    const card = button?.closest<HTMLElement>('.icon-preview-card')
    if (!card || !button) return
    const name = card.dataset.name!
    const svg = card.querySelector('svg')
    const text = button.dataset.copy === 'html' ? svg?.outerHTML || `<i class="ic ${name}" aria-hidden="true"></i>` : button.dataset.copy === 'code' ? `\\${card.dataset.code}` : name
    let copied = false
    try { await navigator.clipboard.writeText(text); copied = true } catch {
      const field = document.createElement('textarea')
      field.value = text
      field.style.cssText = 'position:fixed;left:-9999px'
      root.append(field)
      field.select()
      try { copied = document.execCommand('copy') } catch { /* Report failure below. */ }
      field.remove()
      button.focus()
    }
    if (controller.signal.aborted) return
    const feedback = card.querySelector<HTMLElement>('.icon-preview-feedback')!
    feedback.textContent = copied ? root.dataset.copied! : root.dataset.failed!
    card.querySelectorAll('.is-copied').forEach(item => item.classList.remove('is-copied'))
    button.classList.toggle('is-copied', copied)
    card.classList.add('has-feedback')
    clearTimeout(timers.get(card))
    timers.set(card, setTimeout(() => {
      card.classList.remove('has-feedback')
      button.classList.remove('is-copied')
      feedback.textContent = ''
      timers.delete(card)
    }, 1600))
  }, { signal: controller.signal })
}
