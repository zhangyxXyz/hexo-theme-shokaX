hexo.extend.helper.register('get_summary', (post) => {
  return post.encrypt || post.password ? undefined : post.summary
})

hexo.extend.helper.register('get_introduce', () => {
  return hexo.theme.config.summary.introduce
})

function modelRule(model: string) {
  const table = hexo.locals.get('data').model_icons || {}
  const safeIcon = (icon: unknown) => typeof icon === 'string' && /^i-[a-zA-Z0-9_-]+$/.test(icon)
  const normalized = String(model || '').trim().toLowerCase().replace(/^[+~]+/, '')
  const candidates = [normalized]
  const slash = normalized.lastIndexOf('/')
  if (slash >= 0) candidates.push(normalized.slice(0, slash), normalized.slice(slash + 1))
  for (const candidate of candidates) {
    for (const rule of Array.isArray(table.providers) ? table.providers : []) {
      if (!safeIcon(rule.icon) || !Array.isArray(rule.prefixes)) continue
      if (rule.prefixes.some((value: unknown) => {
        if (typeof value !== 'string' || !value) return false
        const prefix = value.toLowerCase()
        if (!candidate.startsWith(prefix)) return false
        const suffix = candidate.slice(prefix.length)
        return prefix === 'hy' ? /^[0-9]/.test(suffix) : !suffix || /^[0-9_.:/-]/.test(suffix)
      })) return rule
    }
  }
  return null
}

hexo.extend.helper.register('sort_summary_models', (versions = []) => {
  const providers = hexo.locals.get('data').model_icons?.providers
  if (!Array.isArray(providers)) return versions.slice()
  const rank = (model: string) => {
    const index = providers.indexOf(modelRule(model))
    return index < 0 ? providers.length : index
  }
  // Stable sort preserves configured order within a family and for unknown models.
  return versions.slice().sort((a, b) => rank(a.model) - rank(b.model))
})

hexo.extend.helper.register('summary_model_icon', (model: string) => {
  const table = hexo.locals.get('data').model_icons || {}
  return modelRule(model)?.icon || (/^i-[a-zA-Z0-9_-]+$/.test(table.fallback || '') ? table.fallback : 'i-robot')
})

hexo.extend.helper.register('summary_model_label', (model: string, language, versions = []) => {
  const rule = modelRule(model)
  if (!rule) return model
  const lang = String((Array.isArray(language) ? language[0] : language) || 'en').toLowerCase().replace(/_/g, '-')
  const labels = rule.labels || {}
  const normalized = Object.fromEntries(Object.entries(labels).map(([key, value]) => [key.toLowerCase().replace(/_/g, '-'), value]))
  const label = normalized[lang] || normalized[lang.split('-')[0]] || normalized.en || rule.name || model
  const duplicate = versions.filter(version => modelRule(version.model)?.name === rule.name).length > 1
  return duplicate ? `${label} · ${model}` : String(label)
})
