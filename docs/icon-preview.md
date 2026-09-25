# 图标预览页

页面 front matter 设置 `type: icon-preview`。`icon_preview_data` helper 在构建时读取配置的自定义 `iconfont.styl`，缺省读取主题图标表，提取实际类名和 Unicode 编码。图标直接使用当前主题字体，无独立字体下载或手工维护清单。

`icon_preview` front matter 可设置 `search/class/html/code/copied/failed/empty` 文案。页面支持名称或编码搜索；卡片图标、名称、编码分别是独立按钮，对应复制 HTML、类名、编码，无全局格式下拉框。复制反馈在卡片上方短暂显示，不替换搜索计数；PJAX 重新进入时清理旧事件监听与反馈定时器。本站入口为 `/icons/`。

彩色图标使用站点 `source/_data/icon_colors.json` 中按 Unicode 编码存储的原始 SVG。仅在数据中的 `font` 与主题配置一致时启用，避免字体更新后错配。本站运行 `node toolbox/sync-color-icons.mjs` 从当前 iconfont 项目的 CSS/SVG 同步多色几何，保留原始填色；不执行远程 JS。预览页的彩色图标点击复制 SVG HTML，类名与编码复制保持不变；普通图标仍复制 `<i>`。此机制仅用于预览页，不改变其他页面的字体渲染。

每张卡片底部使用普通行内排版展示文字、实际 .ic 字体图标、文字，共用 icon_baselines.json 的偏移；不使用 flex 居中或彩色 SVG 替代混排样本。前后文字通过 icon_preview.baseline_before / baseline_after 配置。上方大图标继续保留彩色 SVG 预览。
