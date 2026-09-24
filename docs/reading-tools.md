# 阅读工具

`live2d.enable: true` 恢复旧 Shoka 左下角看板娘，右侧浮动工具栏的爪印按钮控制显示和隐藏。默认仅桌面展开，手机可以主动打开；选择保存在 `shokax.live2d.visible`。旧看板娘关闭按钮也同步此状态。

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
支持 Popover 的浏览器将这个不可交互的气泡放入顶层，评论等模态弹窗中也能看到；旧浏览器保留普通页面提示，在模态弹窗内暂停。
切页、隐藏看板娘、关闭弹窗、离开页面会清除提示；没有逐帧轮询或新增全页 MutationObserver。

`article_script.enable: true` 在有文章正文的页面显示“繁”按钮。点击按需加载 OpenCC JS 1.4.1，将正文文字转换为繁体，再点击“简”恢复保存的原文。不会重写 HTML、链接地址或标题锚点，也不会修改源文章。代码、公式、输入控件及 `translate="no"` 区域跳过；异步正文更新继续转换，离页清理观察器和原文缓存。

切换按钮文案来自主题语言文件。简繁转换使用 https://github.com/nk2028/opencc-js 的 `cn → tw` 规则，仅改变显示，不影响搜索索引。
