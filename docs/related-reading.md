# 继续阅读与全站文章预览

`related_reading.enable` 默认开启，文章可设 `related_reading: false`，同时退出推荐候选和本页推荐展示。

构建阶段在正文、摘要缓存及加密处理完成后，读取与搜索同源的公开文章标题、章节、正文、默认 AI 摘要、标签和分类。采用分字段 TF-IDF 余弦相似度，内容、标签、分类权重为 70%、20%、10%，正文相似度最低 0.12，最多推荐 4 篇。词项相关性不是深层语义推理；不使用在线 AI 请求。当前文章和真实入链、出链均去重，没有匹配时不输出推荐列表。草稿、隐藏、未来、加密及 `graph_index: false` 的文章不进入候选或公共预览库。

“继续阅读”位于文章关联／引用列表之后、版权与评论之前，使用一个外框收纳相关推荐与上一篇／下一篇。推荐在上方，桌面两列、手机单列，复用归档和引用列表的紧凑条目与 `articlePreview` mixin；摘要按钮保留触屏操作。下方导航保留原图片背景（或配置的渐变背景）、分类标记及悬停摘要；分类使用 i-category，上一篇／下一篇使用 i-chevron-left / i-chevron-right，随机补位使用 i-shuffle，缩为最小 120px 高，长标题自然增高，淡分隔线区分两类入口。普通页面不输出文章导航。区域不进入 Pagefind 索引。

导航在每次模板渲染时只选择一次，沿用上一篇／下一篇及端点随机补位，候选限公开文章；推荐从完整相关性排序中排除这两个实际目的地后取前 4 篇，因此可以递补且不会重复，也不会为凑数加入低相关内容。没有推荐或关闭推荐时仍保留图片导航，不显示相关性说明。

全站公开文章链接（正文、上一篇／下一篇、页脚、动态插入的图节点等）复用同一 `article-preview` 控制器、同一摘要 mixin 和模型切换逻辑。默认 AI 摘要，无 AI 时由 `article_preview` 回退到 description、excerpt、正文提取；已有模型偏好继续有效。列表原有预览优先，不重复弹出两套提示。

所有摘要预览共用通用 tooltip 的 `--tooltip-bg/text/border/shadow` 明暗主题变量，使用半透明底色、12px 毛玻璃与 125% 饱和度，细边框、轻内高光和柔和投影。摘要字号、宽度策略与交互保持独立，正文优先保证可读性。

公共组件统一命名为 `article-preview.ts/styl`，初始化为 `refreshArticlePreviews`，共用条目类为 `article-preview-row/link`；仅带日期的归档列表模板使用 `archive-post-list.pug`。首次悬停等待 250ms，条目之间立即交接并用 100ms 淡入。移到空白立即开始 160ms 淡出，中途返回取消关闭计时，由 CSS 从当前透明度反向恢复，不重新从零播放；淡出后 500ms 内跨空白进入其他条目仍立即展示。鼠标移动按动画帧合并定位；进入浮层或模型菜单时暂停跟随，保留交互。减少动态效果时取消透明度过渡。

模板输出小型公开路径清单，首次悬停文章链接时才加载 `article-previews.html`，缓存到当前浏览器会话。该资源只有经过转义的短摘要和模型选项，没有整篇正文，不依赖 Pagefind 包。本地与 CDN 部署均由正常站点构建产出，无需新增 vendor。资源失败时不拦截文章跳转。

外部链接、下载、同页锚点、当前文章链接、代码和目录不触发文章预览。只有已知公开文章路径可以命中；`data-no-article-preview` 可在容器上禁用。鼠标／键盘焦点支持预览，手机普通链接保留直接导航，不以第一次点击拦截阅读。桌面浮层根据可见摘要长度在 360–760px 之间自适应，并按视口宽度限制上限（常规桌面约 55%），较长摘要优先展开宽度以减少折行，同时受视口高度限制，贴近悬停位置自动避让边缘；列表与普通链接共用定位。AI 摘要最多 600 字符、普通摘要最多 320 字符，避免旧版 140 字过早截断；手机仍行内展开。浮层可切模型、选原文摘要；离开、滚动、Escape、PJAX 导航时收起。

源码入口：`scripts/utils/related-reading.ts`、`scripts/filters/related-reading.ts`、`layout/_partials/post/related-reading.pug`、`layout/article-previews.pug`、`source/js/_app/components/article-preview-links.ts`、`article-preview.ts`。样式在 `post/related-reading.styl` 和公共 `article-preview.styl`。

验证：`node toolbox/test-related-reading.mjs`、`node toolbox/test-tag-detail.mjs`、`node toolbox/test-article-graph.mjs`、主题类型检查和站点构建；真实页面检查双列、列表摘要、导航预览及模型切换。未进行生产部署。
