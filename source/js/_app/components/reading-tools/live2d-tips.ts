export type TipRule = {
  selector: string
  text: string | string[]
  nameSelector?: string
  nameAttribute?: string
  color?: string
}
export type TipRules = { mouseover?: TipRule[]; click?: TipRule[] }

const instances = new WeakMap<HTMLElement, ReturnType<typeof attachTips>>()

// Only the small emphasis markup used by the theme's JSON is supported.
// Names, article titles and quotes always enter the DOM as text.
export function renderTip(target: HTMLElement, message: string, name = '', color?: string) {
  target.replaceChildren()
  if (typeof color === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color)) target.style.setProperty('--waifu-keyword-color', color)
  else target.style.removeProperty('--waifu-keyword-color')
  let parent: HTMLElement = target
  for (const part of message.split(/(<span>|<\/span>|\{text\})/g)) {
    if (part === '<span>') {
      const span = document.createElement('span')
      parent.append(span)
      parent = span
    } else if (part === '</span>') parent = target
    else parent.append(document.createTextNode(part === '{text}' ? name : part))
  }
}

function ruleName(element: Element, rule: TipRule) {
  const source = (rule.nameSelector ? element.querySelector(rule.nameSelector) : element) || element
  const explicit = rule.nameAttribute && source.getAttribute(rule.nameAttribute)
  if (explicit) return explicit.trim()
  const clone = source.cloneNode(true) as Element
  clone.querySelectorAll('.ic, svg, sup, .count, [aria-hidden="true"]').forEach(node => node.remove())
  return (clone.textContent?.trim() || source.getAttribute('aria-label') || source.getAttribute('data-theme-tooltip') || source.getAttribute('title') || '').replace(/\s+/g, ' ').slice(0, 120)
}

function validRules(rules: TipRule[] = []) {
  return (Array.isArray(rules) ? rules : []).filter(rule => {
    if (!rule || typeof rule.selector !== 'string' || !(typeof rule.text === 'string' || Array.isArray(rule.text) && rule.text.every(text => typeof text === 'string'))) return false
    try {
      document.documentElement.matches(rule.selector)
      if (rule.nameSelector) document.documentElement.matches(rule.nameSelector)
      return true
    } catch { return false }
  })
}

function attachTips(widget: HTMLElement, input: TipRules) {
  const hoverRules = validRules(input.mouseover)
  const clickRules = validRules(input.click)
  const hoverSelector = ['[data-waifu-tag-message]', ...hoverRules.map(rule => rule.selector)].join(',')
  const events = new AbortController()
  const options = { capture: true, signal: events.signal }
  const tip = document.createElement('div')
  tip.id = 'shokax-waifu-tips'
  tip.hidden = true
  tip.setAttribute('popover', 'manual')
  widget.append(tip)
  let timer: ReturnType<typeof setTimeout> | undefined
  let active: Element | undefined
  let currentRule: TipRule | undefined

  const clear = () => {
    clearTimeout(timer)
    timer = undefined
    if (typeof tip.hidePopover === 'function' && tip.matches(':popover-open')) tip.hidePopover()
    tip.hidden = true
    // Do not reveal an old welcome/idle message after the interaction expires.
    widget.querySelector('#waifu-tips')?.classList.remove('waifu-tips-active')
    widget.classList.remove('has-theme-tip')
    active = undefined
    currentRule = undefined
  }
  const available = () => widget.isConnected && widget.style.display !== 'none' && !document.hidden
  const position = () => {
    if (tip.hidden) return
    const anchor = widget.getBoundingClientRect()
    const width = tip.offsetWidth
    const height = tip.offsetHeight
    tip.style.left = `${Math.max(8, Math.min(anchor.left + 20, window.innerWidth - width - 8))}px`
    tip.style.top = `${Math.max(8, Math.min(anchor.top - 30, window.innerHeight - height - 8))}px`
    if (typeof tip.showPopover !== 'function') {
      // The upstream widget is transformed, so fixed children in the fallback
      // use its containing block rather than the viewport.
      const rect = tip.getBoundingClientRect()
      const left = Number.parseFloat(tip.style.left)
      const top = Number.parseFloat(tip.style.top)
      tip.style.left = `${left + left - rect.left}px`
      tip.style.top = `${top + top - rect.top}px`
    }
  }
  const show = (message: string, duration = 4000, name = '', color?: string) => {
    if (!available()) return
    // Old browsers keep the in-page bubble; a modal must not conceal it.
    if (typeof tip.showPopover !== 'function' && document.querySelector('dialog[open]')) return
    clearTimeout(timer)
    renderTip(tip, message, name, color)
    tip.hidden = false
    widget.classList.add('has-theme-tip')
    if (typeof tip.showPopover === 'function') {
      // Reopen only on a new message, so it also appears above a newly opened dialog.
      if (tip.matches(':popover-open')) tip.hidePopover()
      tip.showPopover()
    }
    position()
    timer = setTimeout(clear, duration)
  }
  const interact = (event: MouseEvent | FocusEvent, rules: TipRule[]) => {
    if (!available() || !(event.target instanceof Element)) return
    const target = event.target
    if (target.closest('[disabled], [aria-disabled="true"]')) return
    if (rules === hoverRules && !target.closest(hoverSelector)) return
    const tag = rules === hoverRules ? target.closest<HTMLElement>('[data-waifu-tag-message]') : null
    const related = event.relatedTarget
    if (tag) {
      if (related instanceof Node && tag.contains(related) || active === tag && !tip.hidden) return
      show('{text}', 4000, tag.dataset.waifuTagMessage || '')
      active = tag
      currentRule = undefined
      return
    }
    for (const rule of rules) {
      const element = target.closest(rule.selector)
      if (!element) continue
      if (rules === hoverRules && (related instanceof Node && element.contains(related) || active === element && currentRule === rule && !tip.hidden)) return
      const messages = Array.isArray(rule.text) ? rule.text : [rule.text]
      const message = messages[Math.floor(Math.random() * messages.length)]
      if (message) show(message, 4000, message.includes('{text}') ? ruleName(element, rule) : '', rule.color)
      active = element
      currentRule = rule
      return
    }
  }
  window.addEventListener('mouseover', event => interact(event, hoverRules), options)
  window.addEventListener('focusin', event => interact(event, hoverRules), options)
  window.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('#waifu-tool')) clear()
    interact(event, clickRules)
  }, options)
  document.addEventListener('pjax:send', clear, options)
  document.addEventListener('close', event => { if (event.target instanceof HTMLDialogElement) clear() }, options)
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear() }, options)
  window.addEventListener('shokax:hide-live2d', clear, options)
  window.addEventListener('pagehide', clear, options)
  window.addEventListener('resize', position, { signal: events.signal })
  return {
    show, clear,
    destroy() { clear(); events.abort(); tip.remove(); instances.delete(widget) }
  }
}

export function createLive2DTips(widget: HTMLElement, rules: TipRules) {
  const existing = instances.get(widget)
  if (existing) return existing
  const controller = attachTips(widget, rules)
  instances.set(widget, controller)
  return controller
}
