# 评论与主题 Markdown 显示

留言页的评论详情弹窗同样使用 `.md`、`createCommentMarkdown` 和代码工具栏。评论专用的表情、行内代码、引用与表格规则统一在 `source/css/_common/components/comment-content.styl`，由 Waline 和弹窗共同调用。弹窗过滤 HTML 时仅保留已知的旧版表情标记（`emoji` / `vemoji` / `wl-emoji`）和代码语言类名，其余属性仍按白名单处理。普通图片保留弹窗最大尺寸约束，表情按正文的 1.3em 行内显示。

评论正文继续使用 Waline 服务端过滤后的 HTML，预览保留 Waline 原生解析。没有执行 Hexo 构建期渲染器或模板标签，也不重新解析评论原始 HTML。

显示层复用主题 `.md` 排版、Aether 同版本 Shiki 3.23.0 与当前默认 Vitesse 亮暗主题，以及文章的 `enhanceCodeBlocks` 代码组件，提供语言标题、行号、复制、换行、长代码折叠和全屏。全屏支持从评论弹窗中打开，再返回原评论。

语法高亮在遇到代码块时才加载，引擎和语言包由本站托管。当前包含 JavaScript、TypeScript、HTML、CSS、JSON、YAML、Bash、C++、Python、Markdown、Diff、SQL、Lua、Java、C#、Vue、ShellScript；未标注、不支持的语言或超过 100000 字符的代码使用纯文本样式。以后更改文章的 Aether 高亮主题时，需同步评论高亮模块中的主题。

只将 `code.textContent` 交给 Shiki，代码里的 HTML 不执行。异步预览更新和分页后按需增强，销毁评论时清理工具栏监听与全屏弹窗。验证命令：`node toolbox/test-comment-highlight.mjs`。
