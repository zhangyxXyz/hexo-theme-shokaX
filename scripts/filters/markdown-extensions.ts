/* global hexo */
import { markdownExtensions } from '../utils/markdown'

// Emitted by the patched hexo-renderer-aether when it builds its markdown-it
// instance on first render. That can precede theme language loading and the
// site overrides, and i18n.__() snapshots its data, so resolve on every call.
hexo.extend.filter.register('markdown-it:renderer', (md) => {
  const translate = (key: string) => {
    // @ts-ignore Hexo's public theme i18n API is missing from its types.
    const { i18n } = hexo.theme
    const normalize = (value: string) => value.replace(/_/g, '-').toLowerCase()
    const languages = new Map<string, string>(i18n.list().map((lang: string) => [normalize(lang), lang]))
    const requested = [...[].concat(hexo.config.language || []), 'en']
      .filter((lang): lang is string => typeof lang === 'string' && !!lang.trim())
      .map(lang => languages.get(normalize(lang)) || lang)
    return i18n.__(requested)(key)
  }
  markdownExtensions(md, translate, {
    baseDir: hexo.base_dir,
    warn: message => hexo.log.warn(message)
  })
})
