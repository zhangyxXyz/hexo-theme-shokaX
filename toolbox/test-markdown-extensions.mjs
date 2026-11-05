// Renders through the blog's patched hexo-renderer-aether, so the theme
// plugins are exercised next to the bundled containers, attrs and Shiki.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { load } from 'js-yaml'

const require = createRequire(import.meta.url)
const blogRequire = createRequire(`${process.cwd()}/`)
let aetherPath
try { aetherPath = blogRequire.resolve('hexo-renderer-aether') } catch {
  throw new Error('Run from the blog root so hexo-renderer-aether can be resolved.')
}

const result = await build({ entryPoints: [fileURLToPath(new URL('../scripts/utils/markdown/index.ts', import.meta.url))], bundle: true, packages: 'external', platform: 'node', format: 'cjs', write: false })
const module = { exports: {} }
new Function('module', 'exports', 'require', result.outputFiles[0].text)(module, module.exports, require)
const { markdownExtensions } = module.exports

const language = load(readFileSync(new URL('../languages/zh-CN.yml', import.meta.url), 'utf8'))
const t = key => key.split('.').reduce((value, part) => value?.[part], language) ?? key

let renderer
let hooked = 0
const warnings = []
globalThis.hexo = {
  config: {}, theme: { config: {} },
  extend: { renderer: { register: (ext, _out, fn) => { if (ext === 'md') renderer = fn } } },
  execFilterSync: (name, md) => { if (name === 'markdown-it:renderer') { hooked++; markdownExtensions(md, t, { baseDir: process.cwd(), warn: message => warnings.push(message) }) } return md }
}
blogRequire(aetherPath)
const render = text => renderer({ text })

// The patched renderer must expose its instance exactly once.
await render('warm up')
await render('again')
assert.equal(hooked, 1, 'markdown-it:renderer runs once per renderer instance')

// Steps
let html = await render(':::steps{title="继续检查" start="4"}\n1. **确认**：查看页面。\n2. 发布更新\n:::')
assert.match(html, /<section class="md-steps" aria-label="继续检查"><header class="md-block-head"><strong>继续检查<\/strong><span>STEP BY STEP<\/span><\/header>/)
assert.match(html, /<ol class="md-steps-list" start="4" style="counter-reset: counter 3">/)
html = await render(':::steps[发布一篇博客]\n1. 创建文章\n   ```bash\n   hexo new post\n   ```\n2. 预览\n   - 检查图片\n:::')
assert.match(html, /aria-label="发布一篇博客"/)
assert.match(html, /<ol class="md-steps-list">/)
assert.match(html, /<li>创建文章<pre class="shiki[^"]*"[^>]*><code class="language-bash">/, 'step bodies keep their code blocks')
html = await render(':::steps\n只是一段介绍。\n:::')
assert.doesNotMatch(html, /md-steps/, 'invalid steps keep plain Markdown')
assert.match(html, /<p>只是一段介绍。<\/p>/)

// File tree: list form
html = await render([
  ':::file-tree{title="博客示例目录"}',
  '- source',
  '  - _posts',
  '    - **hello.md** # 重点关注的文章',
  '  - images/ # 点击展开这个目录',
  '    - cover.webp',
  '  - empty/',
  '- ++ markdown-extensions.styl # 新增样式',
  '- -- legacy.css',
  '- C#',
  ':::'
].join('\n'))
assert.match(html, /<figure class="md-file-tree" data-icon="colored"><figcaption class="md-block-head"><strong>博客示例目录<\/strong><span>FILE TREE<\/span><\/figcaption>/)
assert.match(html, /<li class="md-tree-folder"><details open><summary>.*?source/)
assert.match(html, /<li class="md-tree-folder"><details><summary>.*?images<\/span><span class="md-tree-note">点击展开这个目录<\/span>/, 'trailing slash folders start collapsed')
assert.match(html, /<li class="md-tree-folder is-empty">.*?empty/)
assert.match(html, /<strong>hello\.md<\/strong>/)
assert.match(html, /<li class="md-tree-file is-added" data-type="style">.*?<span class="md-tree-badge">新增<\/span>/)
assert.match(html, /<li class="md-tree-file is-removed" data-type="style">.*?删除/)
assert.match(html, /<span class="md-tree-name">C#<\/span>/, 'C# is a name, not a note')
assert.doesNotMatch(html, /<ul>\s*<li>source/, 'the body is not rendered as a list')

// File tree: text form, Unix and Windows glyphs
html = await render('```file-tree title="构建后的文件" icon="simple"\npublic\n├── css/\n│   └── app.css\n└── index.html\n```')
assert.match(html, /data-icon="simple"/)
assert.match(html, /<details open><summary>.*?public.*?<ul><li class="md-tree-folder"><details open><summary>.*?css.*?app\.css.*?<\/details><\/li><li class="md-tree-file" data-type="markup">.*?index\.html/)
assert.doesNotMatch(html, /shiki/, 'file-tree fences skip syntax highlighting')
html = await render('```file-tree\nroot\n+---js\n|   \\---app.js\n\\---index.html\n```')
assert.match(html, /js<\/span>.*?<ul><li class="md-tree-file" data-type="code">.*?app\.js/)

// Fields
html = await render([
  '::::field-group',
  ':::field title',
  '@type string',
  '@required',
  '',
  '文章的标题。',
  ':::',
  ':::field pageSize {type="number" optional default="12"}',
  '每次展开的 **记录** 数量。',
  ':::',
  '::::'
].join('\n'))
assert.match(html, /^<div class="md-field-group">/)
assert.match(html, /<code class="md-field-name">title<\/code><span class="md-field-type">string<\/span><span class="md-field-flag is-required">必填<\/span><\/header><div class="md-field-body">\s*<p>文章的标题。<\/p>/)
assert.match(html, /pageSize<\/code><span class="md-field-type">number<\/span><span class="md-field-flag">可选<\/span><\/header><p class="md-field-default"><span>默认值<\/span><code>12<\/code><\/p>/)
assert.match(html, /<strong>记录<\/strong>/)
assert.equal((html.match(/<section class="md-field">/g) || []).length, 2)

// Grid
html = await render(':::grid{columns="2" aspect="1/1" fit="contain"}\n![山丘](/a.svg "封面")\n\n![星球](/b.svg)\n:::')
assert.match(html, /<div class="md-grid" data-columns="2" data-fit="contain" style="--md-grid-aspect: 1 \/ 1">/)
assert.match(html, /<figure class="md-grid-item"><img src="\/a\.svg" alt="山丘" decoding="async"><figcaption>封面<\/figcaption><\/figure>/)
assert.match(html, /<img src="\/b\.svg" alt="星球" decoding="async"><figcaption>星球<\/figcaption>/)
assert.doesNotMatch(html, /<p>/)
html = await render(':::grid{columns="9" aspect="wide"}\n![a](/a.svg)\n![b](/b.svg)\n:::')
assert.match(html, /data-columns="3" data-fit="cover">/, 'invalid options fall back to CSS defaults')
assert.equal((html.match(/md-grid-item/g) || []).length, 2, 'images on adjacent lines are both cards')
html = await render(':::grid\n说明文字\n\n![a](/a.svg)\n:::')
assert.doesNotMatch(html, /md-grid/, 'mixed content stays as Markdown')
assert.match(html, /说明文字/)

// Footnotes and annotations
html = await render([
  '正文[^1]，再次[^1]；术语渐进增强[+渐进增强]，未定义[^x]。',
  '',
  '[^1]: 第一条脚注。',
  '[+渐进增强]: 先保证正文可用，',
  '    再添加交互。',
  '',
  '后续段落。'
].join('\n'))
assert.match(html, /<sup class="md-footnote-ref"><a href="#fn-1" id="fnref-1" data-note-ref="fn-1" role="doc-noteref">1<\/a><\/sup>，再次<sup class="md-footnote-ref"><a href="#fn-1" id="fnref-1-2"/)
assert.match(html, /<a class="md-annotation" href="#note-渐进增强" id="noteref-渐进增强" data-note-ref="note-渐进增强">渐进增强&#8288;<span class="md-annotation-mark" aria-hidden="true">\+<\/span><\/a>/)
assert.match(html, /未定义\[\^x\]/, 'undefined references stay literal')
assert.match(html, /<p>后续段落。<\/p>\s*<section class="md-notes is-annotation"/, 'definitions move to the end')
assert.match(html, /<li id="note-渐进增强" class="md-note-item"><strong class="md-note-term">渐进增强<\/strong><div class="md-note-body">\s*<p>先保证正文可用，<br \/>\s*再添加交互。<\/p>/)
assert.match(html, /<section class="md-notes is-footnote" role="doc-endnotes" aria-label="脚注" data-close-label="关闭说明"><p class="md-notes-title">脚注<\/p>/)
assert.match(html, /href="#fnref-1" aria-label="返回正文" title="返回正文">↩<sup>1<\/sup><\/a><a class="md-note-back" href="#fnref-1-2"/)
html = await render('[^lonely]: 没有被引用。\n\n正文。')
assert.doesNotMatch(html, /md-notes|没有被引用/, 'unreferenced definitions are dropped')

// GitHub card
html = await render('::github{repo="LyraVoid/Shirone"}')
assert.match(html, /^<article class="md-github" data-github-repo="LyraVoid\/Shirone" data-github-fetch>/)
assert.match(html, /<p class="md-github-name">Shirone<\/p>/)
assert.match(html, /href="https:\/\/github\.com\/LyraVoid\/Shirone"/)
assert.match(html, /data-github-stat="stars"/)
html = await render('::github{repo="mrdoob/three.js" description="三维 <b>库</b>" fetch="false"}')
assert.match(html, /data-github-static/)
assert.doesNotMatch(html, /data-github-fetch|md-github-stats/)
assert.match(html, /<a data-github-homepage target="_blank" rel="noopener noreferrer" hidden>/, 'homepage stays hidden until known')
assert.match(html, /三维 &lt;b&gt;库&lt;\/b&gt;/)
html = await render('::github{repo="a/b" homepage="https://b.example/?x=1&y=2"}')
assert.match(html, /<a data-github-homepage href="https:\/\/b\.example\/\?x=1&amp;y=2" target="_blank" rel="noopener noreferrer"><i class="ic i-link-alt"/)
html = await render('::github{repo="a/b" homepage="javascript:alert(1)"}')
assert.match(html, /<a data-github-homepage target="_blank" rel="noopener noreferrer" hidden>/, 'non-http homepages are ignored')
html = await render('::github{repo="https://github.com/a/b"}')
assert.doesNotMatch(html, /md-github/, 'full URLs are not repositories')

// Mermaid fences keep a Shiki-highlighted source for the source view and the browser.
html = await render('```mermaid\ngraph TD\n  A["<b>开始</b>"] --> B\n```')
assert.match(html, /^<figure class="md-mermaid" data-mermaid-kind="flowchart" data-error-label="图表语法有误，已显示源码" data-unavailable-label="图表渲染异常，已显示源码" data-diagram-label="查看图表">/)
assert.match(html, /<div class="md-mermaid-bar"><button type="button" class="md-mermaid-heading" data-mermaid-action="heading" title="全屏查看"><span class="md-mermaid-dots" aria-hidden="true"><\/span><span class="md-mermaid-type">Flowchart<\/span><\/button><div class="md-mermaid-tools"/)
assert.match(html, /data-mermaid-action="out"[^>]*><i class="ic i-minus"[^]*<output class="md-mermaid-zoom" aria-live="polite">100%<\/output><button[^>]*data-mermaid-action="in"[^>]*><i class="ic i-plus"[^]*data-mermaid-action="fit" title="恢复初始视角" aria-label="恢复初始视角"><i class="ic i-focus-center"[^]*<span class="md-mermaid-sep" aria-hidden="true"><\/span>/)
assert.match(html, /data-mermaid-action="source" title="查看源码" aria-label="查看源码"><i class="ic i-code"/)
assert.match(html, /data-mermaid-action="fullscreen" title="全屏查看" aria-label="全屏查看" data-exit-label="退出全屏"/)
assert.match(html, /<div class="md-mermaid-canvas" role="img" aria-label="Flowchart" tabindex="0">/)
assert.match(html, /<div class="md-mermaid-stage"><\/div><\/div><p class="md-mermaid-help"><span class="md-mermaid-help-desktop"><kbd>Ctrl<\/kbd> \/ <kbd class='is-symbol'>⌘<\/kbd> \+ 滚轮缩放 · 放大后可拖动平移<\/span>/)
assert.match(html, /<div class="md-mermaid-source"><pre class="shiki[^"]*"[^>]*><code class="language-mermaid">[\s\S]*<\/code><\/pre><\/div><\/figure>/)
assert.doesNotMatch(html, /<b>开始/, 'diagram source stays escaped')
html = await render('```mermaid title="写作 <流程>"\n---\ntitle: x\n---\n%% note\nsequenceDiagram\n  A->>B: hi\n```')
assert.match(html, /<span class="md-mermaid-type">Sequence<\/span><span class="md-mermaid-title">写作 &lt;流程&gt;<\/span><\/button>/)
assert.match(html, /role="img" aria-label="写作 &lt;流程&gt;"/)
assert.match(html, /data-mermaid-kind="sequence"/)
html = await render('```mermaid\nunknownDiagram\n```')
assert.match(html, /<span class="md-mermaid-type">Mermaid<\/span>/)
assert.match(html, /data-mermaid-kind="diagram"/)
html = await render('````markdown\n```mermaid\ngraph TD\n```\n````')
assert.doesNotMatch(html, /md-mermaid/, 'mermaid inside another fence stays code')

// Code trees: fences become files, highlighted by Shiki, with a nested nav.
html = await render(':::code-tree{title="按钮" height="360px" entry="src/main.js"}\n```html title="index.html"\n<button>hi</button>\n```\n\n```js title="src/main.js"\nconst a = 1\n```\n\n```css title="src/button.css" :active\n.a {}\n```\n:::')
assert.match(html, /^<figure class="md-code-tree" data-icon="colored" style="--md-code-tree-height: 360px">/)
assert.match(html, /<strong class="md-code-tree-title">按钮<\/strong><span class="md-code-tree-count">3 个文件<\/span>/)
assert.match(html, /<li class="md-tree-file" data-type="markup"><button type="button" class="md-code-tree-file" data-code-tree-file="0" title="index.html">/)
assert.match(html, /<li class="md-tree-folder"><details open><summary>.*?src<\/span><\/span><\/summary><ul><li class="md-tree-file" data-type="code"><button[^>]*data-code-tree-file="1" title="src\/main.js" aria-current="true">/)
assert.match(html, /data-code-tree-panel="1" data-active><div class="md-code-tree-path">src\/main.js<\/div><pre class="shiki/, 'entry wins over :active')
assert.equal((html.match(/<pre class="shiki/g) || []).length, 3)
assert.doesNotMatch(html, /title=&quot;|:active/)
html = await render(':::code-tree\n```json title="package.json"\n{}\n```\n```js title="main.js" :active\nx\n```\n```mermaid title="flow.mmd"\ngraph TD\n```\n:::')
assert.match(html, /<strong class="md-code-tree-title">示例工程<\/strong>/)
assert.doesNotMatch(html, /style="--md-code-tree-height/)
assert.match(html, /data-code-tree-panel="1" data-active>/, ':active picks the default file')
assert.doesNotMatch(html, /md-mermaid/, 'mermaid inside a code tree stays a file')
html = await render(':::code-tree{entry="missing.js" height="calc(1px)" icon="simple"}\n```js title="a.js"\n1\n```\n:::')
assert.match(html, /data-icon="simple"/)
assert.match(html, /data-code-tree-panel="0" data-active>/, 'an unknown entry falls back to the first file')
assert.doesNotMatch(html, /--md-code-tree-height/, 'invalid heights are ignored')

// Directory imports read examples/ at build time, in both syntaxes.
const imported = await render('::code-tree{dir="/examples/markdown-demo" title="公开的本地示例" entry="main.js"}')
assert.match(imported, /<span class="md-code-tree-count">3 个文件<\/span>/)
assert.match(imported, /title="main.js" aria-current="true">.*title="message.js">.*<summary>.*styles<\/span><\/span><\/summary>.*title="styles\/button.css">/)
assert.match(imported, /import \{ greeting \}|greeting/)
assert.equal(await render('@[code-tree title="公开的本地示例" entry="main.js"](/examples/markdown-demo)'), imported)
warnings.length = 0
for (const dir of ['/source/_posts', '/examples/../themes', '/examples/missing']) {
  html = await render(`::code-tree{dir="${dir}"}`)
  assert.match(html, /^<figure class="md-code-tree is-error"><p>无法导入代码示例目录：<code>/, dir)
}
assert.equal(warnings.length, 3)

// Built-in syntax is untouched, including nesting with a longer marker.
html = await render('::::info\n:::steps\n1. 一\n:::\n::::\n\n+++ 标题\n内容\n+++')
assert.match(html, /<div class="note info">\s*<section class="md-steps">/)
assert.match(html, /<details><summary>标题<\/summary>/)

// Directive text is escaped everywhere.
html = await render(':::file-tree{title="<img onerror=x>"}\n- <b>x</b> # <i>y</i>\n:::')
assert.doesNotMatch(html, /<img onerror|<b>x/)

console.log('markdown extensions: ok')
