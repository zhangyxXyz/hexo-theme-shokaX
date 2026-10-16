# UI 样式复用约定

颜色继续由 `source/css/_colors.styl` 管理，字号、布局和控件规格在 `_variables.styl`，可复用声明在 `_mixins.styl`。组件样式仍放入现有 Stylus 分层，不通过大段内联样式或新的 UI 框架覆盖主题。

## 颜色与表面

- 普通操作的强调色使用 `--primary-color`；轻背景使用 `--accent-soft`，轻边框使用 `--accent-border`。后两者从当前强调色派生，避免文字换色而交互底色仍固定为粉色。
- 正文、弱文本、普通表面继续复用 `--text-color`、`--grey-*`、`--body-bg-shadow`。
- 普通提示、文章摘要预览、模型下拉共享 `--tooltip-bg`、`--tooltip-text`、`--tooltip-border`、`--tooltip-shadow`。尺寸与定位由组件决定。
- 普通对话框遮罩使用 `--overlay-backdrop`，外框使用 `$dialog-radius`，窄屏使用 `$dialog-radius-compact`，阴影使用 `$dialog-shadow`。
- 信息语义的蓝色轻背景与边框使用 `--color-blue-a1`、`--color-blue-a3`。状态色、图表分类色、评论等级、支付品牌、插画与材质配色不替换成主色。

站点通常通过 `source/_data/custom.styl` 覆盖少量变量即可。现有 `source/_data/colors.styl` 入口会替换完整主题色表，不能将其当作局部追加文件使用。

### 站点默认与访客配色

站点默认在主题配置 `palette.primary` / `palette.secondary` 声明；阅读偏好按“访客颜色 → 站点默认 → 原色表”取值，共用 `--reading-primary-{seed,ink-light,ink-dark,fill}` 与对应 `secondary` 变量。有效站点默认标记 `html[data-reading-palette='theme']`，访客覆盖标记 `custom`；统一皮肤通过 `[data-reading-palette]` 生效。访客与站点均未设置的一侧删除整组变量，两侧均无有效颜色时移除属性。默认颜色不写入访客存储，恢复配色重新继承配置。样式通过角色 token 消费它们，不能全局覆盖 `--color-red`、`--color-pink` 或 `--color-orange`。

| 角色 | 用途与默认行为 |
| --- | --- |
| `--theme-primary-seed` / `--theme-secondary-seed` | 站点默认种子，未配置时回退原色表；不随亮暗和访客配色改变 |
| `--accent-primary-seed` / `--accent-secondary-seed` | 当前原始种子，用于色块与数据展示 |
| `--primary-color` / `--accent-color` | 可读的普通强调文字；未定制时分别沿用原红色与粉色 |
| `--accent-secondary-color` | 随明暗适配的辅助强调文字；未定制时沿用原橙色 |
| `--accent-heading` | 页面一级标题的装饰图标；未定制时保留原浅粉色 |
| `--accent-hover` / `--accent-nav` | 链接悬停与导航选中；未定制时保留原蓝色与青色 |
| `--accent-start` / `--accent-end` | 原始装饰渐变，默认仍是原粉色／橙色；不能据此假定白字可读 |
| `--accent-fill` / `--accent-fill-start` / `--accent-fill-end` | 实心操作、带文字渐变的填充；定制时两端均使用可读派生值 |
| `--accent-on-fill` | 填充上的文字，默认继承原 `--grey-0`，定制时为白色 |
| `--accent-wash` / `--accent-line` | 旧普通 UI 的轻底／细线，默认保留固定红色透明值；定制时复用 `--accent-soft` / `--accent-border` |
| `--accent-decoration-soft` / `--accent-decoration-border` | 原粉色轻底与阴影，定制时从装饰种子派生 |
| `--accent-tint` / `--accent-tint-soft` | 浅色装饰表面，默认保留原浅粉色 |
| `--author-badge-text` / `--author-badge-background` / `--author-badge-border` | 仅定制时启用，正文评论、页脚和统计评论列表共享的作者身份徽章配色 |

未配置站点配色时，原有红色文字、粉色起点与橙色终点仍是三个不同角色。访客仅设置一侧时，另一侧继承站点配置；站点也未配置时，填充使用色表内安全回退值。这些值由与偏好模型一致的对比算法计算，不写回用户偏好。派生文字按浅色 `#f7f7f7`、深色 `#363636` 中性表面校验，填充按白字校验；叠加透明背景、图片或其他表面仍须结合实际组件检查。

普通导航、操作按钮、分页、首页入口、工具栏、滚动条、搜索、评论操作和页面加载器已接入这些角色。作者徽章在定制时以主色为基准统一；仅识别真实管理员标记，不根据昵称判断。错误／警告／审核状态、小伙伴与评论等级、私密标签、支付品牌、图表分类、文章显式颜色类以及插画仍使用各自颜色。看板娘工具栏继续透明底，仅当前按钮的 hover/focus 产生交互状态。

统计页和留言页的连续数量色阶、单序列柱图与趋势线在站点或访客定制时接入主辅色，分类系列继续保持区分。Canvas 图表需要将 CSS 颜色解析为实际 RGB 并订阅配色更新；普通 DOM/SVG 直接消费变量。标签云在定制时覆盖主题 `tagcloud` 渐变，文字使用可读端点的线性光混色；清除访客配色后继承站点主辅色，站点也未配置时回到 `tagcloud` 配置。

## 控件组合

普通带边框操作按钮：

```stylus
.example-action {
  control-base();
  control-raised();
  control-focus();
  &:hover { border-color: var(--accent-border); }
}
```

图标操作按钮：

```stylus
.example-close {
  control-icon();
  control-raised();
  control-focus(2px);
  &:hover { background: var(--accent-soft); }
}
```

这些方法分别管理布局、表面和焦点，避免幽灵按钮、工具栏按钮被强行加上持久底色：

| 接口 | 默认行为 |
| --- | --- |
| `control-base(height = $control-height)` | 36px 最小高度、flex 居中、公共字号、间距和内边距 |
| `control-raised(radius = $control-radius, border-width = $control-border-width)` | 原有 3px 轻边框、主题表面、强调色和柔和阴影 |
| `control-icon(size = $control-height)` | 正方形命中区、grid 居中；不添加表面或边框 |
| `control-focus(offset = $control-focus-offset, color = var(--primary-color))` | 仅 `:focus-visible` 显示 2px 焦点轮廓 |
| `loading-spinner(size = 1.75rem)` | 评论与资讯共用的转圈外观，使用 `theme-loading-spin` |

紧凑操作可使用 `$control-height-compact`（32px）、`$control-radius-compact`；触控界面使用 `$control-height-touch`（44px）。这不是统一所有按钮形状：正文链接、胶囊分页、分段选择与插画内控件保留各自角色。

加载器仅复用外观，组件自己负责请求、禁用状态、文案与 `aria-busy`。工具栏继续由每个按钮独立响应 hover；不要给父容器统一悬停状态，也不要把“看板娘已显示”渲染成持续 hover。

## 减少动态效果

组件的静态替代状态放入 `+reduced-motion()` block mixin，同时响应系统的 `prefers-reduced-motion: reduce` 和阅读设置的 `html[data-motion='reduce']`。两种来源共用同一组局部声明，不增加全局 `* { animation: none }`。该方法支持在组件内部或文件根级调用：

```stylus
.example-decoration {
  +reduced-motion() {
    animation: none;
    transition: none;
  }
}
```

显式启用移动效果的 `no-preference` 规则还应排除 `html[data-motion='reduce']`；普通控件已有 `interaction-lift()` 负责此条件。脚本动画由公共动效偏好模块处理，CSS mixin 不替代动画帧、定时器和第三方实例的清理。

## 编译与验证

Stylus 会提前计算裸 `min()`。需要浏览器按百分比、视口单位计算时，使用 `unquote('min(...)')`，或使用等价的 `width` / `max-width`。验证时核对生成 CSS，不能仅看源码字面值。

修改公共样式后，检查亮暗、鼠标与键盘、桌面与窄屏、评论弹层和 PJAX 往返。从博客根目录构建，不运行主题源码目录的 `pnpm build`。
