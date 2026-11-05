import { escapeHtml, parseAttrs, textAttr, type Translate } from './shared'

const REPO = /^[\w.-]+\/[\w.-]+$/
const STAR = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.2l2.04 4.13 4.56.66-3.3 3.22.78 4.54L8 11.6l-4.08 2.15.78-4.54L1.4 5.99l4.56-.66z"/></svg>'
const FORK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0zm8.5 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0zM9.25 12.75a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0zM3.75 4.5v1.75c0 1 .8 1.75 1.75 1.75h5c1 0 1.75-.8 1.75-1.75V4.5M8 8v3.5"/></svg>'
const ISSUE = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="1.4"/></svg>'

export function renderGithubCard(t: Translate, attrs: Record<string, string | true>) {
  const repo = textAttr(attrs.repo)
  const [owner, name] = repo.split('/')
  const url = `https://github.com/${repo}`
  const description = textAttr(attrs.description)
  const homepage = /^https?:\/\//i.test(textAttr(attrs.homepage)) ? textAttr(attrs.homepage) : ''
  const fetch = attrs.fetch !== 'false'
  const label = (key: string) => escapeHtml(t(`markdown.github.${key}`))
  const stat = (key: string, icon: string, text: string) =>
    `<div><dt>${icon}<span>${text}</span></dt><dd data-github-stat="${key}">—</dd></div>`
  const stats = fetch
    ? `<dl class="md-github-stats">${stat('stars', STAR, label('stars'))}${stat('forks', FORK, label('forks'))}${stat('issues', ISSUE, label('issues'))}</dl>`
    : ''
  return `<article class="md-github" data-github-repo="${escapeHtml(repo)}"${fetch ? ' data-github-fetch' : ''}${description ? ' data-github-static' : ''}>`
    + '<div class="md-github-copy">'
    + `<p class="md-github-category"><i class="ic i-github" aria-hidden="true"></i><span>${escapeHtml(owner)}</span><span aria-hidden="true">·</span><span>${label('label')}</span></p>`
    + `<p class="md-github-name">${escapeHtml(name)}</p>`
    + `<p class="md-github-description" data-github-description>${description ? escapeHtml(description) : label('description')}</p>`
    + '<ul class="md-github-tags" data-github-tags hidden></ul>'
    + '<div class="md-github-actions">'
    + `<a href="${url}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(repo)} · ${label('view')}"><i class="ic i-github" aria-hidden="true"></i><span>${label('view')}</span></a>`
    + `<a data-github-homepage${homepage ? ` href="${escapeHtml(homepage)}"` : ''} target="_blank" rel="noopener noreferrer"${homepage ? '' : ' hidden'}><i class="ic i-link-alt" aria-hidden="true"></i><span>${label('homepage')}</span></a>`
    + '</div></div>'
    + '<div class="md-github-preview">'
    + `<div class="md-github-windowbar" aria-hidden="true"><span class="md-github-dots"><span></span><span></span><span></span></span><span>github.com/${escapeHtml(repo)}</span></div>`
    + `<div class="md-github-hero"><span>${escapeHtml(owner)} /</span><strong>${escapeHtml(name)}</strong></div>`
    + `${stats}<div class="md-github-lines" aria-hidden="true"><span></span><span></span><span></span></div>`
    + '</div></article>\n'
}

/** `::github{repo="owner/name" description="…" homepage="https://…" fetch="false"}` on its own line. */
export function githubPlugin(md: any, t: Translate) {
  md.block.ruler.before('fence', 'shokax_github', (state: any, startLine: number, _endLine: number, silent: boolean) => {
    if (state.sCount[startLine] - state.blkIndent >= 4) return false
    const line = state.src.slice(state.bMarks[startLine] + state.tShift[startLine], state.eMarks[startLine])
    const match = line.match(/^::github\{(.*)\}\s*$/)
    if (!match) return false
    const attrs = parseAttrs(match[1])
    if (!REPO.test(textAttr(attrs.repo))) return false
    if (silent) return true
    const token = state.push('shokax_github', 'article', 0)
    token.block = true
    token.map = [startLine, startLine + 1]
    token.meta = attrs
    state.line = startLine + 1
    return true
  }, { alt: ['paragraph', 'reference', 'blockquote', 'list'] })

  md.renderer.rules.shokax_github = (tokens: any[], index: number) => renderGithubCard(t, tokens[index].meta)
}
