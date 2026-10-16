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
| 阅读设置 | `reading_settings.enable` | 浏览器内调整正文排版、主辅配色、背景纹理、首页排列、明暗与动效偏好；默认关闭 |
| 一言 | `hitokoto` | 首页/文章独立开关，API 与打字效果可配置 |
| 节日装饰 | `festival` | 日期与素材在 `_festivals.yml`；站点通过 `source/_data/festivals.yml` 覆盖 |
| AI 摘要 | `summary` | 多服务商/模型、首页模式、缓存、并发、超时、API 类型 |
| 评论 | `waline` | 布局、友链标签、时间显示、等级/专属标签配色；定制功能选 `client: seiun` |
| 阅读量 | `visitor` | `busuanzi / waline`，Waline 本地及非正式主机只读 |
| 统计页 | `statistics` | 代理/API 超时及旧资源覆盖；页面图表块决定加载内容 |
| 控制台彩蛋 | `console_welcome` | 可关闭；浏览器中文用 `messages.zh`，其他用 `messages.en`，不经过 i18n |
| 静态资源 | `vendors` | 命名源 + 路径，按原条件加载；更换 URL 后不能复用不匹配的 SRI |

归档、分类和标签云的 `switchable: true` 允许切换并优先使用访客保存的偏好；设为 `false` 固定配置视图。

`reading_settings.enable` 默认 `false`，示例博客 StarryNightsStudio 在 `_config.shokax.yml` 中显式设为 `true`。开启后通过浮动工具栏进入设置；字号和行距只作用于文章正文，不改变根字号、导航、评论或摘要面板的排版。“主题默认”沿用 `auto_dark` 的时间规则，未启用时使用 `darkmode`；“跟随系统”响应设备明暗偏好，明确选择浅色或深色则优先于系统与时间。

动效默认跟随系统；选择减少动态效果，或系统已要求减弱时，只暂停或简化实际效果，不停止音乐，也不改写音乐可视化的独立开关。偏好仅保存于当前浏览器，刷新和 PJAX 切页后继续生效；存储不可用时仍可即时调整。“恢复默认”只移除 `shokax.reading.preferences` 与兼容的 `theme` 键，不清除音乐、评论等其他浏览器数据。

主色与辅助色支持取色器、`#RGB` / `#RRGGBB` / `rgb(r,g,b)` 输入，Enter、失焦或“应用”生效。无效输入保留上次配色；文字强调色与填充按钮色依据亮暗模式分别派生，原始色用于装饰，错误、警告、评论等级与小伙伴等语义色仍保留。普通组件通过 `--primary-color` 与 `--accent-*` 引用；独立恢复配色不会修改字号等其他偏好。

站点可在主题配置中设置 `palette.primary` / `palette.secondary` 作为默认主辅色，格式同上；空值或非法值回退原主题色表。此配置独立于 `reading_settings.enable`，关闭阅读面板也会生效。访客自定义颜色优先，恢复配色后重新继承站点默认；默认颜色不写入访客存储。同步 head 脚本和运行时共用同一配置与派生算法，`--theme-primary-seed` / `--theme-secondary-seed` 表示站点默认种子。两项均未配置时保持主题原有粉橙外观。

“更多外观”提供原横幅／简洁主题色、六种静态纹理与 5–25% 浓度、首页舒展列表／紧凑双列。默认保持原横幅、无纹理、原列表。简洁背景保留横幅高度，纹理只绘制在阅读表面外的留白；双列仅作用于带 `data-reading-home` 的首页及其分页，窄屏恢复单列。偏好数据版本为 2，兼容一期版本 1 的四项阅读设置；不在配置文件中保存访客选择。

控制台彩蛋默认关闭，启用后每次完整页面加载只输出一次，PJAX 切换不重复，也不检测 DevTools。`title` 留空使用站点标题，`messages` 提供欢迎语和链接名称；`links` 键与 `messages.zh.links` / `messages.en.links` 对应，值可以是完整 HTTP(S) 地址或站点相对路径。

`console_welcome.art` 支持直接在 YAML 覆盖字符画，默认小猫完整保存在主题配置中，源码只负责输出。使用 `art: |2-`，后续每行先缩进四个空格，再粘贴字符画（包含画面自身的空格）；反斜杠不用转义。省略该配置沿用主题默认，设置 `art: ''` 只隐藏字符画，欢迎语和链接继续显示。字符画中的 `%c`、`%s` 按普通文字显示。

`site_url` 是站内链接的统一根地址，留空沿用 Hexo 的 `url`。控制台链接解析读取此配置，不自行判断 localhost；环境工具可通过 `theme_config.site_url` 覆盖。完整外部地址保持原样，`/guestbook/` 从域名根目录解析，`guestbook/` 从配置的子目录解析。静态资源继续使用 `vendors` / `resource`；此设置不改 SEO canonical 或阅读量的正式站点判断。

只复制需要覆盖的配置即可。部分历史项仅为兼容保留：烟花实际读取 `fireworks.options`；旧 `fireworks.color` 不控制当前烟花配色。`image_list`、`index_images`、`festival_table`、`vendor_fonts` 等为生成数据，使用对应的数据文件或资源配置入口，不要在 YAML 中复制运行时产物。
