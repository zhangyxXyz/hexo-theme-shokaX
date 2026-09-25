# 主题悬停提示

`components/tooltip.ts` 接管页面的 HTML `title` 提示，使用文字、受限图标标记和统一浮层；浏览器原生提示无法直接设置 CSS。动态插入元素及更新后的 title 均可识别，无 JavaScript 时保留原生行为。`data-native-tooltip` 可保留某个区域的原生提示；已有目录浮层和第三方评论区域不重复接管。

鼠标悬停延迟 180ms 显示并跟随鼠标，默认偏移 12px；右侧或底部空间不足时翻转，过长提示限制在视口两侧 12px 留白内。键盘焦点立即显示并以控件定位。Esc、点击、滚动和失焦关闭；PJAX 重入清理监听、观察器和浮层，恢复 title。图标入口保留可访问名称，浮层通过 aria-describedby 关联。

全局样式从 `source/css/scaffolding.styl` 引入 `components/tooltip.styl`，通过 `--tooltip-bg`、`--tooltip-text`、`--tooltip-border`、`--tooltip-shadow` 定制深浅主题。目录和 ECharts 采用相同的半透明毛玻璃配色；ECharts 使用 HTML 提示以支持 backdrop-filter，`statistics/tooltip-content.ts` 统一转义所有动态文本。日期图表显示日期和计数，零值不作为缺失数据。

HTML 提示框最大宽度：桌面 36rem，991px 以下 28rem，主题 mobile() 断点以下 20rem；始终不超过视口宽度减 24px，border-box 将边框和内边距计入宽度。短文案按内容收缩，长文案自动换行。触屏不模拟鼠标悬停，键盘聚焦仍可显示。

## 行内 iconfont

提示文案（HTML `title` 或语言文件）支持 `{icon:i-desktop-lyrics-on}`，渲染为对应 iconfont 图标。
图标使用 `1.3em`（补偿字体图标自身留白），跟随文字大小，默认 `var(--color-pink)`；可用 `{icon:i-audio-visualizer|#8fcfc8}` 单独配色。
图标基线统一读取站点 `source/_data/icon_baselines.json`，不在提示组件中单独设置偏移；配置方法见 [图标统一基线](icon-baselines.md)。
颜色接受 `#RGB` / `#RRGGBB`，class 使用已有的 `i-...` 图标名；须在站点 iconfont 中已定义。
例如桌面歌词的 `music.lyrics_close` 文案：

```yaml
lyrics_close: "收起桌面歌词，可通过播放器的 {icon:i-desktop-lyrics-on} 按钮再次开启"
```

图标旁保留说明文字，自动生成的可访问名称移除标记，仅保留文字；图标本身不重复朗读。
其他内容按文本显示，不支持任意 HTML。无效图标标记原样保留；同一提示内容不会重复更新 DOM，避免触发观察器循环。
