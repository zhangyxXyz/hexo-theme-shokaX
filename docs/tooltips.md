# 主题悬停提示

`components/tooltip.ts` 接管页面的 HTML `title` 提示，使用纯文本和统一浮层；浏览器原生提示无法直接设置 CSS。动态插入元素及更新后的 title 均可识别，无 JavaScript 时保留原生行为。`data-native-tooltip` 可保留某个区域的原生提示；已有目录浮层和第三方评论区域不重复接管。

鼠标悬停延迟 180ms 显示并跟随鼠标，默认偏移 12px；右侧或底部空间不足时翻转，过长提示限制在视口两侧 12px 留白内。键盘焦点立即显示并以控件定位。Esc、点击、滚动和失焦关闭；PJAX 重入清理监听、观察器和浮层，恢复 title。图标入口保留可访问名称，浮层通过 aria-describedby 关联。

全局样式从 `source/css/scaffolding.styl` 引入 `components/tooltip.styl`，通过 `--tooltip-bg`、`--tooltip-text`、`--tooltip-border`、`--tooltip-shadow` 定制深浅主题。目录和 ECharts 采用相同的半透明毛玻璃配色；ECharts 使用 HTML 提示以支持 backdrop-filter，`statistics/tooltip-content.ts` 统一转义所有动态文本。日期图表显示日期和计数，零值不作为缺失数据。

HTML 提示框最大宽度：桌面 36rem，991px 以下 28rem，主题 mobile() 断点以下 20rem；始终不超过视口宽度减 24px，border-box 将边框和内边距计入宽度。短文案按内容收缩，长文案自动换行。触屏不模拟鼠标悬停，键盘聚焦仍可显示。
