import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { transform } from 'esbuild'

const temp = new URL(`./.comment-highlight-${process.pid}.mjs`, import.meta.url)
try {
  const source = await fs.readFile(new URL('../source/js/_app/components/comment-highlight.ts', import.meta.url), 'utf8')
  const { code } = await transform(source, { loader: 'ts', format: 'esm' })
  await fs.writeFile(temp, code)
  const { highlightCommentCode: render } = await import(temp.href)
  const highlighted = await render('const answer = 42;', 'js')
  assert.match(highlighted, /vitesse-light vitesse-dark/)
  assert.match(highlighted, /--shiki-dark/)
  const payload = '<img src=x onerror=alert(1)>\n<script>alert(1)</script>'
  for (const language of ['text', 'unknown', 'html']) {
    const html = await render(payload, language)
    assert.ok(!html.includes('<img') && !html.includes('<script'))
    assert.match(html, /&(?:lt|#x3c|#60);/i)
  }
  const parallel = await Promise.all([render('print(1)', 'python'), render('print(2)', 'python')])
  assert.equal(parallel.length, 2)
  console.log('Comment highlighting: language alias, dark theme, escaped HTML, unknown language and concurrent grammar loading passed.')
} finally { await fs.rm(temp, { force: true }) }
