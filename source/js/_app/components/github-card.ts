/** Fills `::github` cards with public repository data once they near the viewport. */
interface RepoData {
  description: string | null
  homepage: string | null
  language: string | null
  license: string | null
  topics: string[]
  stars: number
  forks: number
  issues: number
}

const TTL = 30 * 60 * 1000
const STORAGE_PREFIX = 'shokax.github.repo.'
const pending = new Map<string, Promise<RepoData>>()
let controller: AbortController | undefined
let observer: IntersectionObserver | undefined

document.addEventListener('pjax:send', () => {
  observer?.disconnect()
  controller?.abort()
  pending.clear()
})

function cached(repo: string): RepoData | undefined {
  try {
    const entry = JSON.parse(sessionStorage.getItem(STORAGE_PREFIX + repo) || 'null')
    if (entry && Date.now() - entry.time < TTL) return entry.data
  } catch { /* Storage may be disabled or hold an older shape. */ }
  return undefined
}

function store(repo: string, data: RepoData) {
  try { sessionStorage.setItem(STORAGE_PREFIX + repo, JSON.stringify({ time: Date.now(), data })) } catch { /* Quota or privacy mode. */ }
}

function load(repo: string, signal: AbortSignal) {
  const hit = cached(repo)
  if (hit) return Promise.resolve(hit)
  let request = pending.get(repo)
  if (!request) {
    request = fetch(`https://api.github.com/repos/${repo}`, { signal, headers: { Accept: 'application/vnd.github+json' } })
      .then(response => {
        if (!response.ok) throw new Error(`GitHub ${response.status}`)
        return response.json()
      })
      .then((json): RepoData => {
        const data = {
          description: json.description || null,
          homepage: /^https?:\/\//.test(json.homepage || '') ? json.homepage : null,
          language: json.language || null,
          license: json.license && json.license.spdx_id !== 'NOASSERTION' ? json.license.spdx_id : null,
          topics: Array.isArray(json.topics) ? json.topics.slice(0, 2) : [],
          stars: Number(json.stargazers_count) || 0,
          forks: Number(json.forks_count) || 0,
          issues: Number(json.open_issues_count) || 0
        }
        store(repo, data)
        return data
      })
      .finally(() => pending.delete(repo))
    pending.set(repo, request)
  }
  return request
}

function fill(card: HTMLElement, data: RepoData) {
  const format = new Intl.NumberFormat(document.documentElement.lang || undefined, { notation: 'compact', maximumFractionDigits: 1 })
  for (const key of ['stars', 'forks', 'issues'] as const) {
    const value = card.querySelector<HTMLElement>(`[data-github-stat="${key}"]`)
    if (value) value.textContent = format.format(data[key])
  }
  const description = card.querySelector<HTMLElement>('[data-github-description]')
  if (description && data.description && !card.hasAttribute('data-github-static')) description.textContent = data.description
  const tags = card.querySelector<HTMLElement>('[data-github-tags]')
  const values = [data.language, data.license, ...data.topics].filter(Boolean) as string[]
  if (tags && values.length) {
    tags.replaceChildren(...values.map(value => Object.assign(document.createElement('li'), { textContent: value })))
    tags.hidden = false
  }
  const homepage = card.querySelector<HTMLAnchorElement>('[data-github-homepage]')
  if (homepage && data.homepage && !homepage.hasAttribute('href')) {
    homepage.href = data.homepage
    homepage.hidden = false
  }
  card.dataset.githubState = 'ready'
}

export function refreshGithubCards() {
  observer?.disconnect()
  controller?.abort()
  const cards = Array.from(document.querySelectorAll<HTMLElement>('.md .md-github[data-github-fetch]'))
  if (!cards.length) return
  const signal = (controller = new AbortController()).signal
  const request = (card: HTMLElement) => {
    const repo = card.dataset.githubRepo
    if (!repo || card.dataset.githubState) return
    card.dataset.githubState = 'loading'
    load(repo, signal).then(data => {
      if (card.isConnected) fill(card, data)
    }, () => {
      // Static copy and links stay usable; no retry loop.
      if (card.isConnected) card.dataset.githubState = 'error'
    })
  }
  if (!('IntersectionObserver' in window)) { cards.forEach(request); return }
  observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      observer?.unobserve(entry.target)
      request(entry.target as HTMLElement)
    }
  }, { rootMargin: '200px 0px' })
  cards.forEach(card => observer.observe(card))
}
