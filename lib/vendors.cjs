'use strict'

// Shared by Hexo, environment configuration and the browser. No IO or loading.
const direct = value => /^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(value)
const join = (base, path) => `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`

function resolveResource(value, vendors = {}, context = {}) {
  if (value == null || value === '') return ''
  if (typeof value === 'string') {
    if (direct(value)) return value
    const base = context.resource || vendors.cdns?.site_resource
    return base ? join(base, value) : value
  }
  if (typeof value !== 'object' || typeof value.url !== 'string') throw new Error('Invalid vendor resource')
  if (value.source === 'local' || !value.source) return value.url
  if (value.source === 'site') return join(context.root || '/', value.url)
  const base = vendors.cdns?.[value.source]
  if (!base) throw new Error(`Unknown vendor source: ${value.source}`)
  return join(base, value.url)
}

function resolveVendor(vendors, name, fallback, context = {}) {
  const [group, key, ...extra] = name.split('.')
  if (extra.length || !key || ['__proto__', 'constructor', 'prototype'].includes(group) || ['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error(`Invalid vendor name: ${name}`)
  const value = vendors?.[group]?.[key]
  // Legacy URLs have already been resolved by their existing configuration path.
  return value == null ? (fallback || '') : resolveResource(value, vendors, context)
}

module.exports = { resolveResource, resolveVendor }
