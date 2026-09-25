# 明暗切换效果

在站点 `_config.shokax.yml` 配置：

```yaml
theme_transition: sunrise
```

| 值 | 名称 | 效果 |
| --- | --- | --- |
| `sunrise` | 日升日落（默认） | 原有猫咪、渐变天空与日月旋转，约 3.1 秒 |
| `moon-stars` | 月夜星辉 | 从按钮中心展开天空，月亮／太阳与星光出现后淡出，约 1.1 秒 |

缺省或未知值回退 `sunrise`。此配置只选择手动切换动画，不改变 `darkmode`、`auto_dark` 的含义。系统与初始化颜色更新不播放动画。访客启用“减少动态效果”时直接切换；播放中启用则完成颜色更新并立即清理。

月夜星辉的视觉参考：[Lavender's Blog](https://blog.lavender816.top/resources/)。在本站重新组织为 TypeScript 策略与 Stylus，使用 ShokaX 柔粉配色，无远程脚本、图片或新增依赖。

## 扩展策略

统一按钮入口是 `source/js/_app/globals/themeColor.ts` 的 `initThemeToggle()`；`library/vue.ts` 只保留原初始化接口。具体策略位于 `components/theme-transition/`。

1. 新建实现 `ThemeEffect` 的策略模块，并在 `index.ts` 注册配置名。
2. 通过 `mount()` 挂载装饰层；需要等待视觉完成时使用托管的 `animate()` 完成回调，完全覆盖页面时调用 `commit()`，必要时通过 `afterPaint()` 等待一次受遮罩保护的绘制，然后淡出并调用 `finish()`。`after()` 仅用于不依赖画面完成的延时。
3. 样式放在 `source/css/_common/components/third-party/theme-transition/` 并从 `theme.styl` 导入，补充配置注释与文档。

策略不直接操作主题属性、localStorage 或按钮监听，也不自行创建未托管的计时器。runner 统一保证只提交一次、拦截连续点击、异常降级与移除节点／计时器／动画／动画帧。PJAX 开始和离页时完成本次选择并清理；外部系统颜色更新则取消旧动画，避免延迟回调覆盖最新状态。全局按钮只绑定一次，支持鼠标、Enter 和空格。

月夜星辉使用 `150vmax` 展开范围，让减速尾段发生在遮罩已覆盖屏幕之后。切色由展开动画的实际完成驱动，保留完整覆盖并等待一次绘制后才淡出；淡出完成后移除遮罩，不用固定计时器抢先结束。回归测试模拟动画滞后于时钟、提交后等待绘制和淡出中断，避免大屏／繁忙页面提前露出旧颜色。

验证：`node toolbox/test-theme-transition.mjs`，以及主题类型检查、博客安全构建和浏览器双向切换。
