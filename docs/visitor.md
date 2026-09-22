# 阅读次数与访客数

```yaml
visitor:
  enable: true
  type: busuanzi # busuanzi | custom
footer:
  visitor: true # 只控制页脚访客数的展示
```

`visitor.enable` 控制统一统计入口；`type` 选择数据来源。现有
`visitor.baiduAnalytics`、`googleAnalytics`、`clarity` 保持独立。

不蒜子每次进入页面发起一次 JSONP 请求，以 Referer 标识页面：
`page_pv` 显示文章阅读次数，`site_uv` 显示页脚访客数。请求具有计数副作用，
并非只读查询。重复初始化同一页面不重复请求；切页取消旧请求并隔离迟到响应。
失败、超时或无有效数字时显示 `—`，不会伪装成 0。

仅当前 hostname 与 Hexo `url` 的 hostname 一致且不是 localhost/回环地址时
请求统计；本地和其他域名的预览保持占位，不增加生产统计。

`custom` 为自建后端预留，目前不请求任何地址，显示 `—`。后续在
`source/js/_app/components/visitors/providers.ts` 实现 `VisitorProvider`：
输入为 `{ path, signal }`，返回 `{ pageViews, siteVisitors }` 或 `null`。
页面路径含前导 `/`；需要遵守取消信号，并自行定义后端的去重与计数规则。

统一统计开启时优先于文章原有 Waline/Twikoo 显示，关闭 Waline 的 pageview
写入；统一统计关闭时保留旧评论插件的配置行为。本站 Waline pageview 已关闭。
不蒜子不会自动继承 LeanCloud Counter 的历史数字。

验证：`node toolbox/test-visitors.mjs`，主题类型检查及博客 `build:local`。
