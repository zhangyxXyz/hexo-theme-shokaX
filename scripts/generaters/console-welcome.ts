export {}

type WelcomeMessages = { subtitle?: string; message?: string; links?: Record<string, string> }
type WelcomeConfig = { title: string; art: string; messages: Record<string, WelcomeMessages>; links: string[][] }

// Optional theme console greeting; independent of the theme's attribution log.
const route = 'js/console-welcome.js'
const settings = () => (hexo.theme.config as any).console_welcome

function printWelcome (config: WelcomeConfig) {
  const marker = Symbol.for('shokax.console-welcome')
  const scope = window as unknown as Record<symbol, boolean>
  if (scope[marker]) return
  scope[marker] = true

  const language = navigator.languages?.[0] || navigator.language || 'en'
  const messages = (/^zh(?:[-_]|$)/i.test(language) ? config.messages.zh : null) || config.messages.en || {}

  if (config.art) console.log('%c%s', 'color:#80a8c8;font:13px/1.5 monospace;', config.art)
  console.log('%c %s %c %s ',
    'background:#e9546b;color:#fff;padding:6px 10px;border-radius:5px 0 0 5px;font-weight:bold;', config.title,
    'background:#273244;color:#d9e6f2;padding:6px 10px;border-radius:0 5px 5px 0;', messages.subtitle || '')
  console.log('%c%s', 'color:#a58bbd;font:13px/1.8 monospace;', messages.message || '')
  for (const [key, url] of config.links) console.log('%s → %s', messages.links?.[key] || key, url)
}

hexo.extend.generator.register('console-welcome', function () {
  const options = settings()
  if (!options?.enable) return []
  const links = Object.entries(options.links || {}).flatMap(([label, value]) => {
    try {
      const url = new URL(String(value), (hexo.theme.config as any).site_url || hexo.config.url)
      return ['https:', 'http:'].includes(url.protocol) ? [[label, url.href]] : []
    } catch { return [] }
  })
  const config: WelcomeConfig = {
    title: String(options.title || hexo.config.title || (hexo.theme.config as any).alternate),
    art: typeof options.art === 'string' ? options.art : '',
    messages: options.messages || {},
    links
  }
  return { path: route, data: `;(${printWelcome.toString()})(${JSON.stringify(config)});` }
})

hexo.extend.filter.register('after_render:html', function (html) {
  if (!settings()?.enable) return html
  const root = String(hexo.config.root || '/').replace(/\/$/, '')
  const src = `${root}/${route}`.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  return html.replace('</head>', `<script defer src="${src}"></script></head>`)
})
