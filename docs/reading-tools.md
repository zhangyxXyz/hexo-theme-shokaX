# 阅读工具

`live2d.enable: true` 开启看板娘，每次打开或刷新页面默认显示，浮动工具栏的爪印按钮控制显示和隐藏。隐藏状态仅在当前页面会话（包括 PJAX 切页）内保留，不再读取或保存 `shokax.live2d.visible`。

看板娘及其功能按钮跟随浮动工具栏的位置：`sidebar.position: right` 时靠左，`left` 时靠右；窄屏与工具栏一起靠右。功能按钮在模型靠近主工具栏的一侧呈紧凑浅弧排列，默认隐藏，鼠标移到看板娘或爪印、聚焦功能按钮时淡入，移开后淡出；随看板娘一起收起和恢复。

Live2D 核心和基础样式通过 `vendors.assets.live2d_widget` 加载，来源为 https://github.com/stevenjoezhang/live2d-widget 。模型由 `vendors.assets.live2d_models`（缺省回退 `live2d.cdn`）按需加载，保留换角色、换装、截图等旧功能。组件在页面刷新时只初始化一次，隐藏后再打开不会叠加实例。模型源不可用时模型本身可能加载失败。

## 提示规则

编辑主题源码 `source/live2d/waifu-tips.json`，构建后对应站点 `/live2d/waifu-tips.json`（自动包含站点 root）。
本站规则独立于 vendor 资源；不要修改资源镜像的 `waifu-tips.json`，避免同步上游时丢失适配。

- `interactions.mouseover`：悬停与键盘聚焦提示，规则按顺序匹配，具体规则应放在通用规则前。
- `interactions.click`：实际点击提示；不把点击提交、复制或付款当作操作成功。
- 每条 `selector` 为 CSS 选择器，`text` 可以是一句话或随机选择的句子数组。
- 可选 `nameSelector` 从命中控件内部取名称，`nameAttribute` 从对应节点的属性取值；`{text}` 插入名称。动态文字按纯文本处理，仅配置中的 `<span>` 用于强调。
- `<span>关键词</span>` 默认使用主题粉色；单条规则可用 `color: "#ed6ea0"` 覆盖强调色，支持 `#RGB` / `#RRGGBB`。没有设置或色码无效时回退主题色，不接受任意内联样式。
- `time`、`seasons`、`message` 保留时段、节日和空闲问候；顶层 `mouseover`、`click` 留空，避免上游和主题重复处理。
- `calendar`：节气与法定假日、调休提示，见下节。

### 节气与调休

上游 `seasons` 只认固定月日，放进空闲消息池；每年变动的节气和调休由 `reading-tools/live2d-calendar.ts` 处理。
看板娘初始化约 8 秒后（让过上游欢迎语）说一句，同一标签页会话、同一天只说一次。按以下顺序取第一条命中的：

1. 今天是调休上班日：`holiday.workday`。
2. 今天放假：假期首日 `first`、中间 `day`、最后一天 `last`。
3. 明天调休上班 `workdayEve`，明天开始放假 `eve`。
4. 今天是节气 `solarTerms.<key>.text`，明天是节气 `solarTermEve`。
5. `upcomingDays`（默认 7，最多 30）天内有假期开始：`upcoming`，`{days}` 为相隔天数。

`{text}` 为假日名或节气名 `solarTerms.<key>.name`；`timezone` 默认 `Asia/Shanghai`，决定“今天”从何时开始。
节气日期复用 `festival/solar-terms.ts` 的香港天文台 2020–2050 年表，离线可用，超出年份不提示。

法定假日与调休来自 `vendors.assets.holiday_cn`，默认是 [NateScarlet/holiday-cn](https://github.com/NateScarlet/holiday-cn) 按国务院办公厅通知整理的 `{year}.json`（MIT）。
十二月同时读取次年数据。结果缓存在 `localStorage` 的 `shokax.holiday-cn.{year}`：有数据 3 天、空年份（通知尚未发布）6 小时后重新请求；请求失败沿用旧缓存，没有缓存则只跳过假日提示。设为 `null` 关闭假日提示。

运行 `node toolbox/test-live2d-calendar.mjs` 验证假期首尾、调休、节气同日优先级、时区跨日和年末取数。

例如，页脚的技术方案和主题链接各有独立提示：

```json
{
  "selector": ".powered-by a[href^='https://hexo.io']",
  "text": "本站使用 <span>Hexo</span> 生成博客页面，是主人的博客技术方案哦～",
  "color": "#ed6ea0"
}
```

音乐使用 `#playBtn`、`#showBtn` 和 `data-music-action` 等状态标记，赞赏使用 `.reward > button`、`data-reward-method`；
支付方式由配置键识别，不依赖二维码图片文件名。代码按钮使用 `data-code-action`，放大图片使用 Viewer 实际接管的 `img.shokax-image-viewer`。
标签继续优先使用 `data-waifu-tag-message`，保留独立名称和文章数量。

`reading-tools/live2d-tips.ts` 使用一次事件委托和 `closest()`，图标/文字等子节点均可触发，异步评论与 PJAX 新节点不需要重新绑定。
主题提示和一言共用一个退出计时器；提示显示时暂时隐藏上游气泡，避免上游计时器提前消除当前提示。
普通提示使用相对看板娘的绝对定位，悬停/移开时保持同一定位参照；看板娘的悬停样式不再引入 transform，避免提示跳到视口顶部。仅在评论等模态弹窗打开时，支持 Popover 的浏览器将这个不可交互的气泡放入顶层并使用视口坐标；旧浏览器保留普通页面提示，在模态弹窗内暂停。
切页、隐藏看板娘、关闭弹窗、离开页面会清除提示；没有逐帧轮询或新增全页 MutationObserver。

`article_script.enable: true` 在首页、文章及其他主内容页面显示简繁图标按钮（`i-chinese-traditional` / `i-chinese-simplified`），共用 `.ic` 基线配置。点击按需加载 OpenCC JS 1.4.1，转换整个页面：正文、菜单、侧栏、页脚、按钮文字、`document.title`，以及 `title`、`aria-label`、`placeholder`、`alt`、`data-theme-tooltip` 属性；再点击“简”恢复保存的原文。选择保存在 `localStorage` 的 `shokax.article-script`，刷新和 PJAX 切页后继续生效；不修改 `lang`。不会重写 HTML、链接地址或标题锚点，也不会修改源文章。代码、公式、输入控件、未解密的加密文章及 `translate="no"` / `.notranslate` 区域跳过；异步内容和 PJAX 换入的节点由同一个观察器继续转换。

切换按钮文案来自主题语言文件。简繁转换使用 https://github.com/nk2028/opencc-js 的 `cn → tw` 规则，仅改变显示，不影响搜索索引。

看板娘的六个圆形工具沿角色外侧呈浅圆弧排列，横向弯曲幅度 1.25rem、纵向间距 2.25rem，随左右位置镜像，无菜单底板或重复关闭按钮；显示／隐藏使用主工具栏爪印。悬停爪印或角色、键盘聚焦工具时展开。取消上游从屏幕外滑入的 bottom 动画，避免入场期间气泡按移动中的锚点定位后上浮。上游工具保留原有点击监听、Enter/Space 操作及 `reading_tools.actions` 中的本地化提示。

一言按钮悬停／聚焦即请求内容，点击换一句；重复悬停复用上一句，不反复请求。与文章顶部共用 `fetchHitokoto` 的服务端点和“正文 —— 作者「出处」”格式，替代原先的预告对白。请求期间有加载提示，刷新失败时恢复上一条成功结果；首次获取失败才显示错误提示。切页或隐藏角色时取消旧请求。
