/* global hexo */

// Run before hexo-blog-encrypt's after_post_render filter (priority 1000).
hexo.extend.filter.register('after_post_render', (data) => {
  // @ts-ignore Hexo's public theme i18n API is missing from its types.
  const { i18n } = hexo.theme
  const normalize = (value: string) => value.replace(/_/g, '-').toLowerCase()
  const languages = new Map<string, string>(
    i18n.list().map((lang: string) => [normalize(lang), lang])
  )
  const requested = [data.lang || data.language, ...[].concat(hexo.config.language || []), 'en']
    .filter((lang): lang is string => typeof lang === 'string' && !!lang.trim())
    .map(lang => languages.get(normalize(lang)) || lang)
  const translate = i18n.__(requested)
  const config = hexo.config.encrypt || {}

  for (const field of ['abstract', 'message', 'wrong_pass_message']) {
    // Explicit article/global strings (including empty strings) take precedence.
    if (data[field] != null || config[field] != null) continue
    const key = `encrypt.${field}`
    const value = translate(key)
    if (value !== key) data[field] = value
  }
  return data
}, 900)
