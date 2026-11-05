/**
 * Footnote and annotation references open their note next to the text. The
 * links still point at the end-of-article list, which is the no-script path.
 */
let dispose: (() => void) | undefined

document.addEventListener('pjax:send', () => {
  dispose?.()
  dispose = undefined
})

export function refreshMarkdownNotes() {
  dispose?.()
  dispose = undefined
  const article = document.querySelector<HTMLElement>('.post.block .md')
  if (!article?.querySelector('[data-note-ref]')) return

  const controller = new AbortController()
  const { signal } = controller
  // Annotations are only read through their popovers; footnotes stay listed at the end.
  const annotations = article.querySelector<HTMLElement>('.md-notes.is-annotation')
  if (annotations) annotations.hidden = true
  let popover: HTMLElement | undefined
  let trigger: HTMLAnchorElement | undefined
  let frame = 0

  const place = () => {
    frame = 0
    if (!popover || !trigger) return
    const anchor = trigger.getBoundingClientRect()
    const box = popover.getBoundingClientRect()
    const gap = 8
    const margin = 16
    const below = anchor.bottom + gap
    const top = below + box.height > innerHeight - margin && anchor.top - gap - box.height > margin
      ? anchor.top - gap - box.height
      : below
    const left = Math.min(Math.max(margin, anchor.left + anchor.width / 2 - box.width / 2), innerWidth - margin - box.width)
    popover.style.top = `${Math.round(top)}px`
    popover.style.left = `${Math.round(Math.max(margin, left))}px`
  }
  const schedule = () => { if (popover && !frame) frame = requestAnimationFrame(place) }

  const close = (restoreFocus = false) => {
    if (frame) cancelAnimationFrame(frame)
    frame = 0
    popover?.remove()
    popover = undefined
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false')
      trigger.removeAttribute('aria-controls')
      if (restoreFocus) trigger.focus()
    }
    trigger = undefined
  }

  const open = (link: HTMLAnchorElement) => {
    const note = document.getElementById(link.dataset.noteRef || '')
    const body = note?.querySelector('.md-note-body')
    if (!note || !body) return false
    close()
    const panel = document.createElement('div')
    panel.className = 'md-note-popover'
    panel.id = 'md-note-popover'
    panel.setAttribute('role', 'note')
    const term = note.querySelector('.md-note-term')
    if (term) panel.append(term.cloneNode(true))
    const content = body.cloneNode(true) as HTMLElement
    content.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'))
    panel.append(...Array.from(content.childNodes))
    document.body.append(panel)
    popover = panel
    trigger = link
    link.setAttribute('aria-expanded', 'true')
    link.setAttribute('aria-controls', panel.id)
    place()
    return true
  }

  article.addEventListener('click', event => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-note-ref]')
    if (!link || !article.contains(link)) return
    if (trigger === link) {
      event.preventDefault()
      close()
      return
    }
    if (open(link)) event.preventDefault()
  }, { signal })
  document.addEventListener('pointerdown', event => {
    const target = event.target as Node
    if (popover && !popover.contains(target) && !trigger?.contains(target)) close()
  }, { signal })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && popover) close(true)
  }, { signal })
  addEventListener('scroll', schedule, { signal, passive: true })
  addEventListener('resize', schedule, { signal })

  dispose = () => {
    close()
    controller.abort()
    if (annotations) annotations.hidden = false
  }
}
