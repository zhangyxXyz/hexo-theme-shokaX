type PickerOptions = {
  signal?: AbortSignal
  variant?: string
  showArrow?: boolean
  renderTrigger?: (option: HTMLOptionElement | undefined, label: HTMLSpanElement, icon: HTMLElement) => void
}
type Picker = { sync: () => void; destroy: () => void }
const pickers = new WeakMap<HTMLSelectElement, Picker>()
let closePicker: (() => void) | undefined
let sequence = 0
export function closeSelectPicker() { closePicker?.() }

// The native select remains the value source for existing change handlers.
export function enhanceSelect(select: HTMLSelectElement, options: PickerOptions = {}): Picker {
  const existing = pickers.get(select)
  if (existing) { existing.sync(); return existing }
  const trigger = document.createElement('button')
  trigger.type = 'button'
  trigger.className = 'select-picker-trigger'
  const description = select.getAttribute('aria-describedby')
  if (description) trigger.setAttribute('aria-describedby', description)
  trigger.setAttribute('aria-haspopup', 'listbox')
  trigger.setAttribute('aria-expanded', 'false')
  const label = document.createElement('span'), icon = document.createElement('i'), arrow = document.createElement('i')
  icon.setAttribute('aria-hidden', 'true')
  arrow.className = 'select-picker-arrow ic i-chevron-right'
  arrow.setAttribute('aria-hidden', 'true')
  trigger.append(icon, label)
  if (options.showArrow !== false) trigger.append(arrow)
  const sync = () => {
    const option = select.selectedOptions[0]
    label.textContent = option?.text || ''
    trigger.setAttribute('aria-label', [select.getAttribute('aria-label'), option?.text].filter(Boolean).join(': '))
    trigger.title = option?.dataset.tooltip || option?.text || ''
    trigger.disabled = select.disabled
    icon.className = option?.dataset.icon ? 'ic ' + option.dataset.icon : ''
    options.renderTrigger?.(option, label, icon)
    icon.hidden = !icon.className
  }
  sync()
  select.hidden = true
  select.parentElement?.classList.add('select-picker-enhanced')
  select.after(trigger)
  select.addEventListener('change', sync)
  let closeOwn: (() => void) | undefined
  trigger.onclick = event => {
    event.stopPropagation()
    if (closeOwn) { closeOwn(); return }
    closePicker?.()
    const lifecycle = new AbortController(), menu = document.createElement('div')
    menu.className = 'select-picker-menu'
    if (options.variant) menu.dataset.picker = options.variant
    menu.id = `select-picker-${++sequence}`
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
      closeOwn = undefined
    }
    closeOwn = closePicker = close
    const groups = new Map<HTMLOptGroupElement, HTMLElement>()
    const buttons = Array.from(select.options).map(option => {
      const group = option.parentElement?.tagName === 'OPTGROUP' ? option.parentElement as HTMLOptGroupElement : undefined
      let container = group && groups.get(group)
      if (group && !container) {
        container = document.createElement('div')
        container.className = 'select-picker-group'
        container.setAttribute('role', 'group')
        container.setAttribute('aria-label', group.label)
        const heading = document.createElement('div')
        heading.className = 'select-picker-group-label'
        heading.setAttribute('aria-hidden', 'true')
        heading.textContent = group.label
        container.append(heading)
        menu.append(container)
        groups.set(group, container)
      }
      const button = document.createElement('button')
      button.type = 'button'
      button.disabled = option.disabled || !!group?.disabled
      button.className = 'select-picker-option'
      button.title = option.dataset.tooltip || option.text
      button.setAttribute('role', 'option')
      button.setAttribute('aria-selected', String(option.selected))
      if (option.dataset.icon) {
        const icon = document.createElement('i')
        icon.className = 'ic ' + option.dataset.icon
        icon.setAttribute('aria-hidden', 'true')
        button.append(icon)
      }
      const text = document.createElement('span'), check = document.createElement('span')
      text.textContent = option.text
      check.className = 'select-picker-check'
      check.setAttribute('aria-hidden', 'true')
      button.append(text, check)
      button.onclick = () => {
        select.value = option.value
        select.dispatchEvent(new Event('change', { bubbles: true }))
        close()
        trigger.focus({ preventScroll: true })
      }
      const destination = container || menu
      destination.append(button)
      return button
    })
    document.body.append(menu)
    const rect = trigger.getBoundingClientRect()
    const width = Math.min(Math.max(150, menu.offsetWidth), window.innerWidth - 24)
    menu.style.width = `${width}px`
    menu.style.maxHeight = `${Math.max(80, Math.max(rect.top, window.innerHeight - rect.bottom) - 24)}px`
    menu.style.left = `${Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12))}px`
    menu.style.top = `${rect.bottom + menu.offsetHeight + 8 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - menu.offsetHeight - 8)}px`
    const enabled = buttons.filter(button => !button.disabled)
    const selected = buttons[select.selectedIndex]
    const initial = selected && !selected.disabled ? selected : enabled[0]
    initial?.focus({ preventScroll: true })
    initial?.scrollIntoView({ block: 'nearest' })
    document.addEventListener('pointerdown', e => {
      if (!menu.contains(e.target as Node) && !trigger.contains(e.target as Node)) close()
    }, { signal: lifecycle.signal })
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); close(); trigger.focus({ preventScroll: true }) }
      if (e.key === 'Tab') { close(); trigger.focus({ preventScroll: true }) }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && enabled.length) {
        e.preventDefault()
        const index = enabled.indexOf(document.activeElement as HTMLButtonElement)
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? enabled.length - 1 : (index + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length
        enabled[next]?.focus({ preventScroll: true })
        enabled[next]?.scrollIntoView({ block: 'nearest' })
      }
    }, { signal: lifecycle.signal })
    window.addEventListener('resize', close, { signal: lifecycle.signal })
    window.addEventListener('scroll', e => { if (!menu.contains(e.target as Node)) close() }, { capture: true, signal: lifecycle.signal })
    document.addEventListener('pjax:send', close, { signal: lifecycle.signal })
  }
  trigger.onkeydown = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); event.stopPropagation(); trigger.click() }
  }
  const picker = { sync, destroy() {
    closeOwn?.()
    select.removeEventListener('change', sync)
    trigger.remove()
    select.hidden = false
    select.parentElement?.classList.remove('select-picker-enhanced')
    pickers.delete(select)
  } }
  pickers.set(select, picker)
  options.signal?.addEventListener('abort', picker.destroy, { once: true })
  if (options.signal?.aborted) picker.destroy()
  return picker
}
