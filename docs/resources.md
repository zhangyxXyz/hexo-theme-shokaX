# 统一静态资源接口

`vendors` 集中管理主题外置静态资源。配置地址不触发下载，也不改变原来的懒加载、缓存、功能开关或资源版本。

```yaml
vendors:
  cdns:
    cdnjs: https://s4.zstatic.net/ajax/libs
    site_resource: https://cdn.example.com/static
  css:
    math: { source: cdnjs, url: KaTeX/0.16.9/katex.min.css }
  assets:
    live2d_models: { source: site_resource, url: npm/models@1.0.0/ }
```

修改 `vendors.cdns` 即可切换对应源。目标需提供相同的相对路径：对象存储源要提前同步文件，镜像/反向代理源要正确映射上游。使用远程 CDN 不要求本地创建目录。

## 地址语义

- 绝对 URL、协议相对 URL、以 `/` 开头的路径保持原样。
- `npm/...`、`gh/...`、`geo/...` 等相对路径使用 `resource` 或 `vendors.cdns.site_resource`。
- `{source: 名称, url: 路径}` 使用 `vendors.cdns` 中的命名根目录。
- `{source: site, url: 路径}` 使用站点 `root`，支持子目录。
- `{source: local, url: 地址}` 保持完整地址，兼容原 vendors 对象。
- 条目缺失或 `null` 时使用原功能配置/默认地址。

## 接口与入口

纯函数 `lib/vendors.cjs` 由构建和浏览器共用：`resolveResource(value, vendors, context)`、`resolveVendor(vendors, '分组.名称', fallback, context)`。

模板使用 `vendor_url(name, fallback)`；浏览器使用 `resourceURL(name, fallback)` 后交给原加载器。CSS 在生成时通过同一模块解析 `theme.vendor_fonts`。原 `getVendorLink` 与 SRI 元数据保持兼容。

| 条目 | 调用方与原行为 |
| --- | --- |
| css.math | post/page 样式，保留 media/onload；与旧 css.katex 分开以保持当前版本 |
| js.echarts | 统计页原脚本加载器，保留单例缓存；缺省 statistics.assets.echarts |
| assets.map_china/map_world | 地图原 fetch/cache；缺省 statistics.assets.maps |
| assets.live2d_widget | 看板娘显示时才加载 CSS/JS/提示 JSON |
| assets.live2d_models | 原模型清单、JSON、模型与贴图；缺省 live2d.cdn |
| js.live2d_game | 点击原小游戏按钮后加载 |
| fonts.stylesheet | 原 font.external/family 条件；缺省原 Google Fonts CSS 请求 |
| fonts.iconfont | 字体文件前缀（无扩展名），保留 CSS 格式顺序；缺省 iconfont 项目 |
| fonts.code | 原 JetBrains Mono 字体声明 |
| emoji.* | 命名的 Waline 元数据目录，保持配置顺序；整个分组为 null 时使用 waline.emoji |

表情元数据中的图片 URL 是持久化地址；本站本地 DOM 转换不修改表情映射和提交内容。不能将其一律转成 localhost。

## 资源清单与边界

| 类别 | 当前涉及的资源 | 管理方式 |
| --- | --- | --- |
| 构建依赖 | Waline/Vue、Shiki 语言/主题/WASM、OpenCC、Viewer、动画/烟花、copy-tex；按开关启用的播放器、Algolia、Twikoo | package/lockfile 或 vendor 快照，esbuild 分块，不重复在 YAML 声明包版本 |
| 外置静态资源 | 上述 CSS、字体、图标、模型、小游戏、表情、图表与地图 | vendors 注册表与命名源 |
| 站点生成文件 | Pagefind JS/WASM/索引、节日 SVG、主题 CSS/JS、内联图标、站点图片、文章附件 | 生成器与站点相对路径，保持原加载方式 |
| 动态接口 | Waline 评论/设置/登录/阅读量、百度统计、一言、播放器 API、GIF 搜索/Giphy、启用时的验证码 | 功能配置，不做静态镜像替换 |
| 用户内容 | 评论头像、图片、正文外链图 | 保持内容 URL；本站图片可单独作显示适配 |
| 构建期服务 | 包安装、主题更新检查、AI 摘要 | 不属于访客运行时静态资源 |

CSS 内字体、模型 JSON 内贴图等二级资源保留相对目录。第三方内部固定地址需要其配置接口或定点适配；不会覆盖全局 fetch/XHR。

## Live2D 上游与主题适配

Widget 的 CSS、运行库、脚本与提示 JSON 从 `assets.live2d_widget` 远端加载，固定上游 `stevenjoezhang/live2d-widget` 的 `b352ba5838157cf366e5e73de221c448e2e63545` 版本（`initWidget` 接口）。本地不再保存 `source/live2d-widget` 副本。

主题 `reading-tools/live2d.ts` 在初始化后定点接管关闭与小游戏按钮：关闭同步工具栏状态及本地可见性偏好；小游戏只在点击时加载 `js.live2d_game`。保留主题图标、位置、暗色样式、减少动画偏好和标签悬停提示。模型切换、截图等行为交给原版；普通提示语使用上游 JSON。更换上游版本时需验证初始化接口和 `waifu-tool-*` 按钮 ID，不能直接改为浮动 latest。

一言属于动态服务，使用 `hitokoto.api`，不放进静态 vendors。首页、文章和看板娘一言按钮共用该接口；看板娘由适配层接管按钮，不修改远端原版脚本。缺省为 `https://v1.hitokoto.cn`，环境配置可覆盖。
