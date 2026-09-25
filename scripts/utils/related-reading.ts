import { load } from 'cheerio'
import { buildGraphIndex } from './article-graph'

const stop = new Set('的 了 和 是 在 与 为 对 中 将 及 等 有 一个 使用 通过 可以 进行 这个 文章 本文 介绍 内容 作者 题目 问题 方法 题解 引言 思路 复杂 时间 空间 输入 输出 示例 代码 返回 给定 要求 实现 下面 注意 首先 随后 核心 简单 说明 ac leetcode programming code return int void func std solution true false null the a an of to in is and for on with this that from as by or are be'.split(' '))
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' })
const tokens = (value: string) => [...segmenter.segment(value.toLowerCase())].filter(s => s.isWordLike).map(s => s.segment).filter(t => t.length > 1 && !/^\d+$/.test(t) && !stop.has(t))
const array = value => Array.isArray(value) ? value : value?.toArray?.() || []

export function relatedReading(posts: any[], config, settings = {}, summary = (_post): string => '', limit = 4) {
  const graph = buildGraphIndex(posts, config, (settings as any).domain_aliases || [])
  const records = posts.filter(post => graph.nodes.has(String(post.path).replace(/^\/+/, ''))).map(post => {
    const $ = load(String(post.content || ''))
    const headings = $('h1,h2,h3').map((_, element) => $(element).text()).get().join(' ')
    $('script,style,pre,code,svg,table,iframe,.ai-summary,.article-info,.note.warning,.anchor,[data-pagefind-ignore]').remove()
    $('p,li,div,br').append(' ')
    const fields: [number, string[]][] = [[3, tokens(String(post.title || ''))], [2, tokens(summary(post))], [1, tokens(headings)], [1, tokens($.root().text())]]
    return { post, id: String(post.path).replace(/^\/+/, ''), fields, tags: array(post.tags).map(tag => tag.name), category: array(post.categories).at(-1)?.name,
      vector: new Map<string, number>(), norm: 1 }
  })
  const frequency = new Map<string, number>()
  for (const record of records) for (const term of new Set(record.fields.flatMap(field => field[1]))) frequency.set(term, (frequency.get(term) || 0) + 1)
  for (const record of records) {
    for (const [weight, terms] of record.fields) {
      const counts = new Map<string, number>()
      terms.forEach(term => counts.set(term, (counts.get(term) || 0) + 1))
      const norm = Math.sqrt([...counts.values()].reduce((sum, count) => sum + (1 + Math.log(count)) ** 2, 0)) || 1
      for (const [term, count] of counts) record.vector.set(term, (record.vector.get(term) || 0) + weight * (1 + Math.log(count)) / norm * (Math.log((records.length + 1) / (frequency.get(term) + 1)) + 1))
    }
    record.norm = Math.sqrt([...record.vector.values()].reduce((sum, value) => sum + value * value, 0)) || 1
  }
  return new Map(records.map(current => {
    const linked = new Set([...graph.incoming.get(current.id), ...graph.outgoing.get(current.id)])
    const matches = records.filter(other => other !== current && !linked.has(other.id) && other.post.related_reading !== false).map(other => {
      let dot = 0
      for (const [term, value] of current.vector) dot += value * (other.vector.get(term) || 0)
      const similarity = dot / (current.norm * other.norm)
      const tags = current.tags.filter(tag => other.tags.includes(tag))
      const category = Boolean(current.category && current.category === other.category)
      return { post: other.post, tags, category, similarity, score: .7 * similarity + .2 * tags.length / (new Set([...current.tags, ...other.tags]).size || 1) + .1 * Number(category) }
    }).filter(match => match.similarity >= .12).sort((a, b) => b.score - a.score || String(a.post.path).localeCompare(String(b.post.path))).slice(0, limit)
    return [current.id, matches]
  }))
}
