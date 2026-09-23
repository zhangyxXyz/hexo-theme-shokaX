# 主题配置与站点覆盖

独立主题的可复用默认配置集中在主题根目录 `_config.yml`，按功能分类。站点在自己的 `_config.shokax.yml` 中覆盖所需值；菜单、链接顺序和数组顺序具有意义。部署环境还可以通过 Hexo 的 `theme_config` 覆盖站点配置。

本主题不包含特定站点的 API 凭据、统计代理、备案资料或源码仓库地址。`statistics.baidu.endpoints`、`waline.serverURL`、摘要服务商和控制台链接由使用者填写。资源本地化下载器及 local/production 配置生成器属于示例博客的工具；独立主题直接使用 `vendors` 配置解析资源，不要求安装该工具。

| 功能 | 配置入口 | 说明 |
| --- | --- | --- |
| 浏览器标题、首页副标题 | `title`、`homeConfig.subtitle` | 相互独立 |
| 归档 | `archive_view` | `mode: tree / classic` |
| 分类目录 | `category_view` | `mode: cards / classic` |
| 标签云 | `tagcloud` | `mode: 2d / 3d`；无 JS 保留 2D 链接 |
| 曲线目录 | `sidebar.toc_style` | `default / curve`；单篇 front matter 可覆盖 |
| 页脚 | `footer` | 组件开关、数量、导航、站点时长、备案和文案 |
| 文章时效 | `isOutdated`、`outime` | `isOutdated` 留空兼容原 `outime`；文章可独立关闭 |
| 简繁切换、看板娘 | `article_script`、`live2d` | 资源地址优先取 `vendors` |
| 一言 | `hitokoto` | 首页/文章独立开关，API 与打字效果可配置 |
| 节日装饰 | `festival` | 日期与素材在 `_festivals.yml`；站点通过 `source/_data/festivals.yml` 覆盖 |
| AI 摘要 | `summary` | 多服务商/模型、首页模式、缓存、并发、超时、API 类型 |
| 评论 | `waline` | 布局、友链标签、时间显示、等级/专属标签配色；定制功能选 `client: seiun` |
| 阅读量 | `visitor` | `busuanzi / waline`，Waline 本地及非正式主机只读 |
| 统计页 | `statistics` | 代理/API 超时及旧资源覆盖；页面图表块决定加载内容 |
| 控制台彩蛋 | `console_welcome` | 可关闭；浏览器中文用 `messages.zh`，其他用 `messages.en`，不经过 i18n |
| 静态资源 | `vendors` | 命名源 + 路径，按原条件加载；更换 URL 后不能复用不匹配的 SRI |

归档、分类和标签云的 `switchable: true` 允许切换并优先使用访客保存的偏好；设为 `false` 固定配置视图。

控制台彩蛋默认关闭，启用后每次完整页面加载只输出一次，PJAX 切换不重复，也不检测 DevTools。`title` 留空使用站点标题，`messages` 提供欢迎语和链接名称；`links` 键与 `messages.zh.links` / `messages.en.links` 对应，值可以是完整 HTTP(S) 地址或站点相对路径。

`console_welcome.art` 支持直接在 YAML 覆盖字符画，默认小猫完整保存在主题配置中，源码只负责输出。使用 `art: |2-`，后续每行先缩进四个空格，再粘贴字符画（包含画面自身的空格）；反斜杠不用转义。省略该配置沿用主题默认，设置 `art: ''` 只隐藏字符画，欢迎语和链接继续显示。字符画中的 `%c`、`%s` 按普通文字显示。

`site_url` 是站内链接的统一根地址，留空沿用 Hexo 的 `url`。控制台链接解析读取此配置，不自行判断 localhost；环境工具可通过 `theme_config.site_url` 覆盖。完整外部地址保持原样，`/guestbook/` 从域名根目录解析，`guestbook/` 从配置的子目录解析。静态资源继续使用 `vendors` / `resource`；此设置不改 SEO canonical 或阅读量的正式站点判断。

只复制需要覆盖的配置即可。部分历史项仅为兼容保留：烟花实际读取 `fireworks.options`；旧 `fireworks.color` 不控制当前烟花配色。`image_list`、`index_images`、`festival_table`、`vendor_fonts` 等为生成数据，使用对应的数据文件或资源配置入口，不要在 YAML 中复制运行时产物。
