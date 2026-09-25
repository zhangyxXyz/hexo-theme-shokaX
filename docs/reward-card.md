# 文章赞赏卡

文章末尾采用银行卡式正反面，沿用 `reward.enable`、`reward.account` 和文章 `reward: false`。未配置有效收款图片时不显示空卡片。卡片署名沿用文章上下文作者；品牌默认使用站点标题，也可设置 `reward.brand`。本站设置为 `STARRY NIGHTS`。

`reward.enable` 沿用原有总开关；文章和独立页面均可在 YAML front matter 中设置 `reward: false` 单独关闭。本站直接在其他独立页面头部设置关闭，留言页保留 `reward: true`，不另设页面类型开关。

正面文案位于 `languages/*.yml` 的 `reward` 段：`title`（赞赏）、`description`、`support`（赞赏支持）等。不再显示卡片外层标题。站点可按原有语言覆盖机制修改。SVG 芯片、星轨和书页由模板生成，无图片生成服务或新增运行依赖。

## 操作

- PC 精细鼠标移入卡片自动翻面，移出自动翻回，动画约 450 ms；用真实鼠标坐标与固定外框判断，不依赖旋转面触发的移入／移出事件。翻开后外沿有 8px 容错，持续离开 120ms 才翻回；返回卡面后须离开再进入才重新触发。文章布局不移动，悬停不主动抢夺焦点。点击「赞赏支持」仍可翻面，按钮保留评论入口的圆角样式，描边与浅底色改用卡片玫瑰色变量。
- 背面按 `reward.account` 顺序显示支付方式，默认第一项。微信、支付宝、PayPal 使用 `i-wechat`、`i-alipay`、`i-paypal` 图标，保留本地化辅助名称与悬停提示；自定义方式保留文字。切换时只替换收款码与扫码说明，不再次翻面。
- 点击收款码打开原生模态对话框；弹窗打开期间暂停移出翻回。关闭后，若由鼠标悬停打开且鼠标已离开卡片，则回到正面并聚焦赞赏按钮；否则焦点返回二维码。保持当前支付方式。
- 「返回卡面」或背面按 Escape 翻回。方向键、Home、End 切换支付方式；隐藏卡面通过 `inert` 移出键盘及辅助技术访问。
- 返回按钮使用 `i-chevrons-left`，图标与文字以 Flex 居中并使用相同行高；此按钮内取消行内字体的基线补偿，避免居中后又向下偏移。全站普通图文混排的图标基线配置保持独立。
- 手机端无悬停动画；图片可按浏览器原生方式长按保存。`prefers-reduced-motion` 关闭翻转与悬停动画。
- 明暗主题分别使用浅玫瑰和炭黑玫瑰配色。二维码保留原图与白底，不裁剪、反色或滤镜处理。收款码使用 eager 加载，避免隐藏面板/3D 翻转延迟触发浏览器懒加载；失败时提供带缓存更新参数的手动重试入口。
- 无 JavaScript 时，卡片下方提供原始收款图片链接。页面不接入支付状态查询，也不展示支付成功提示。

微信图标用 `#07C160`（[腾讯 WeUI 品牌变量](https://github.com/Tencent/weui/blob/master/src/style/base/theme/vars/light.less)），支付宝用 `#1677FF`（[品牌色参考](https://logo.domains/app/logo/alipay)）。选中项使用同色描边与浅色背景，图标持续保留品牌色。本站现有 iconfont 已映射支付宝 `\e64f`、PayPal `\e667`，不另外加载图标库。

卡片最大宽度为 26rem，压缩上下留白，正反面共享同一网格尺寸。品牌按钮固定 2.75rem × 2.75rem（默认 44px），圆角 .75rem，细描边与轻微内高光；不依赖字形宽度撑开按钮。自定义文字支付方式仍允许自适应宽度。

整个赞赏区域铺设静态 SVG 星轨细线与少量星点，沿用卡片强调色，边缘用径向遮罩渐隐。装饰层不接收鼠标事件，也不进入辅助技术；只在卡片外框内触发翻面。窄屏降低线条透明度，不产生横向溢出或持续动画。

本站微信收款图于 2026-09-25 一次性清理外围残边：`source/_data/assets/wechatpay.png` 与历史副本 `source/images/setting/wechatpay.png` 同步处理，仅将最外侧一圈像素改为白色。图片维持 256×256，内部码点与头像逐像素不变，并通过 ZXing 解码确认前后内容相同；不在浏览器中滤镜处理二维码。

## 维护与验证

模板：`layout/_partials/post/reward.pug`；样式：`source/css/_common/components/post/reward.styl`；交互：`source/js/_app/components/reward.ts`，由 `postBeauty()` 初始化。`pjax:send` 关闭对话框并清理监听；重新初始化会撤销旧监听。

在博客根目录运行：

```powershell
node themes/shokax-src/toolbox/test-reward.mjs
node themes/shokax-src/toolbox/test-hover-interactions.mjs
pnpm --dir themes/shokax-src test
pnpm run build:local
```

模板测试覆盖文章禁用、空/无效配置、单个自定义支付方式、默认选中、收款路径、转义和五种语言。浏览器验收应检查暗/亮、桌面/窄屏、双支付方式、放大/关闭/返回、键盘和 PJAX 往返。构建时应检查日志中的资产渲染错误，不能只看 Hexo 退出码。
