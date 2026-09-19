import {CONFIG} from '../globals/globalVars'

export function initializePagefindSearch(selector: string) {
  const dialog = document.querySelector<HTMLDialogElement>('#site-search')
  const trigger = document.querySelector<HTMLElement>(selector)
  if (!dialog || !trigger) return
  const workspace = dialog.querySelector<HTMLElement>('.search-workspace')
  const input = dialog.querySelector<HTMLInputElement>('.pagefind-ui__search-input')
  const list = dialog.querySelector<HTMLElement>('.search-result-list')
  const status = dialog.querySelector<HTMLElement>('.pagefind-ui__message')
  const pagination = dialog.querySelector<HTMLElement>('.search-pagination')
  const drawer = dialog.querySelector<HTMLElement>('.pagefind-ui__drawer')
  const clear = dialog.querySelector<HTMLButtonElement>('.pagefind-ui__search-clear')
  const text = dialog.dataset
  let previousOverflow = ''
  let previousFocus: HTMLElement | null = null
  let openedWithPointer = false
  let api: Promise<any> | undefined
  let results: any[] = []
  let page = 1
  let queryTime = '0'
  let revision = 0
  let timer: ReturnType<typeof setTimeout>
  const pageSize = 5
  const bundle = `${CONFIG.root.replace(/\/?$/, '/')}pagefind/pagefind.js`
  const load = () => api ??= import(/* @vite-ignore */ bundle).catch(cause => {
    api = undefined
    throw cause
  })
  const element = (tag: string, className: string, value?: string) => {
    const node = document.createElement(tag)
    node.className = className
    if (value) node.textContent = value
    return node
  }
  const link = (title: string, url: string) => {
    const anchor = element('a', 'pagefind-ui__result-link', title) as HTMLAnchorElement
    const target = new URL(url, location.href)
    if (target.origin === location.origin && /^https?:$/.test(target.protocol)) anchor.href = target.href
    return anchor
  }
  // Preserve only text and highlight markers from Pagefind's excerpt markup.
  const excerpt = (html: string) => {
    const paragraph = element('p', 'pagefind-ui__result-excerpt')
    const parsed = new DOMParser().parseFromString(html || '', 'text/html')
    const copy = (source: Node, target: Node) => {
      for (const child of Array.from(source.childNodes)) {
        if (child.nodeType === Node.TEXT_NODE) target.appendChild(document.createTextNode(child.textContent || ''))
        else if (child.nodeName === 'MARK') {
          const mark = document.createElement('mark')
          mark.textContent = child.textContent
          target.appendChild(mark)
        } else copy(child, target)
      }
    }
    copy(parsed.body, paragraph)
    return paragraph
  }
  const renderPagination = () => {
    pagination.replaceChildren()
    const pages = Math.ceil(results.length / pageSize)
    if (pages <= 1) return
    const button = (label: string, number: number, disabled = false) => {
      const item = element('button', '', label) as HTMLButtonElement
      item.type = 'button'
      item.disabled = disabled
      if (number === page && !disabled) item.setAttribute('aria-current', 'page')
      item.addEventListener('click', () => { page = number; renderPage(++revision, true) })
      pagination.append(item)
    }
    button('‹', page - 1, page === 1)
    pagination.lastElementChild.setAttribute('aria-label', text.previous)
    for (let number = 1; number <= pages; number++) {
      if (number === 1 || number === pages || Math.abs(number - page) <= 1) button(String(number), number)
      else if (number === page - 2 || number === page + 2) pagination.append(element('span', '', '…'))
    }
    button('›', page + 1, page === pages)
    pagination.lastElementChild.setAttribute('aria-label', text.next)
  }
  const renderPage = async (token: number, focusPage = false) => {
    drawer.setAttribute('aria-busy', 'true')
    status.textContent = text.loading
    list.replaceChildren()
    pagination.replaceChildren()
    try {
      const items = await Promise.all(results.slice((page - 1) * pageSize, page * pageSize).map(result => result.data()))
      if (token !== revision) return
      status.replaceChildren()
      const searchIcon = element('i', 'ic i-search')
      searchIcon.setAttribute('aria-hidden', 'true')
      status.append(searchIcon)
      const summary = element('span', 'search-result-summary')
      for (const part of text.results.split(/(\{time\}|\{count\})/)) {
        if (part === '{time}' || part === '{count}') {
          summary.append(element('strong', '', part === '{time}' ? queryTime : String(results.length)))
        } else summary.append(document.createTextNode(part))
      }
      status.append(summary)
      for (const [index, item] of items.entries()) {
        const article = element('article', 'pagefind-ui__result')
        const meta = element('div', 'search-result-meta')
        if (item.meta.category) {
          const category = element('span', 'search-result-category')
          const icon = element('i', 'ic i-tags')
          icon.setAttribute('aria-hidden', 'true')
          category.append(icon, document.createTextNode(item.meta.category))
          meta.append(category)
        }
        if (item.meta.date) {
          const date = element('time', 'search-result-date') as HTMLTimeElement
          date.dateTime = item.meta.date
          const icon = element('i', 'ic i-calendar')
          icon.setAttribute('aria-hidden', 'true')
          date.append(icon, document.createTextNode(item.meta.date))
          meta.append(date)
        }
        const number = element('span', 'search-result-number', String((page - 1) * pageSize + index + 1).padStart(2, '0'))
        number.setAttribute('aria-hidden', 'true')
        article.append(number)
        if (meta.childElementCount) article.append(meta)
        const title = element('h3', 'pagefind-ui__result-title')
        title.append(link(item.meta.title || item.url, item.url))
        article.append(title)
        const sections = item.sub_results?.slice(0, 3) || []
        if (!sections.length) article.append(excerpt(item.excerpt))
        for (const section of sections) {
          const block = element('div', 'search-subresult')
          if (section.url !== item.url) {
            const heading = element('h4', 'search-section-title')
            heading.append(link(`↳ ${section.title}`, section.url))
            block.append(heading)
          }
          block.append(excerpt(section.excerpt))
          article.append(block)
        }
        list.append(article)
      }
      renderPagination()
      list.scrollTop = 0
      if (focusPage) pagination.querySelector<HTMLButtonElement>('[aria-current]')?.focus({preventScroll: true})
    } catch {
      if (token === revision) status.textContent = text.error
    } finally {
      if (token === revision) drawer.setAttribute('aria-busy', 'false')
    }
  }
  const search = () => {
    clearTimeout(timer)
    const token = ++revision
    const query = input.value.trim()
    workspace.classList.toggle('has-query', !!query)
    clear.hidden = !input.value
    list.replaceChildren()
    pagination.replaceChildren()
    if (!query) { drawer.setAttribute('aria-busy', 'false'); return }
    status.textContent = text.loading
    timer = setTimeout(async () => {
      try {
        const engine = await load()
        const started = performance.now()
        const found = await engine.search(query)
        if (token !== revision) return
        queryTime = String(Math.max(1, Math.round(performance.now() - started)))
        results = found.results
        page = 1
        await renderPage(token)
      } catch { if (token === revision) status.textContent = text.error }
    }, 200)
  }
  input.addEventListener('input', event => { if (!(event as InputEvent).isComposing) search() })
  input.addEventListener('compositionend', search)
  dialog.querySelectorAll<HTMLButtonElement>('[data-search-topic]').forEach(button => {
    button.addEventListener('click', () => {
      input.value = button.dataset.searchTopic
      search()
      input.focus()
    })
  })
  clear.addEventListener('click', () => { input.value = ''; search(); input.focus() })
  dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); search() })
  dialog.querySelectorAll('.search-dismiss').forEach(button => button.addEventListener('click', () => dialog.close()))
  dialog.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.isComposing) {
      event.preventDefault()
      event.stopPropagation()
      dialog.close()
    }
  })
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow
    if (openedWithPointer) {
      if (document.activeElement === trigger) trigger.blur()
    } else previousFocus?.focus({preventScroll: true})
  })
  dialog.addEventListener('click', event => {
    if (event.target === dialog || (event.target as Element).closest('.pagefind-ui__result-link')) dialog.close()
  })
  trigger.setAttribute('role', 'button')
  trigger.setAttribute('aria-label', dialog.querySelector('.search-eyebrow').textContent)
  trigger.setAttribute('tabindex', '0')
  trigger.setAttribute('aria-haspopup', 'dialog')
  trigger.setAttribute('aria-controls', 'site-search')
  const open = (pointer = false) => {
    if (dialog.open) return
    openedWithPointer = pointer
    previousFocus = document.activeElement as HTMLElement
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!input.value.trim()) {
      const topics = Array.from(dialog.querySelectorAll<HTMLButtonElement>('[data-search-topic]'))
      for (let i = topics.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[topics[i], topics[j]] = [topics[j], topics[i]]
      }
      topics.forEach((topic, index) => {
        topic.hidden = index >= 6
        topic.parentElement.append(topic)
      })
    }
    dialog.showModal()
    input.focus()
  }
  trigger.addEventListener('click', event => open(event.detail > 0))
  trigger.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() }
  })
}
