import { showtip } from '../globals/tools'
import { openedByPointer, restoreModalFocus } from './input-modality'

let dispose: (() => void) | undefined

const icons = {
  wrap: 'align-left',
  wrapped: 'align-justify',
  copy: 'clipboard',
  copied: 'check',
  failed: 'times',
  fullscreen: 'expand',
  close: 'compress'
}

const setIcon = (button: HTMLButtonElement, name: keyof typeof icons) => {
  const icon = document.createElement('i')
  icon.className = `ic i-${icons[name]}`
  icon.setAttribute('aria-hidden', 'true')
  button.replaceChildren(icon)
}

export function refreshCodeBlocks() {
  dispose?.()
  dispose = enhanceCodeBlocks(document, '.md pre.shiki')
}

// Shared by articles and asynchronously rendered Waline content.
export function enhanceCodeBlocks(root: ParentNode, selector = 'pre.shiki', comment = false) {
  const controller = new AbortController()
  const { signal } = controller
  const labels = LOCAL.codeBlock
  const restores: (() => void)[] = []
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let active: HTMLDialogElement | undefined
  let previousOverflow = ''
  let closeActive: (() => void) | undefined

  root.querySelectorAll<HTMLPreElement>(selector).forEach(pre => {
    if (pre.closest('.shokax-code')) return
    const code = pre.querySelector('code')
    if (!code) return
    const text = code.textContent || ''
    const language = Array.from(code.classList).find(name => name.startsWith('language-'))?.slice(9) || 'text'
    const names: Record<string, string> = { js: 'JavaScript', ts: 'TypeScript', html: 'HTML', css: 'CSS', json: 'JSON', yaml: 'YAML', yml: 'YAML', bash: 'Bash', cpp: 'C++', md: 'Markdown' }
    const wrapper = document.createElement('section')
    wrapper.className = 'shokax-code'
    const header = document.createElement('div')
    header.className = 'code-header'
    const title = document.createElement('button')
    title.type = 'button'
    title.className = 'code-title'
    const dots = document.createElement('span')
    dots.className = 'code-dots'
    dots.setAttribute('aria-hidden', 'true')
    title.append(dots, document.createTextNode(names[language] || language))
    const actions = document.createElement('div')
    actions.className = 'code-actions'
    header.append(title, actions)
    pre.before(wrapper)
    wrapper.append(header, pre)
    const label = (button: HTMLButtonElement, value: string) => {
      button.title = value
      button.setAttribute('aria-label', value)
    }
    const button = (icon: keyof typeof icons, name: string, action: () => void) => {
      const element = document.createElement('button')
      element.type = 'button'
      setIcon(element, icon)
      label(element, name)
      element.addEventListener('click', action, { signal })
      actions.append(element)
      return element
    }
    const wrap = button('wrap', labels.wrap, () => {
      const enabled = wrapper.classList.toggle('is-wrapped')
      wrap.setAttribute('aria-pressed', String(enabled))
      setIcon(wrap, enabled ? 'wrapped' : 'wrap')
    })
    wrap.setAttribute('aria-pressed', 'false')
    if (!LOCAL.nocopy) {
      let copyTimer: ReturnType<typeof setTimeout> | undefined
      const copy = button('copy', labels.copy, async () => {
        if (copyTimer) { clearTimeout(copyTimer); timers.delete(copyTimer) }
        try {
          await navigator.clipboard.writeText(text)
          if (signal.aborted) return
          label(copy, labels.copied)
          setIcon(copy, 'copied')
          status.textContent = labels.copied
          showtip(comment ? labels.copied : LOCAL.copyright || labels.copied)
        } catch {
          if (signal.aborted) return
          label(copy, labels.copyFailed)
          setIcon(copy, 'failed')
          status.textContent = labels.copyFailed
        }
        const timer = setTimeout(() => {
          label(copy, labels.copy)
          setIcon(copy, 'copy')
          status.textContent = ''
          timers.delete(timer)
        }, 2000)
        timers.add(timer)
        copyTimer = timer
      })
    }
    wrapper.addEventListener('copy', event => {
      event.stopPropagation()
      if (LOCAL.nocopy) event.preventDefault()
      if (!comment) showtip(LOCAL.copyright)
    }, { signal })
    const status = document.createElement('span')
    status.className = 'code-status'
    status.setAttribute('role', 'status')
    header.append(status)
    const toggleFullscreen = () => {
      if (wrapper.closest('.shokax-code-dialog')) { closeActive?.(); return }
      closeActive?.()
      const pointerOpened = openedByPointer()
      const focusTarget = document.activeElement as HTMLElement | null
      const dialog = document.createElement('dialog')
      dialog.className = 'shokax-code-dialog'
      dialog.setAttribute('aria-label', names[language] || language)
      const placeholder = document.createComment('code-block')
      wrapper.replaceWith(placeholder)
      dialog.append(wrapper)
      document.body.append(dialog)
      previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      active = dialog
      let closed = false
      closeActive = () => {
        if (closed) return
        closed = true
        dialog.close()
        placeholder.replaceWith(wrapper)
        dialog.remove()
        document.body.style.overflow = previousOverflow
        active = undefined
        closeActive = undefined
        label(fullscreen, labels.fullscreen)
        label(title, labels.fullscreen)
        setIcon(fullscreen, 'fullscreen')
        if (!signal.aborted) restoreModalFocus(focusTarget, pointerOpened)
      }
      dialog.addEventListener('cancel', event => { event.preventDefault(); closeActive?.() }, { signal })
      label(fullscreen, labels.exitFullscreen)
      label(title, labels.exitFullscreen)
      setIcon(fullscreen, 'close')
      dialog.showModal()
      fullscreen.focus()
    }
    const fullscreen = button('fullscreen', labels.fullscreen, toggleFullscreen)
    label(title, labels.fullscreen)
    title.addEventListener('click', toggleFullscreen, { signal })
    if (code.querySelectorAll(':scope > .line').length > 15) {
      wrapper.classList.add('has-collapse')
      wrapper.classList.add('is-collapsed')
      const expand = document.createElement('button')
      expand.type = 'button'
      expand.className = 'code-expand'
      expand.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>'
      label(expand, labels.expand)
      expand.setAttribute('aria-expanded', 'false')
      expand.addEventListener('click', () => {
        const collapsed = wrapper.classList.toggle('is-collapsed')
        label(expand, collapsed ? labels.expand : labels.collapse)
        expand.setAttribute('aria-expanded', String(!collapsed))
        if (collapsed && wrapper.getBoundingClientRect().top < 0) wrapper.scrollIntoView({ block: 'start' })
      }, { signal })
      wrapper.append(expand)
    }
    restores.push(() => { wrapper.replaceWith(pre) })
  })
  return () => {
    controller.abort()
    if (active) closeActive?.()
    timers.forEach(clearTimeout)
    restores.forEach(restore => restore())
  }
}
