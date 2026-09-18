# 统计页

页面 front matter 设置 `type: statistics`。正文的 `#statistics_container` 内放置 `<section data-statistics-chart="posts"></section>` 等占位块；块的选择、数量和顺序由 Markdown 决定。可选值：`calendar`、`map`、`trends`、`sources`（百度）及 `posts`、`tags`、`categories`（站内）。删除百度块后不会发起对应请求。

站点 `_config.shokax.yml` 配置 `statistics.baidu.api/site_id/start_date/timeout`，以及 `statistics.assets.echarts` 和 `statistics.assets.maps.china/world` 完整资源路径。前端只传递这些公开配置；访问令牌由代理服务保存。站内文章月份起点用页面 `statistics_start: '2018-01'` 配置，未发文月份补零。

`scripts/helpers/statistics/site.ts` 在生成时聚合 Hexo 数据。`source/js/_app/components/statistics/baidu.ts` 负责请求，`site.ts` 读取生成的数据，`index.ts` 挂载页面声明的块。`options.ts` 管图表样式，`assets.ts` 管资源加载和地图适配，`map.ts` 与 `map-interactions.ts` 管地图切换和南海命中区域，`panel.ts` 管独立加载/重试反馈。

地图不依赖百度授权成功即可展示。省/国家切换取消旧请求，PJAX 离开清理图表和观察器。南海诸岛按原位完整绘制，透明按钮扩大命中范围，支持鼠标、键盘和点击固定；它没有单独的省级访问量。地图数据的 `center` 映射至 ECharts 4 的 `cp`，保留悬停名称。

验证：`pnpm test`、`node toolbox/test-statistics.cjs`；主题构建请从博客运行 `pnpm run theme:build`，不要在主题源目录运行上游 `build`。

地图支持滚轮缩放和拖动，缩放限制为 1–5 倍，线条和南海命中区域同步更新；主题及尺寸刷新保留视角，切换国家/省份重置。`map-ranking.ts` 将当前请求数据按访问量降序展示为地区排行，悬停或聚焦可联动地图；桌面位于右侧，600px 以下移到地图下方。纵向色阶保持原有蓝色范围，无数据时隐藏色阶并显示空排行，不把无数据补为零。

排行只显示 Top 10，名称列按最长名称收紧，超过四个字符省略并保留完整提示。桌面排行浮在全宽画布之上，默认视角预留排行空间，缩放后可延伸到浮层下方。滚动条默认透明、滚动时显示主题色细条，停止后淡出。`map-scale.ts` 绘制细条和圆角端点，ECharts 仅负责原有蓝色色阶映射。缩放停止后恢复悬停区域名称与提示，离开区域时清理高亮。

排行上方的工具栏提供放大、缩小和复位，使用 `i-plus-circle-outline`、`i-minus-circle-outline`、`i-reset` 图标；按钮与滚轮共用 1–5 倍限制，到达边界禁用对应按钮。复位清除平移和缩放，恢复当前地图初始视角。

缩放工具栏采用与地图切换一致的胶囊底座。首次加载、重试和切换地图时隐藏排行，成功返回空结果后才展示空状态；加载失败由面板统一显示错误。

分类与来源图例由 `legend.ts` 渲染为可横向滚动的按钮列表，不使用 ECharts 分页箭头。触屏原生滑动，鼠标按住拖动，点击或键盘激活切换分类；拖动超过 5px 后抑制误点击。选择状态在主题和尺寸重绘时保留。均值线使用青绿色，深色模式适当提亮。

访问日历沿用旧站灰色零访问格、粉色色阶和星期日开头的全年网格，起点为一年前所在周的周日。`calendar.ts` 从同一次日数据请求汇总全年、含今天的最近 30 天与 7 天，显示实际统计范围；缺少整个范围的数据用破折号表示。三张汇总卡片适配深浅主题，手机改为纵向排列，仅日历网格横向滚动。日期计算使用日历日而非毫秒差，兼容闰日和夏令时。
