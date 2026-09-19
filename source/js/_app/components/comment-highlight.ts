import { createHighlighterCore } from 'shiki/core'
import { createOnigurumaEngine } from 'shiki/engine/oniguruma'

// Same Shiki engine and light/dark themes used by Aether. Load grammars on demand.
const grammars = {
  javascript: () => import('shiki/langs/javascript.mjs'),
  typescript: () => import('shiki/langs/typescript.mjs'),
  html: () => import('shiki/langs/html.mjs'),
  css: () => import('shiki/langs/css.mjs'),
  json: () => import('shiki/langs/json.mjs'),
  yaml: () => import('shiki/langs/yaml.mjs'),
  bash: () => import('shiki/langs/bash.mjs'),
  cpp: () => import('shiki/langs/cpp.mjs'),
  python: () => import('shiki/langs/python.mjs'),
  markdown: () => import('shiki/langs/markdown.mjs'),
  diff: () => import('shiki/langs/diff.mjs'),
  sql: () => import('shiki/langs/sql.mjs'),
  lua: () => import('shiki/langs/lua.mjs'),
  java: () => import('shiki/langs/java.mjs'),
  csharp: () => import('shiki/langs/csharp.mjs'),
  vue: () => import('shiki/langs/vue.mjs'),
  shellscript: () => import('shiki/langs/shellscript.mjs')
}
const aliases: Record<string, string> = { js: 'javascript', ts: 'typescript', yml: 'yaml', sh: 'bash', shell: 'bash', py: 'python', md: 'markdown', 'c++': 'cpp', cs: 'csharp' }
const highlighter = createHighlighterCore({
  themes: [import('shiki/themes/vitesse-light.mjs'), import('shiki/themes/vitesse-dark.mjs')],
  langs: [], engine: createOnigurumaEngine(import('shiki/wasm'))
})
const loading = new Map<string, Promise<void>>()
export async function highlightCommentCode(text: string, language: string) {
  const highlighterInstance = await highlighter
  const normalized = language.toLowerCase()
  let lang = aliases[normalized] || normalized
  const grammar = grammars[lang as keyof typeof grammars]
  if (!grammar || text.length > 100000) lang = 'text'
  else {
    if (!loading.has(lang)) loading.set(lang, grammar().then(module => highlighterInstance.loadLanguage(module.default)))
    await loading.get(lang)
  }
  return highlighterInstance.codeToHtml(text, { lang, themes: { light: 'vitesse-light', dark: 'vitesse-dark' } })
}
