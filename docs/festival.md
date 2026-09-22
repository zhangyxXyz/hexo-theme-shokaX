# 节日与二十四节气装饰

右上角装饰按日期自动切换，采用透明 SVG、工笔花鸟、传统器物与细腻渐变。
图案按节俗和物候自然构图，仅春节、元宵保留灯笼挂饰，不使用统一挂绳框架。
春节保留红灯笼原有摇摆，梅枝以右上枝根为轴轻摇。装饰不拦截点击，尊重减少动态效果设置。

## 开关与预览

本站的 `/festival/` 使用主题原有页头、侧栏和明暗配色。点击场景卡片或选择下拉选项，
会立即替换页面右上角的真实装饰；不是另一个演示画布。选择“站点默认”或离开本页后
恢复原配置。`?scene=mid_autumn` 等链接可直接进入指定预览，不写入配置或浏览器持久存储。
手动预览临时允许窄屏及被默认禁用的场景，“站点默认”仍尊重所有原始开关。
选定具体节日或节气后，可在题签输入框立即替换右上角的文字；清空会隐藏题签。
输入只影响当前页面预览，离开本页恢复配置中的文字。日常竹月场景不使用题签。

其他站点可创建 `source/festival/index.md`：

```yaml
---
title: 节日与节气预览
type: festival-preview
comment: false
copyright: false
isOutdated: false
---
```

```yaml
festival:
  enable: true
  theme: auto # auto / daily / none，或下面的场景 ID
  mobile: false
```

指定 `theme: mid_autumn` 等场景 ID 可跨日期预览，但仍尊重该项的 `enable: false`。
`none` 或全局 `enable: false` 关闭装饰。宽度小于 992px 默认隐藏且不下载装饰资源；
`mobile: true` 可开启窄屏装饰。手机样式采用 130px 宽度。

## 已支持的传统节日

| 节日 | 场景 ID | 日期 | 默认展示窗口 | 图案 |
| --- | --- | --- | --- | --- |
| 春节 | `spring` | 农历正月初一 | 前 7 天至后 14 天 | 原有红灯笼、梅花 |
| 元宵 | `lantern` | 农历正月十五 | 前 2 天至当天 | 宫灯、汤圆 |
| 端午 | `dragon_boat` | 农历五月初五 | 前 3 天至后 2 天 | 粽子、艾草、五彩绳 |
| 七夕 | `qixi` | 农历七月初七 | 前后各 1 天 | 双鹊、星月、红线 |
| 中秋 | `mid_autumn` | 农历八月十五 | 前 7 天至后 3 天 | 圆月、桂枝、玉兔、月饼 |
| 重阳 | `chongyang` | 农历九月初九 | 前后各 1 天 | 菊花、茱萸、重阳糕 |
| 腊八 | `laba` | 农历腊月初八 | 前后各 1 天 | 青花粥碗、谷物、梅枝 |
| 冬至 | `dongzhi` | 冬至交节日 | 当天及次日 | 汤圆、消寒梅 |

元宵在默认优先级中排在春节前面，因此元宵窗口内显示独立花灯。
除夕仍属于春节窗口。冬至与二十四节气共用 `dongzhi`，不重复注册。
这些是节日装饰日期，并非法定调休或放假表。

## 二十四节气

全部支持交节当天及次日展示，传统节日默认优先于节气。

| 季节 | 节气 / 场景 ID |
| --- | --- |
| 春 | 立春 `lichun`、雨水 `yushui`、惊蛰 `jingzhe`、春分 `chunfen`、清明 `qingming`、谷雨 `guyu` |
| 夏 | 立夏 `lixia`、小满 `xiaoman`、芒种 `mangzhong`、夏至 `xiazhi`、小暑 `xiaoshu`、大暑 `dashu` |
| 秋 | 立秋 `liqiu`、处暑 `chushu`、白露 `bailu`、秋分 `qiufen`、寒露 `hanlu`、霜降 `shuangjiang` |
| 冬 | 立冬 `lidong`、小雪 `xiaoxue`、大雪 `daxue`、冬至 `dongzhi`、小寒 `xiaohan`、大寒 `dahan` |

节气采用香港天文台 2020–2050 年公历与农历对照表，按民用日期切换，
不按交节精确时刻切换，也不使用固定月日或近似公式。
超出日期表年限时跳过节气，仍正常识别农历节日；手动指定节气场景不受年限限制。
来源与维护说明见 [festival-calendar-sources.md](festival-calendar-sources.md)。

## 站点覆盖

主题默认表为 `_festivals.yml`，站点 `source/_data/festivals.yml` 深度合并覆盖字段：

```yaml
timezone: Asia/Shanghai
items:
  spring:
    blossom: /images/decoration/plumblossom.png
    label: 新春
  mid_autumn:
    label: 团圆
    before: 5
    after: 3
  qixi:
    enable: false
  qiufen:
    label: '' # Hide the inscription; keep the artwork.
    before: 0
    after: 2
```

每个节日、节气的 `label` 默认是两字名称，例如“春节”“端午”“立春”。
可以在站点数据文件中逐项替换；去掉首尾空白后最多保留两个 Unicode 字符，
不会从 UTF-16 代理对中间截断。显式空字符串或只有空白会隐藏文字，省略则继承主题默认值。
题签作为普通文本转义，`<`、`>` 等字符不会成为 SVG 标记。
修改站点 `label` 后需要重新生成，SVG 内容 hash 会随文字变化，避免复用旧缓存。

春节兼容旧 `word1` / `word2`：明确设置时覆盖对应灯笼的字，`null` 使用 `label`
中的对应字，显式 `''` 隐藏对应字；未配置旧字段时默认使用“春节”。

`before` / `after` 包含两端，范围为 0–30 天。`priority` 越靠前优先级越高；
覆盖完整数组时注意保留想要自动显示的场景。`daily` 是其余日期的竹月装饰，可单独关闭。
农历只匹配正常月份，排除闰月。`calendar: solar` 指固定公历月日，
`calendar: solar_term` 按场景 ID 查节气表；不能把清明等节气写成固定公历日。
浏览器不支持农历时跳过农历项，仍识别公历日期和节气。

## 实现与验证

- `layout/_partials/third-party/festival/`：原创 SVG 模板与共享图形。
- `scripts/generaters/festival.ts`：生成带内容 hash 的独立 SVG 和页面资源映射。
- `source/js/_app/components/festival/`：日期调度、按需加载、缓存与 PJAX 清理。
- `source/css/_common/components/third-party/festival/`：明暗、窄屏、摇曳与减少动态效果。

每篇文章只内联春节和轻量日常装饰；其余场景只下载当前需要的一份。
资源失败时回退日常，下次定时检查可重试。刷新或 PJAX 切页取消未完成请求，
清理计时器与监听，已成功获取的素材可复用。新增 YAML 键不会自动创造图案，
新增场景需同时注册调度、模板与资源生成。
动效集中在枝叶、雨丝、飞鸟和蒸汽等局部，器物保持稳定；元宵保留灯笼轻摇。
端午艾草与绑点处的五彩丝线、中秋桂枝与桂花、七夕红线分别轻摆；
植物使用约 1–1.25°、7–9 秒的幅度与周期，丝线约 1.6°，避免缓慢到难以察觉。
系统启用“减少动态效果”时停用这些动画。

存在 `type: festival-preview` 页面时，生成器始终准备完整素材与隐藏装饰容器，
因此全局关闭装饰的站点也能从普通页通过 PJAX 进入预览。普通页面仍按原配置隐藏，
不会因存在预览页而下载角饰素材。预览仅覆盖该次页面生命周期中的选择，
不改 body 尾部持久容器内的原始 `data-festival`。

```sh
pnpm test
node toolbox/test-festival-calendar.mjs
node toolbox/test-festival-artwork.mjs
node toolbox/test-festival-generator.mjs
```

博客工作区用 `pnpm run theme:build` 或 `pnpm run build:local` 安全构建。
不要运行主题上游原地编译命令；修改构建插件后需重启本地 Hexo 服务。
