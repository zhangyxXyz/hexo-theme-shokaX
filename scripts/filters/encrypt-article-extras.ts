// Render private article extras before hexo-blog-encrypt encrypts the body.
// Keep them inside the same authenticated ciphertext, never in hidden plaintext.
hexo.extend.filter.register('after_post_render', (data) => {
  if (data.password === '') return data
  let password = data.password
  if (password == null) {
    const tags = Array.isArray(data.tags) ? data.tags : data.tags?.toArray?.() || []
    const configured = hexo.config.encrypt?.tags || []
    for (const tag of tags) {
      const match = configured.find(entry => entry.name === tag.name)
      if (match) { password = match.password; break }
    }
  }
  if (password == null || password === '') return data
  // Skip already encrypted content if the render pipeline is re-entered.
  if (String(data.content).includes('id="hexo-blog-encrypt"')) return data
  const post = Object.assign({}, data, { encrypt: false, password: '' })
  // @ts-ignore Theme view/i18n APIs are not included in Hexo's public types.
  const theme = hexo.theme
  const languages = [data.lang || data.language, ...[].concat(hexo.config.language || []), 'en'].filter(Boolean)
  const locals = {
    post, page: post, config: hexo.config, theme: theme.config,
    view_dir: hexo.theme_dir + 'layout/', layout: false,
    __: theme.i18n.__(languages), _p: theme.i18n._p(languages)
  }
  const extras = ['article-info', 'ai-summary', 'encrypted-toc'].map(name =>
    theme.getView(`_partials/post/${name}.pug`).renderSync(locals)
  ).join('')
  data.content = extras + data.content
  return data
}, 950)
