import { SiteLocals } from "hexo/dist/types"
import { createHash, randomUUID } from "node:crypto"
import fs from 'node:fs/promises'
import { stripHTML } from 'hexo-util'

interface SummaryEntry {
  summary: string
  sha256: string
  model?: string
  requestedModel?: string
  generatedAt?: string
  provider?: string
}

interface SummaryVersion extends SummaryEntry { id: string }

async function getSummaryByAPI (content:string, settings) {
  const apiKey = settings.apiKey
  if (!apiKey || /[\r\n]/.test(apiKey)) throw new Error('Missing or invalid summary API key')
  const apiUrl = settings.apiUrl
  const model = settings.model
  const temperature = settings.temperature ?? 1.3
  const initalPrompt = settings.initalPrompt
  const responses = settings.apiType === 'responses'

  const res = await fetch(apiUrl, {
    signal: AbortSignal.timeout(settings.timeout || 60000),
    redirect: 'error',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'StarryNightsStudio-Summary/1.0',
      ...(settings.sessionHeader ? { [settings.sessionHeader]: randomUUID() } : {})
    },
    body: JSON.stringify({
      model: model,
      ...(responses ? { instructions: initalPrompt, input: content } : { messages: [{
        role: 'system', 
        content: `${initalPrompt}`
      },{ 
        role: 'user', 
        content: `${content}` 
      }] }),
      temperature: temperature
    })
  })

  if (!res.ok) {
    throw new Error(`Error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  if (data.error) {
    throw new Error('Summary API returned an error')
  }

  const summary = responses
    ? (Array.isArray(data.output) ? data.output.filter(item => item.type === 'message' && item.role === 'assistant').flatMap(item => Array.isArray(item.content) ? item.content : []).filter(part => part.type === 'output_text' && typeof part.text === 'string').map(part => part.text).join('\n') : '')
    : data.choices?.[0]?.message?.content
  if (typeof summary !== 'string' || !summary.trim()) throw new Error('Empty summary response')

  return {
    summary: summary.trim(),
    model: typeof data.model === 'string' && data.model.trim() ? data.model.trim() : model,
    requestedModel: model,
    generatedAt: new Date().toISOString()
  }
}

class SummaryDatabase {
  fileChanged: boolean
  data: {
    version: number
    features: {
      incremental: boolean
    }
    summaries: {
      [key: string]: SummaryVersion[]
    }
  }

  constructor() {
    this.fileChanged = false
    this.data = {
      version: 3,
      features: {
        incremental: false
      },
      summaries: {}
    }
  }

  async readDB () {
    try {
      await fs.access('summary.json')
      const saved = JSON.parse(await fs.readFile('summary.json', 'utf-8'))
      if (saved.version === 2) {
        for (const [path, entry] of Object.entries(saved.summaries) as [string, SummaryEntry][]) {
          this.data.summaries[path] = [{ ...entry, id: entry.requestedModel || entry.model || 'legacy' }]
        }
        this.fileChanged = true
      } else {
        this.data = saved
      }
    } catch (error) {
      // 无需处理数据库不存在的情况
    }
    if (this.data.version !== 3) {
      throw new Error(`Incompatible version of summary database: ${this.data.version}`)
    }
  }

  async writeDB () {
    if (this.fileChanged) {
      await fs.writeFile('summary.json', JSON.stringify(this.data, null, 4) + '\n')
    }
  }

  async getPostSummary (path:string, content:string, settings) {
    const pathHash = createHash('sha256').update(path).digest('hex')
    const contentHash = createHash('sha256').update(JSON.stringify([content, settings.model, settings.apiUrl, settings.initalPrompt, settings.temperature])).digest('hex')
    const versions = (this.data.summaries[pathHash] ||= [])
    const cached = versions.find(entry => entry.id === settings.id) || versions.find(entry => !entry.provider && entry.sha256 === contentHash)
    if (cached?.sha256 === contentHash) {
      if (settings.provider && !cached.provider) {
        cached.id = settings.id
        cached.provider = settings.provider
        this.fileChanged = true
      }
      return cached
    } else if (settings.cacheOnly) {
      return null
    } else {
      hexo.log.info(`[ShokaX Summary AI] 正在向 API 请求 ${path} 的摘要`)
      const summaryContent = await getSummaryByAPI(content, settings)
      const entry = {
        ...summaryContent,
        id: settings.id,
        provider: settings.provider,
        sha256: contentHash
      }
      const index = versions.findIndex(version => version.id === settings.id)
      if (index === -1) versions.push(entry)
      else versions[index] = entry
      this.fileChanged = true
      return entry
    }
  }
}

// Warehouse queries return fresh documents; do not attach transient data to them.
const pageSummaries = new Map<string, SummaryVersion[]>()

hexo.extend.helper.register('summary_card', function (post) {
  if (!hexo.theme.config.summary.enable || post.encrypt || post.password || post.ai_summary === false) return null
  const entries = pageSummaries.get(post.path)
  return entries?.length ? entries.map(entry => ({ id: entry.id, text: entry.summary, model: entry.model || entry.requestedModel || '' })) : null
})

hexo.extend.filter.register('template_locals', function (locals) {
  const page = locals.page
  if (page && hexo.theme.config.summary.enable && !page.encrypt && !page.password && page.ai_summary !== false) {
    const summary = pageSummaries.get(page.path)?.[0]
    if (summary) {
      page.summary = summary.summary
      page.summaryModel = summary.model || summary.requestedModel || ''
    }
  }
  return locals
})

// Complete summaries before page generators render their templates.
hexo.extend.filter.register('before_generate', async function () {
  pageSummaries.clear()
  const posts = hexo.locals.get('posts') as SiteLocals['posts']

  if (!hexo.theme.config.summary.enable) {
    return
  }

  const db = new SummaryDatabase()
  await db.readDB()

  const settings = hexo.theme.config.summary
  const hasProviders = Array.isArray(settings.providers) && settings.providers.length > 0
  const providerIds = new Set<string>()
  const providers = hasProviders ? settings.providers : [{ models: Array.isArray(settings.models) && settings.models.length ? settings.models : [{ model: settings.model }] }]
  const ids = new Set<string>()
  const models = providers.filter(provider => provider && provider.enable !== false).flatMap(provider => {
    if (hasProviders) {
      if (typeof provider.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(provider.id) || providerIds.has(provider.id)) throw new Error('Summary providers require unique alphanumeric IDs')
      providerIds.add(provider.id)
    }
    if (!Array.isArray(provider.models)) throw new Error('Summary provider models must be an array')
    return provider.models.filter(model => model && model.enable !== false).map(value => {
    const model = typeof value === 'string' ? { model: value } : value
    const localId = model.id || model.model
    const merged = { ...settings, ...provider, ...model, provider: hasProviders ? provider.id : undefined, id: hasProviders ? `${provider.id}/${localId}` : localId }
    if (!merged.model || !merged.id || ids.has(merged.id)) throw new Error('Summary models require unique IDs and model names')
    if (!merged.cacheOnly && (typeof merged.apiUrl !== 'string' || !/^https?:\/\//.test(merged.apiUrl))) throw new Error('Summary provider requires an HTTP(S) apiUrl')
    ids.add(merged.id)
    return merged
    })
  })
  if (settings.defaultModel) models.sort((a, b) => Number(b.id === settings.defaultModel) - Number(a.id === settings.defaultModel))
  const postArray = posts.toArray().filter(post => !settings.include?.length || settings.include.includes(post.path));

  const pLimit = require('@common.js/p-limit').default
  const concurrencyLimit = pLimit(hexo.theme.config.summary?.concurrency || 5); 

  const processingPromises = postArray.map(async post => {
    const content = stripHTML(post.content || '').replace(/\s+/g, ' ').trim().slice(0, settings.maxInputChars || 16000);
    const path = post.path;
    const published = post.published;

    if (content && path && published && !post.encrypt && !post.password && post.ai_summary !== false) {
      const versions = await Promise.all(models.map(model => concurrencyLimit(async () => {
        try {
          const summary = await db.getPostSummary(path, content, model)
          return summary ? { ...summary, id: model.id } : null
        } catch (error) {
          hexo.log.error(`[ShokaX Summary AI] ${path} (${model.id}):`, error.message)
          return null
        }
      })))
      pageSummaries.set(path, versions.filter((entry): entry is SummaryVersion => entry !== null))
    }
  });

  await Promise.all(processingPromises);
  await db.writeDB()
  hexo.log.info(`[ShokaX Summary AI] 所有文章摘要处理完成，已保存到数据库`);
})
