# ShokaX fork 开发约定

- `dev` 是本 fork 的默认分支，承载所有定制；功能分支从 `dev` 创建，PR 合并回 `dev`。
- `main` 只同步 `theme-shoka-x/hexo-theme-shokaX` 的 `main`，不在其中提交定制或把 `dev` 合并回去。
- `origin` 指向 `zhangyxXyz/hexo-theme-shokaX`；`upstream` 指向 `theme-shoka-x/hexo-theme-shokaX`。同步前先 fetch，在 `dev` 合并 `upstream/main` 并验证。
- 修改前检查 Git 状态，保留已有未提交改动。提交时只纳入当前任务内容。
- 在 StarryNightsStudio 博客中开发时，使用博客根目录的 `pnpm run theme:build` 生成运行副本。不要在主题源码目录运行 `pnpm build`，当前编译器会原地删除 TS/JSON 源文件。
- 主题提交先推送 `origin/dev`，博客再更新 `themes/shokax-src` 的 gitlink；`.gitmodules` 的 `branch = dev` 不会自动更新锁定的提交。
