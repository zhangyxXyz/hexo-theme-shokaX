# 统计页

页面 front matter 设置 `type: statistics`。正文的 `#statistics_container` 内放置 `<section data-statistics-chart="posts"></section>` 等占位块；块的选择、数量和顺序由 Markdown 决定。可选值：`calendar`、`map`、`trends`、`sources`（百度）及 `posts`、`tags`、`categories`（站内）。删除百度块后不会发起对应请求。

站点 `_config.shokax.yml` 配置 `statistics.baidu.api/site_id/start_date/timeout`，以及 `statistics.assets.echarts` 和 `statistics.assets.maps.china/world` 完整资源路径。前端只传递这些公开配置；访问令牌由代理服务保存。站内文章月份起点用页面 `statistics_start: '2018-01'` 配置，未发文月份补零。

`scripts/helpers/statistics/site.ts` 在生成时聚合 Hexo 数据。`source/js/_app/components/statistics/baidu.ts` 负责请求，`site.ts` 读取生成的数据，`index.ts` 挂载页面声明的块。`options.ts` 管图表样式，`assets.ts` 管资源加载和地图适配，`map.ts` 与 `map-interactions.ts` 管地图切换和南海命中区域，`panel.ts` 管独立加载/重试反馈。

地图不依赖百度授权成功即可展示。省/国家切换取消旧请求，PJAX 离开清理图表和观察器。南海诸岛按原位完整绘制，透明按钮扩大命中范围，支持鼠标、键盘和点击固定；它没有单独的省级访问量。地图数据的 `center` 映射至 ECharts 4 的 `cp`，保留悬停名称。

验证：`pnpm test`、`node toolbox/test-statistics.cjs`；主题构建请从博客运行 `pnpm run theme:build`，不要在主题源目录运行上游 `build`。

分类与来源图例由 `legend.ts` 渲染为可横向滚动的按钮列表，不使用 ECharts 分页箭头。触屏原生滑动，鼠标按住拖动，点击或键盘激活切换分类；拖动超过 5px 后抑制误点击。选择状态在主题和尺寸重绘时保留。均值线使用青绿色，深色模式适当提亮。
