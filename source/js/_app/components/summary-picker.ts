let closePicker: (() => void) | undefined
let sequence = 0

export function refreshSummaryPickers() {
  closePicker?.()
  document.querySelectorAll<HTMLSelectElement>('[data-summary-select]').forEach(select => {
    if (select.dataset.enhanced) return
    select.dataset.enhanced = 'true'
    const compact = !!select.closest('.summary-switch')
    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'summary-picker-trigger'
    trigger.setAttribute('aria-label', select.getAttribute('aria-label') || '')
    trigger.setAttribute('aria-haspopup', 'listbox')
    trigger.setAttribute('aria-expanded', 'false')
    const label = document.createElement('span')
    const currentIcon = document.createElement('i')
    currentIcon.setAttribute('aria-hidden', 'true')
    const arrow = document.createElement('span')
    arrow.className = 'summary-picker-arrow'
    arrow.setAttribute('aria-hidden', 'true')
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    chevron.setAttribute('viewBox', '0 0 24 24')
    chevron.setAttribute('focusable', 'false')
    const stroke = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    stroke.setAttribute('d', 'M9 6 L15 12 L9 18')
    stroke.setAttribute('fill', 'none')
    stroke.setAttribute('stroke', 'currentColor')
    stroke.setAttribute('stroke-width', '2')
    stroke.setAttribute('stroke-linecap', 'round')
    stroke.setAttribute('stroke-linejoin', 'round')
    chevron.append(stroke)
    arrow.append(chevron)
    if (!compact) {
      const modelIcon = select.parentElement?.querySelector('.ic')
      if (modelIcon) trigger.append(modelIcon)
      trigger.append(label)
    }
    else trigger.append(currentIcon)
    trigger.append(arrow)
    const sync = () => {
      const option = select.selectedOptions[0]
      label.textContent = option?.text || ''
      trigger.title = option?.dataset.tooltip || option?.text || ''
      currentIcon.className = 'ic ' + (option?.dataset.icon || 'i-align-left')
      if (compact) trigger.setAttribute('aria-label', trigger.title)
    }
    sync()
    select.addEventListener('change', sync)
    select.hidden = true
    select.parentElement?.classList.add('summary-picker-enhanced')
    select.after(trigger)

    trigger.addEventListener('click', event => {
      event.stopPropagation()
      if (trigger.getAttribute('aria-expanded') === 'true') { closePicker?.(); trigger.blur(); return }
      closePicker?.()
      const lifecycle = new AbortController()
      const menu = document.createElement('div')
      menu.className = 'summary-picker-menu'
      menu.id = `summary-picker-${++sequence}`
      menu.setAttribute('role', 'listbox')
      menu.setAttribute('aria-label', select.getAttribute('aria-label') || '')
      trigger.setAttribute('aria-controls', menu.id)
      trigger.setAttribute('aria-expanded', 'true')
      const close = () => {
        lifecycle.abort()
        menu.remove()
        trigger.setAttribute('aria-expanded', 'false')
        trigger.removeAttribute('aria-controls')
        if (closePicker === close) closePicker = undefined
      }
      closePicker = close
      const options = Array.from(select.options).map(option => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'summary-picker-option'
        button.title = option.dataset.tooltip || option.text
        button.setAttribute('role', 'option')
        button.setAttribute('aria-selected', String(option.selected))
        const icon = document.createElement('i')
        icon.className = 'ic ' + (option.dataset.icon || 'i-robot')
        icon.setAttribute('aria-hidden', 'true')
        const text = document.createElement('span')
        text.textContent = option.text
        const check = document.createElement('span')
        check.className = 'summary-picker-check'
        check.setAttribute('aria-hidden', 'true')
        button.append(icon, text, check)
        button.addEventListener('click', () => {
          select.value = option.value
          select.dispatchEvent(new Event('change', { bubbles: true }))
          close()
          trigger.focus({ preventScroll: true })
        })
        menu.append(button)
        return button
      })
      document.body.append(menu)
      const rect = trigger.getBoundingClientRect()
      const width = Math.min(Math.max(190, menu.offsetWidth), window.innerWidth - 24)
      menu.style.width = `${width}px`
      menu.style.maxHeight = `${Math.max(80, Math.max(rect.top, window.innerHeight - rect.bottom) - 24)}px`
      menu.style.left = `${Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))}px`
      menu.style.top = `${rect.bottom + menu.offsetHeight + 8 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - menu.offsetHeight - 8)}px`
      options[select.selectedIndex]?.focus({ preventScroll: true })
      document.addEventListener('pointerdown', e => {
        if (!menu.contains(e.target as Node) && !trigger.contains(e.target as Node)) close()
      }, { signal: lifecycle.signal })
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); close(); trigger.blur() }
        if (e.key === 'Tab') { close(); trigger.focus({ preventScroll: true }) }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault()
          const index = options.indexOf(document.activeElement as HTMLButtonElement)
          const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
          options[next]?.focus({ preventScroll: true })
        }
      }, { signal: lifecycle.signal })
      window.addEventListener('resize', close, { signal: lifecycle.signal })
      window.addEventListener('scroll', e => { if (!menu.contains(e.target as Node)) close() }, { capture: true, signal: lifecycle.signal })
      document.addEventListener('pjax:send', close, { signal: lifecycle.signal })
    })
    trigger.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closePicker?.(); trigger.blur() }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); trigger.click() }
    })
  })
}
