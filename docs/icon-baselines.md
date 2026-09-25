# 图标统一基线

站点 `source/_data/icon_baselines.json` 集中配置 iconfont 的垂直修正。所有使用 `.ic` 的图标共用这套规则，包括提示文字、正文混排、导航和 flex 控件；组件不再单独写图标的 `translateY` 或基线偏移。

```json
{
  "font": "3463079_jxh7qenyna",
  "default": 0,
  "icons": {
    "i-desktop-lyrics-on": 0.05,
    "i-music": 0.08
  }
}
```

- key 使用完整的 iconfont class；数字以图标自身字号的 `em` 为单位。
- **正数下移，负数上移**，`0` 不移动。例如 `0.05` 在 20px 图标上向下修正 1px。
- 未单独配置的图标使用 `default`；允许 `-0.5` 到 `0.5` 的有限数值，字符串和非法 class 不生成 CSS。
- `font` 必须与主题 `iconfont` 项目版本一致；换字体版本后先复核，再更新配置，避免沿用旧字形修正。缺少文件或版本不符时不偏移。

构建时 helper 将配置写入页头 `#icon-baselines` 样式，`.ic::before` 统一读取 `--icon-baseline`。只移动字形，不改行高、占位宽度、点击区域或外层图标动画，也不依赖前端 JS。因此动态提示和 PJAX 页面自然复用。修改后重新构建站点。

当前歌词开关、可视化、音乐、下一首、双箭头、搜索和爱心已用本站字体在 12px / 24px 文字下比较；不同字体或字形需要重新校准，几何中心接近不代表所有不对称图标的视觉重心完全相同。

验证配置：主题目录执行 `node toolbox/test-icon-baselines.mjs`；构建使用博客根目录的 `pnpm run build:local`。
