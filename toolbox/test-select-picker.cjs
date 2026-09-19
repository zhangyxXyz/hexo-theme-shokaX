const assert = require('node:assert/strict')
const path = require('node:path')
const vm = require('node:vm')
const { buildSync } = require('esbuild')

class Element extends EventTarget {
  children = []; dataset = {}; attributes = {}; style = {}; value = ''; disabled = false
  classList = { add() {}, remove() {} }
  constructor(tag) { super(); this.tag = tag }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child) } }
  after(child) { child.parentElement = this.parentElement; this.parentElement.children.splice(this.parentElement.children.indexOf(this) + 1, 0, child) }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this) }
  contains(node) { return node === this || this.children.some(child => child.contains(node)) }
  get options() { return this.children }
  get selectedOptions() { return this.options.filter(option => option.value === this.value) }
  get selectedIndex() { return this.options.findIndex(option => option.value === this.value) }
  get selected() { return this.parentElement?.value === this.value }
  setAttribute(key, value) { this.attributes[key] = value }
  getAttribute(key) { return this.attributes[key] }
  removeAttribute(key) { delete this.attributes[key] }
  focus() { document.activeElement = this }
  click() { if (!this.disabled) this.onclick?.(new Event('click')) }
  getBoundingClientRect() { return { top: 20, bottom: 60, right: 200 } }
  get offsetWidth() { return 180 }
  get offsetHeight() { return 90 }
}
const document = Object.assign(new EventTarget(), { body: new Element('body'), createElement: tag => new Element(tag) })
const window = Object.assign(new EventTarget(), { innerWidth: 390, innerHeight: 844 })
const context = { module: { exports: {} }, document, window, Event, AbortController }
vm.runInNewContext(buildSync({ entryPoints: [path.join(__dirname, '../source/js/_app/components/select-picker.ts')], bundle: true, write: false, format: 'cjs' }).outputFiles[0].text, context)
const { enhanceSelect } = context.module.exports
function makeSelect() {
  const wrapper = new Element('div'), select = new Element('select')
  document.body.append(wrapper); wrapper.append(select)
  for (const value of ['10', '15', '20']) {
    const option = new Element('option'); option.value = value; option.text = 'TOP ' + value; option.disabled = value === '15'; select.append(option)
  }
  select.value = '10'
  return { wrapper, select }
}
function key(value) { const event = new Event('keydown', { cancelable: true }); Object.defineProperty(event, 'key', { value }); document.dispatchEvent(event) }
const { wrapper, select } = makeSelect()
const lifecycle = new AbortController()
const picker = enhanceSelect(select, { signal: lifecycle.signal, variant: 'statistics' })
assert.equal(enhanceSelect(select), picker, 'Repeated initialization reuses the same picker')
assert.equal(wrapper.children.length, 2)
const trigger = wrapper.children[1]
trigger.click()
assert.equal(trigger.getAttribute('aria-expanded'), 'true')
key('ArrowDown')
assert.equal(document.activeElement.textContent, undefined)
assert.equal(document.activeElement.children[0].textContent, 'TOP 20', 'Keyboard navigation skips disabled options')
document.activeElement.click()
assert.equal(select.value, '20')
assert.equal(trigger.children[1].textContent, 'TOP 20', 'Native change updates the trigger')
assert.equal(document.activeElement, trigger)
trigger.click(); key('Escape')
assert.equal(trigger.getAttribute('aria-expanded'), 'false')
const other = makeSelect(); enhanceSelect(other.select)
trigger.click(); other.wrapper.children[1].click()
assert.equal(trigger.getAttribute('aria-expanded'), 'false', 'Only one menu can be open')
document.dispatchEvent(new Event('pjax:send'))
assert.equal(other.wrapper.children[1].getAttribute('aria-expanded'), 'false', 'PJAX closes detached menus')
trigger.click(); lifecycle.abort()
assert.equal(wrapper.children.length, 1)
assert.equal(select.hidden, false, 'Disposal restores the native control')
assert(!document.body.children.some(child => child.className === 'select-picker-menu'))
console.log('PASS: select picker selection, keyboard, disabled options, single-open behavior and lifecycle cleanup')
