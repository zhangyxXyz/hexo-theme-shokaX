# 评论相对时间

```yaml
waline:
  relativeTimeDays: 60
```

非负整数；未设置默认 60。0 始终显示日期；60 表示不足 60 天时显示秒、分钟、小时或天数，满 60 天显示年月日；365 接近旧 MiniValine。

Waline 3.15.2 未提供格式化回调，主题通过 esbuild 插件在构建时适配其固定版本的日期函数，不修改 node_modules，也不重新请求评论数据。保留原生国际化与时间刷新。
依赖升级导致函数结构改变时，构建会明确报错，需重新核对适配。

验证：`node toolbox/test-waline-time.mjs`（主题目录）。修改配置后重新生成站点，并重启已有 Hexo 开发服务。
