import assert from 'node:assert/strict'
import vm from 'node:vm'
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'

const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../source/js/_app/components/reading-tools/live2d-tips.ts', import.meta.url))],
  bundle: true, write: false, format: 'iife', globalName: 'tipsModule'
})

function emitter() {
  const listeners = new Map()
  return {
    addEventListener(name, listener, options = {}) {
      const group = listeners.get(name) || new Set()
      group.add(listener)
      listeners.set(name, group)
      options.signal?.addEventListener('abort', () => group.delete(listener), { once: true })
    },
    emit(name, event = {}) { for (const listener of [...(listeners.get(name) || [])]) listener(event) },
    count() { return [...listeners.values()].reduce((total, group) => total + group.size, 0) }
  }
}

function styles() {
  const properties = new Map()
  return {
    setProperty(name, value) { properties.set(name, String(value)) },
    getPropertyValue(name) { return properties.get(name) || '' },
    removeProperty(name) { const value = properties.get(name) || ''; properties.delete(name); return value }
  }
}

// A small independent DOM fixture: only ordinary tag/class/id/attribute
// selectors and the native popover state are needed for these interactions.
function fixture({ popover = true } = {}) {
  const timers = new Map()
  let serial = 0
  class Node {
    parentNode = null
    childNodes = []
    append(...children) {
      for (const child of children) {
        child.remove()
        child.parentNode = this
        this.childNodes.push(child)
      }
    }
    replaceChildren(...children) { for (const child of [...this.childNodes]) child.remove(); this.append(...children) }
    remove() {
      if (this.parentNode) this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1)
      this.parentNode = null
    }
    contains(node) { return this === node || this.childNodes.some(child => child.contains(node)) }
    get isConnected() { return this === doc.documentElement || !!this.parentNode?.isConnected }
    get textContent() { return this.childNodes.map(child => child.textContent).join('') }
    set textContent(value) { this.replaceChildren(new TextNode(value)) }
  }
  class TextNode extends Node {
    constructor(value) { super(); this.value = String(value) }
    get textContent() { return this.value }
    cloneNode() { return new TextNode(this.value) }
  }
  class Element extends Node {
    attrs = new Map()
    style = styles()
    hidden = false
    offsetWidth = 220
    offsetHeight = 70
    popoverOpen = false
    popoverShows = 0
    popoverHides = 0
    bounds = { left: 16, top: 500 }
    constructor(tag) {
      super()
      this.tagName = tag.toLowerCase()
      this.classList = {
        add: (...names) => this.setAttribute('class', [...new Set([...this.classes(), ...names])].join(' ')),
        remove: (...names) => this.setAttribute('class', this.classes().filter(name => !names.includes(name)).join(' ')),
        contains: name => this.classes().includes(name)
      }
      if (popover) {
        this.showPopover = () => { this.popoverOpen = true; this.popoverShows++ }
        this.hidePopover = () => { this.popoverOpen = false; this.popoverHides++ }
      }
    }
    classes() { return (this.getAttribute('class') || '').split(/\s+/).filter(Boolean) }
    get id() { return this.getAttribute('id') || '' }
    set id(value) { this.setAttribute('id', value) }
    get dataset() {
      return Object.fromEntries([...this.attrs].filter(([name]) => name.startsWith('data-')).map(([name, value]) => [name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]))
    }
    setAttribute(name, value) { this.attrs.set(name, String(value)) }
    removeAttribute(name) { this.attrs.delete(name) }
    getAttribute(name) { return this.attrs.get(name) ?? null }
    getBoundingClientRect() {
      if (this.id !== 'shokax-waifu-tips' || this.style.left === undefined) return this.bounds
      const origin = this.popoverOpen ? { left: 0, top: 0 } : this.parentNode.bounds
      return { left: Number.parseFloat(this.style.left) + origin.left, top: Number.parseFloat(this.style.top) + origin.top }
    }
    matches(selector) {
      return selector.split(',').some(part => {
        part = part.trim()
        if (part === ':popover-open') {
          if (!popover) throw new SyntaxError('Unsupported pseudo-class')
          return this.popoverOpen
        }
        let valid = true
        const rest = part.replace(/(^[a-z][\w-]*)|([.#][\w-]+)|(\[([\w-]+)(?:="([^"]*)")?\])/gi, (_, tag, token, attr, name, value) => {
          if (tag) valid &&= this.tagName === tag.toLowerCase()
          else if (token?.startsWith('#')) valid &&= this.id === token.slice(1)
          else if (token) valid &&= this.classList.contains(token.slice(1))
          else valid &&= value === undefined ? this.attrs.has(name) : this.getAttribute(name) === value
          return ''
        })
        if (rest || !part) throw new SyntaxError(`Unsupported selector: ${part}`)
        return valid
      })
    }
    closest(selector) {
      for (let element = this; element instanceof Element; element = element.parentNode) if (element.matches(selector)) return element
      return null
    }
    querySelectorAll(selector) {
      return this.childNodes.flatMap(child => child instanceof Element ? [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)] : [])
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null }
    cloneNode(deep) {
      const copy = new Element(this.tagName)
      for (const [name, value] of this.attrs) copy.setAttribute(name, value)
      if (deep) copy.append(...this.childNodes.map(child => child.cloneNode(true)))
      return copy
    }
  }
  class HTMLDialogElement extends Element { constructor() { super('dialog') } }
  const doc = {
    ...emitter(), hidden: false,
    createElement: tag => tag === 'dialog' ? new HTMLDialogElement() : new Element(tag),
    createTextNode: value => new TextNode(value),
    querySelector: selector => doc.documentElement.querySelector(selector)
  }
  doc.documentElement = new Element('html')
  doc.body = new Element('body')
  doc.documentElement.append(doc.body)
  const win = { ...emitter(), innerWidth: 1024, innerHeight: 768 }
  const context = vm.createContext({
    console, AbortController, document: doc, window: win, Node, Element, HTMLElement: Element, HTMLDialogElement,
    setTimeout: (callback, delay) => { timers.set(++serial, { callback, delay }); return serial },
    clearTimeout: timer => timers.delete(timer)
  })
  vm.runInContext(bundle.outputFiles[0].text, context)
  const element = (tag, attrs = {}, text = '') => {
    const node = doc.createElement(tag)
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value)
    if (text) node.textContent = text
    return node
  }
  const widget = element('div', { id: 'waifu' })
  const oldTip = element('div', { id: 'waifu-tips', class: 'waifu-tips-active' }, 'Previous welcome')
  widget.append(oldTip)
  doc.body.append(widget)
  const api = context.tipsModule
  return {
    api, win, doc, element, widget, oldTip, timers,
    mount(rules = {}) {
      this.controller = api.createLive2DTips(widget, rules)
      this.tip = widget.querySelector('#shokax-waifu-tips')
      return this.controller
    },
    expire() { const pending = [...timers.values()]; timers.clear(); pending.forEach(timer => timer.callback()) },
    assertCleared() {
      assert.equal(timers.size, 0)
      assert.equal(this.tip.hidden, true)
      assert.equal(this.tip.popoverOpen, false)
      assert.equal(widget.classList.contains('has-theme-tip'), false)
      assert.equal(oldTip.classList.contains('waifu-tips-active'), false)
    }
  }
}

let f = fixture()
const rules = {
  mouseover: [
    { selector: '.control', text: 'Open <span>{text}</span>', nameSelector: '.name', color: '#e7a' },
    { selector: '[', text: 'Invalid selector must not break other controls' }
  ],
  click: [{ selector: '.control', text: 'Clicked {text}', nameAttribute: 'data-label', color: '#ed6ea0' }]
}
f.mount(rules)
const control = f.element('button', { class: 'control', 'data-label': 'Playlist' })
const icon = f.element('svg')
const name = f.element('span', { class: 'name' }, 'Morning mix')
name.append(f.element('sup', {}, '99'), f.element('span', { 'aria-hidden': 'true' }, 'Decoration'))
control.append(icon, name)
f.doc.body.append(control)
f.win.emit('mouseover', { target: icon })
assert.equal(f.tip.textContent, 'Open Morning mix', 'a child icon must resolve to its closest control and discard decorative name text')
assert.equal(f.tip.querySelectorAll('span').length, 1, 'only the intended emphasis markup becomes an element')
assert.equal(f.tip.style.getPropertyValue('--waifu-keyword-color'), '#e7a', 'a three-digit configured color reaches the rendered hover tip')
const firstTimer = [...f.timers.keys()][0]
const firstShows = f.tip.popoverShows
f.win.emit('mouseover', { target: name, relatedTarget: icon })
f.win.emit('focusin', { target: control })
assert.equal([...f.timers.keys()][0], firstTimer, 'moving between children or focusing the same control must not extend the tip')
assert.equal(f.tip.popoverShows, firstShows)
f.win.emit('click', { target: icon })
assert.equal(f.tip.textContent, 'Clicked Playlist', 'click rules must work through child icons and explicit labels')
assert.equal(f.tip.style.getPropertyValue('--waifu-keyword-color'), '#ed6ea0', 'a six-digit configured color reaches the rendered click tip')
assert.equal(f.timers.size, 1)

// Names and arbitrary HTML-like message text are inert, even when placed inside
// the small emphasis vocabulary supported by the theme.
const hostile = '<img src=x onerror=alert(1)><script>bad()</script><span>name</span>'
f.api.renderTip(f.tip, 'Read <span>{text}</span> <img src=x onerror=alert(2)>', hostile, '#ED6EA0')
assert.equal(f.tip.textContent, `Read ${hostile} <img src=x onerror=alert(2)>`)
assert.equal(f.tip.querySelectorAll('img,script').length, 0)
assert.equal(f.tip.querySelectorAll('span').length, 1, 'markup in the interpolated name cannot add nested elements')
assert.equal(f.tip.style.getPropertyValue('--waifu-keyword-color').toLowerCase(), '#ed6ea0')
for (const invalid of ['red', '#1234', '#12345678', '#ff00gg', 'rgb(1, 2, 3)', 'var(--other-color)', 'url(javascript:alert(1))', '#fff; color: red']) {
  f.api.renderTip(f.tip, '<span>Previous color</span>', '', '#ed6ea0')
  f.api.renderTip(f.tip, '<span>{text}</span>', hostile, invalid)
  assert.equal(f.tip.style.getPropertyValue('--waifu-keyword-color'), '', `${invalid} must restore the theme default rather than leave the previous color behind`)
  assert.equal(f.tip.textContent, hostile)
  assert.equal(f.tip.querySelectorAll('img,script').length, 0)
}
f.controller.show('<span>Custom</span>', 4000, '', '#e7a')
assert.equal(f.tip.style.getPropertyValue('--waifu-keyword-color'), '#e7a', 'the direct message API accepts the same optional color')
f.controller.show('<span>Default</span>')
assert.equal(f.tip.style.getPropertyValue('--waifu-keyword-color'), '', 'a message without color restores the CSS theme color')

const listenerCount = f.win.count() + f.doc.count()
assert.equal(f.api.createLive2DTips(f.widget, rules), f.controller)
assert.equal(f.win.count() + f.doc.count(), listenerCount, 'initializing the same persistent widget must reuse event handlers')
assert.equal(f.widget.querySelectorAll('#shokax-waifu-tips').length, 1)
const later = f.element('button', { class: 'control', 'data-label': 'New page' })
later.append(f.element('span', { class: 'name' }, 'Dynamic control'))
f.doc.body.append(later)
f.win.emit('mouseover', { target: later })
assert.equal(f.tip.textContent, 'Open Dynamic control', 'controls inserted after initialization must work without rebinding')
const plain = f.element('a', { 'data-waifu-tag-message': 'Default tag color' })
f.doc.body.append(plain)
f.win.emit('mouseover', { target: plain })
assert.equal(f.tip.style.getPropertyValue('--waifu-keyword-color'), '', 'delegated default-color rules do not inherit the previous interaction color')
for (let index = 0; index < 50; index++) f.controller.show(`New message ${index}`)
assert.equal(f.tip.textContent, 'New message 49')
assert.equal(f.timers.size, 1, 'repeated messages must replace the expiry timeout instead of adding a timer backlog')
f.expire()
f.assertCleared()
const tag = f.element('a', { 'data-waifu-tag-message': '<strong>Tag name</strong>' })
f.doc.body.append(tag)
f.win.emit('mouseover', { target: tag })
assert.equal(f.tip.textContent, '<strong>Tag name</strong>')
assert.equal(f.tip.querySelectorAll('strong').length, 0)
f.controller.clear()
control.setAttribute('disabled', '')
f.win.emit('mouseover', { target: icon })
assert.equal(f.timers.size, 0, 'disabled control descendants must not activate tips')
f.controller.destroy()
assert.equal(f.win.count() + f.doc.count(), 0)
assert.equal(f.widget.querySelector('#shokax-waifu-tips'), null)
f.win.emit('click', { target: later })
assert.equal(f.timers.size, 0, 'destroy must detach event handlers')
const recreated = f.api.createLive2DTips(f.widget, rules)
assert.notEqual(recreated, f.controller, 'a destroyed widget can be initialized cleanly again')
recreated.destroy()

for (const [source, name] of [['win', 'shokax:hide-live2d'], ['doc', 'pjax:send'], ['win', 'pagehide'], ['doc', 'visibilitychange'], ['doc', 'close']]) {
  f = fixture()
  f.mount()
  f.controller.show('A visible interaction')
  assert.equal(f.tip.hidden, false)
  if (name === 'visibilitychange') f.doc.hidden = true
  f[source].emit(name, { target: name === 'close' ? f.element('dialog') : f.widget })
  f.assertCleared()
  f.controller.destroy()
  assert.equal(f.win.count() + f.doc.count(), 0)
}

f = fixture()
f.mount()
f.widget.style.display = 'none'
f.controller.show('Must remain hidden')
assert.equal(f.timers.size, 0)
f.widget.style.display = ''
f.widget.remove()
f.controller.show('Detached widget')
assert.equal(f.timers.size, 0)
f.controller.destroy()

// Modern browsers lift tips above native modal dialogs; the fallback remains
// usable in-page but must not display a bubble concealed behind an open modal.
for (const popover of [true, false]) {
  f = fixture({ popover })
  f.mount()
  f.controller.show('Plain page')
  assert.equal(f.tip.hidden, false)
  assert.equal(f.tip.popoverOpen, false, 'ordinary tips stay below the music panel')
  assert.equal(f.tip.getBoundingClientRect().left, 36)
  assert.equal(f.tip.getBoundingClientRect().top, 470, 'the fallback accounts for the transformed widget containing block')
  f.controller.clear()
  const dialog = f.element('dialog', { open: '' })
  f.doc.body.append(dialog)
  f.controller.show('Modal context')
  assert.equal(f.tip.hidden, !popover)
  assert.equal(f.timers.size, popover ? 1 : 0)
  if (popover) {
    const shows = f.tip.popoverShows
    const hides = f.tip.popoverHides
    f.controller.show('Another modal interaction')
    assert.equal(f.tip.popoverShows, shows + 1)
    assert.equal(f.tip.popoverHides, hides + 1, 'an active popover must reopen above a newly active modal')
    f.widget.bounds = { left: 1000, top: 900 }
    f.win.emit('resize')
    assert.equal(f.tip.style.left, '796px')
    assert.equal(f.tip.style.top, '690px', 'the bubble remains within the viewport')
    dialog.remove()
    f.controller.show('Back to the music panel')
    assert.equal(f.tip.popoverOpen, false, 'leaving modal context restores normal stacking')
    assert.equal(f.tip.getAttribute('popover'), null)
  }
  f.controller.destroy()
  f.assertCleared()
}

console.log('Live2D tips: delegated child/focus/click events, safe configurable keyword colors, inert text, dynamic controls, idempotent initialization, one expiry timer, lifecycle cleanup and popover fallback passed.')
