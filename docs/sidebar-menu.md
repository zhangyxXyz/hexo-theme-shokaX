# 侧栏导航

参考 https://blog.lavender816.top/ 的布局层级，配色改用本站柔粉渐变和子级竖线圆点。一级菜单以左右等宽的图标/箭头栏将文字对齐侧栏中线，左右侧栏均适用；子级保留缩进。本站菜单内容仍来自 theme.menu，图标沿用本站字体。

`source/css/_common/outline/sidebar/menu.styl` 限定在 `.overview .menu`，深色主题单独调整色阶。`sidebar-menu.ts` 管理展开按钮、aria-expanded、子菜单 inert 和 PJAX 监听清理。鼠标移入临时展开，点击固定或收起；键盘 Enter/Space 切换，ArrowDown 进入子菜单，Esc 收起。当前页面所属分组自动展开。

一级项有真实链接时，文字保持跳转，右侧独立箭头负责展开；无链接的分组整行作为按钮。`domInit.ts` 克隆侧栏生成顶部菜单时，将侧栏按钮还原为原先的顶栏链接，避免影响顶部导航布局。
