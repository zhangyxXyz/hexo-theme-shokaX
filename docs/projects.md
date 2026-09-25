# 项目展示页

页面 front matter 使用 `layout: projects`，通过 `projects_data` 指定 `source/_data/` 下的 YAML 数据名，默认 `projects`。

数据包含 `eyebrow`、`heading`、`intro`、`footer`、`profile: { label, url }` 和 `items`。每个项目提供唯一 `id`、`name`、`category`、`icon`（现有图标名，不含 `i-`）、`description`、`tags` 和 `links: [{ label, url }]`。所有文案由站点数据提供。

可选 `preview` 支持 `blog`、`comments`、`widget` 界面示意，以及 `image` 真实截图，`label` 提供无障碍说明。评论示意的头像默认复用 `sidebar.avatar`，可用 `preview.avatar` 覆盖。预览不是可操作的评论框。省略预览时卡片为单列。桌面图文并排，窄屏上下排列，配色沿用主题变量。

`image` 提供 `light` 图片路径，可选 `dark` 路径随站点 `data-theme` 切换；`width` / `height` 预留图像比例，深色尺寸不同时用 `dark_width` / `dark_height`。截图完整等比显示并裁出圆角，不套示意窗口。本站 Scriptable 图片来自项目 `docs/assets/playground-light.png` 与 `playground-dark.png`，存于博客 `source/images/projects/`；后者实际为 JPEG，按 `.jpg` 保存。

源码、上游及个人主页入口使用主题评论入口同款圆角描边按钮，默认文字和 GitHub 图标为中性色，悬停及聚焦时文字、边框转为主题粉色；图标在暗色模式下保持可见。

Markdown 正文在标题和简介之后、具体项目之前直接展示，`activity_label` 仅用作区块的无障碍名称，不显示标题行；正文或标签缺失时不渲染。页面不采用文章版权、日期、奖励和评论区布局。无需额外客户端脚本，支持 PJAX。
