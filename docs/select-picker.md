# 通用下拉选择器

`source/js/_app/components/select-picker.ts` 的 `enhanceSelect(select, options)` 将原生单选 `select` 渐进增强为主题菜单。原生控件继续保存值；用户选择触发冒泡 `change`，已有业务监听不需要迁移。重复初始化返回同一实例。

- `variant`：菜单上的 `data-picker`，用于业务样式覆盖。
- `showArrow`：是否显示展开箭头，默认显示。
- `renderTrigger(option, label, icon)`：仅定制触发器的文案和图标。
- `signal`：可选生命周期信号；取消时关闭菜单、移除触发器并恢复原生控件。
- 返回 `sync()` 与 `destroy()`；程序更新值后应发出 `change` 或调用 `sync()`。

选项支持原生 `disabled`、`data-icon` 和 `data-tooltip`。菜单复用方向键、Home/End、Escape、Tab、外部点击、视窗边界定位；全局只打开一个。滚动、缩放及 PJAX 跳转关闭浮层。

公共样式位于 `_common/components/select-picker.styl`。`summary-picker.ts` 仅适配文章 AI 摘要和首页摘要的特殊文案、图标；统计排行直接调用公共组件，不使用 `data-summary-select`，避免触发摘要业务监听。

验证：`node toolbox/test-select-picker.cjs`，并检查首页摘要、文章摘要及统计页 TOP 选择的实际交互。
