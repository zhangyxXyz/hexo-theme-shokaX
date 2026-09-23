# 阅读工具

`live2d.enable: true` 恢复旧 Shoka 左下角看板娘，右侧浮动工具栏的爪印按钮控制显示和隐藏。默认仅桌面展开，手机可以主动打开；选择保存在 `shokax.live2d.visible`。旧看板娘关闭按钮也同步此状态。

`source/live2d-widget/` 复用本站旧 Shoka 中的 Live2D Widget 资源，来源为 https://github.com/stevenjoezhang/live2d-widget 。模型由 `live2d.cdn` 指定的模型源按需加载，保留换角色、换装、截图等旧功能。组件在页面刷新时只初始化一次，隐藏后再打开不会叠加实例。模型源不可用时模型本身可能加载失败。

`article_script.enable: true` 在有文章正文的页面显示“繁”按钮。点击按需加载 OpenCC JS 1.4.1，将正文文字转换为繁体，再点击“简”恢复保存的原文。不会重写 HTML、链接地址或标题锚点，也不会修改源文章。代码、公式、输入控件及 `translate="no"` 区域跳过；异步正文更新继续转换，离页清理观察器和原文缓存。

切换按钮文案来自主题语言文件。简繁转换使用 https://github.com/nk2028/opencc-js 的 `cn → tw` 规则，仅改变显示，不影响搜索索引。
