# 评论等级配色

后台「等级标签」每档可展开「等级颜色」，设置亮/暗模式下的文字、背景、边框。
客户端 `levelColors` 按字段覆盖后台颜色；不填写时使用后台颜色，再回退默认样式。
后台设置立即作用于后续评论请求，普通评论和统计弹窗均使用这些颜色。

在博客 `_config.shokax.yml` 的 `waline` 下配置，按服务端返回的等级编号匹配，第一档为 `level0`，最多 `level19`：

```yaml
waline:
  locale:
    level0: 新朋友
    level1: 老朋友
  levelColors:
    level0:
      light: { text: '#347d83', background: '#eaf5f4', border: '#c5e3df' }
      dark: { text: '#9ad5ce', background: '#253b3c', border: '#3d6262' }
    level1:
      light: { text: '#81603a', background: '#faf0df', border: '#e8d2ae' }
      dark: { text: '#e5c48e', background: '#403525', border: '#725d3d' }
  labelColors:
    特邀嘉宾:
      light: { text: '#81603a', background: '#faf0df', border: '#e8d2ae' }
      dark: { text: '#e5c48e', background: '#403525', border: '#725d3d' }
```

`text`、`background`、`border` 分别为文字、背景、边框色。支持带引号的 3、4、6、8 位十六进制颜色；未填写或无效值沿用对应模式的后台颜色，再回退主题默认颜色。只配置亮色不会覆盖暗色模式。`levelColors: {}` 沿用后台设置。

颜色只影响评论区的等级标签，不改变友链、管理员身份或私密标签。名称覆盖使用 `locale.levelN`，等级门槛仍在服务器后台设置；重排服务器等级时，颜色跟随新的编号。

配色由定制 Waline 客户端原生处理，主题只传递配置及默认样式。需要包含此功能的客户端版本（本主题使用 `client: seiun`）；官方客户端会忽略这两个选项。

`labelColors` 按专属标签原文精确匹配，对同名标签生效。每个颜色字段优先级为：客户端有效配置 → 后台用户专属标签颜色 → 默认样式。后台支持按用户设置亮色、暗色的文字、背景、边框；清空字段恢复默认，清空名称移除标签。

YAML 修改后重建博客；本地运行 `pnpm run dev`。后台设置专属标签颜色需要同步更新 Waline 服务端和管理端，颜色保存在持久化的 `runtime/dashboard-settings.json`；旧客户端仍显示标签文字但不会应用后台颜色。
