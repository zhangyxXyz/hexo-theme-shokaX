/**
 * File switching, copy and fullscreen for build-time `:::code-tree` blocks.
 * Without JS every file panel stays visible in order.
 */
import { showtip } from '../globals/tools'
import { openFullscreen, setFullscreenButton } from './fullscreen-dialog'

let dispose: (() => void) | undefined

document.addEventListener('pjax:send', () => {
  dispose?.()
  dispose = undefined
})

export function refreshCodeTrees() {
  dispose?.()
  dispose = undefined
  const trees = Array.from(document.querySelectorAll<HTMLElement>('.md .md-code-tree:not(.is-error)'))
  if (!trees.length) return

  const controller = new AbortController()
  const { signal } = controller
  const closers = new Set<() => void>()
  const timers = new Set<ReturnType<typeof setTimeout>>()

  for (const tree of trees) {
    const files = Array.from(tree.querySelectorAll<HTMLButtonElement>('[data-code-tree-file]'))
    const panels = Array.from(tree.querySelectorAll<HTMLElement>('[data-code-tree-panel]'))
    const copy = tree.querySelector<HTMLButtonElement>('[data-code-tree-action="copy"]')
    const fullscreen = tree.querySelector<HTMLButtonElement>('[data-code-tree-action="fullscreen"]')
    const copyText = copy?.querySelector('span')
    const copyLabel = copyText?.textContent || ''
    let active = Math.max(0, panels.findIndex(panel => panel.hasAttribute('data-active')))
    let closeDialog: (() => void) | undefined
    tree.classList.add('is-enhanced')
    if (copy && LOCAL.nocopy) copy.hidden = true

    const select = (index: number) => {
      active = index
      files.forEach(file => {
        if (Number(file.dataset.codeTreeFile) === index) file.setAttribute('aria-current', 'true')
        else file.removeAttribute('aria-current')
      })
      panels.forEach((panel, i) => {
        panel.toggleAttribute('data-active', i === index)
        if (i === index) panel.querySelector('pre')?.scrollTo({ top: 0, left: 0 })
      })
    }

    tree.querySelector('.md-code-tree-nav')?.addEventListener('click', event => {
      const file = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-code-tree-file]')
      if (file) select(Number(file.dataset.codeTreeFile))
    }, { signal })

    // Arrow keys move between visible files, like a tree view.
    tree.querySelector('.md-code-tree-nav')?.addEventListener('keydown', event => {
      const { key } = event as KeyboardEvent
      if (key !== 'ArrowDown' && key !== 'ArrowUp') return
      const visible = files.filter(file => file.offsetParent)
      const current = visible.indexOf(document.activeElement as HTMLButtonElement)
      if (current < 0) return
      event.preventDefault()
      const next = visible[(current + (key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length]
      next.focus()
      select(Number(next.dataset.codeTreeFile))
    }, { signal })

    let copyTimer: ReturnType<typeof setTimeout> | undefined
    copy?.addEventListener('click', async () => {
      if (copyTimer) { clearTimeout(copyTimer); timers.delete(copyTimer) }
      let message = copy.dataset.copied || ''
      try {
        await navigator.clipboard.writeText(panels[active]?.querySelector('code')?.textContent || '')
        showtip(LOCAL.copyright || message)
      } catch {
        message = copy.dataset.copyFailed || ''
      }
      if (signal.aborted || !copyText) return
      copyText.textContent = message
      const timer = setTimeout(() => {
        copyText.textContent = copyLabel
        timers.delete(timer)
      }, 2000)
      timers.add(timer)
      copyTimer = timer
    }, { signal })

    tree.addEventListener('copy', event => {
      event.stopPropagation()
      if (LOCAL.nocopy) event.preventDefault()
      showtip(LOCAL.copyright)
    }, { signal })

    fullscreen?.addEventListener('click', () => {
      if (closeDialog) { closeDialog(); return }
      const title = tree.querySelector('.md-code-tree-title')?.textContent || ''
      // `.md` keeps the article's tree and code styles inside the dialog.
      const close = openFullscreen(tree, 'md-code-tree-dialog md', title, () => {
        closers.delete(close)
        closeDialog = undefined
        setFullscreenButton(fullscreen, false)
      }, signal)
      closers.add(close)
      closeDialog = close
      setFullscreenButton(fullscreen, true)
      fullscreen.focus()
    }, { signal })
  }

  dispose = () => {
    controller.abort()
    closers.forEach(close => close())
    timers.forEach(clearTimeout)
  }
}
