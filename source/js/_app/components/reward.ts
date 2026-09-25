import { createRewardHover, insideRewardBounds } from './reward-hover'

/** Article-local reward card. Native dialog owns focus trapping and Escape. */
let disposeRewards: (() => void) | undefined

document.addEventListener('pjax:send', () => {
  disposeRewards?.()
  disposeRewards = undefined
})

export function refreshRewards() {
  disposeRewards?.()
  const cleanup: Array<() => void> = []
  document.querySelectorAll<HTMLElement>('[data-reward-card]').forEach(root => {
    const front = root.querySelector<HTMLElement>('[data-reward-front]')
    const back = root.querySelector<HTMLElement>('[data-reward-back]')
    const open = root.querySelector<HTMLButtonElement>('[data-reward-open]')
    const returnButton = root.querySelector<HTMLButtonElement>('[data-reward-return]')
    const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-reward-method]'))
    const panels = Array.from(root.querySelectorAll<HTMLElement>('[data-reward-panel]'))
    const dialog = root.querySelector<HTMLDialogElement>('[data-reward-dialog]')
    const image = dialog?.querySelector<HTMLImageElement>('[data-reward-dialog-image]')
    const wallet = root.querySelector<HTMLElement>('.reward-wallet')
    if (!front || !back || !open || !returnButton || !tabs.length || !dialog || !image || !wallet) return
    const controller = new AbortController()
    const options = { signal: controller.signal }
    let selected = Math.max(0, tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true'))
    const wasFlipped = root.classList.contains('is-flipped')
    let zoomTrigger: HTMLButtonElement | undefined
    let backdropPointer = false
    const hoverPointer = matchMedia('(hover: hover) and (pointer: fine)')
    let hoverOpened = false

    const flip = (showBack: boolean, focus = true) => {
      root.classList.toggle('is-flipped', showBack)
      open.setAttribute('aria-expanded', String(showBack))
      const visible = showBack ? back : front
      const hidden = showBack ? front : back
      visible.inert = false
      visible.setAttribute('aria-hidden', 'false')
      if (focus) (showBack ? tabs[selected] : open).focus({ preventScroll: true })
      else if (hidden.contains(document.activeElement)) (document.activeElement as HTMLElement)?.blur()
      hidden.inert = true
      hidden.setAttribute('aria-hidden', 'true')
    }
    const select = (index: number) => {
      selected = index
      tabs.forEach((tab, i) => {
        tab.setAttribute('aria-selected', String(i === index))
        tab.tabIndex = i === index ? 0 : -1
        panels[i].hidden = i !== index
      })
      root.querySelector<HTMLElement>('[data-reward-scan]').textContent = panels[index].dataset.scan
    }
    flip(wasFlipped, false)
    select(selected)
    let pointer: { x: number; y: number } | undefined
    const hover = createRewardHover(inside => {
      hoverOpened = inside
      flip(inside, false)
    })
    const updateHover = () => {
      if (hoverPointer.matches && !dialog.open) hover.update(pointer, wallet.getBoundingClientRect())
    }
    // Boundary events can be synthesized as the faces rotate or become inert.
    // Real mouse coordinates against the stationary rectangle cannot oscillate that way.
    document.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return
      pointer = { x: event.clientX, y: event.clientY }
      updateHover()
    }, options)
    document.addEventListener('pointerout', event => {
      if (event.pointerType !== 'mouse' || event.relatedTarget !== null) return
      pointer = undefined
      updateHover()
    }, options)
    window.addEventListener('blur', () => { pointer = undefined; updateHover() }, options)
    document.addEventListener('scroll', updateHover, { ...options, capture: true, passive: true })
    window.addEventListener('resize', updateHover, options)
    open.addEventListener('click', () => { hoverOpened = false; flip(true) }, options)
    returnButton.addEventListener('click', () => { hover.dismiss(); hoverOpened = false; flip(false) }, options)
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => select(index), options)
      tab.addEventListener('keydown', event => {
        let next = index
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
        else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = tabs.length - 1
        else return
        event.preventDefault()
        select(next)
        tabs[next].focus({ preventScroll: true })
      }, options)
    })
    root.querySelectorAll<HTMLButtonElement>('[data-reward-zoom]').forEach(button => {
      const source = button.querySelector('img')
      const panel = button.closest<HTMLElement>('[data-reward-panel]')
      const retry = panel.querySelector<HTMLButtonElement>('[data-reward-retry]')
      const showImageState = () => {
        const failed = source.complete && source.naturalWidth === 0
        retry.hidden = !failed
        button.disabled = failed
        panel.classList.toggle('has-image-error', failed)
      }
      source.addEventListener('load', showImageState, options)
      source.addEventListener('error', showImageState, options)
      showImageState()
      retry.addEventListener('click', () => {
        const url = new URL(source.src, document.baseURI)
        url.searchParams.set('reward_retry', String(Date.now()))
        source.src = url.href
        retry.hidden = true
        panel.classList.remove('has-image-error')
      }, options)
      button.addEventListener('click', () => {
        if (!source) return
        zoomTrigger = button
        image.src = source.currentSrc || source.src
        image.alt = source.alt
        dialog.querySelector<HTMLElement>('[data-reward-dialog-title]').textContent = panels[selected].dataset.label
        dialog.querySelector<HTMLElement>('[data-reward-dialog-scan]').textContent = panels[selected].dataset.scan
        hover.pause()
        if (!dialog.open) dialog.showModal()
      }, options)
    })
    dialog.querySelector('[data-reward-close]').addEventListener('click', () => dialog.close(), options)
    // A drag starting inside the dialog must not accidentally dismiss it.
    const outside = (event: MouseEvent) => {
      const rect = dialog.getBoundingClientRect()
      return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
    }
    dialog.addEventListener('pointerdown', event => { backdropPointer = outside(event) }, options)
    dialog.addEventListener('click', event => {
      if (event.target === dialog && backdropPointer && outside(event)) dialog.close()
      backdropPointer = false
    }, options)
    dialog.addEventListener('close', () => {
      if (hoverOpened && !insideRewardBounds(pointer, wallet.getBoundingClientRect(), 8)) {
        hover.dismiss()
        hoverOpened = false
        flip(false)
      } else if (zoomTrigger?.isConnected) zoomTrigger.focus({ preventScroll: true })
    }, options)
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !dialog.open && root.classList.contains('is-flipped')) {
        event.preventDefault()
        hover.dismiss()
        hoverOpened = false
        flip(false)
      }
    }, options)
    cleanup.push(() => {
      hover.destroy()
      controller.abort()
      if (dialog.open) dialog.close()
    })
  })
  disposeRewards = () => cleanup.forEach(dispose => dispose())
}
