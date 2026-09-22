# Category directory

The categories landing page renders all non-empty category nodes from Hexo as compact cards. Parent/child relationships use category IDs; article counts use Hexo's category counts without adding overlapping child counts.

Desktop uses two balanced columns; below 768px it uses one column. Native details elements keep nested directories accessible without JavaScript. Category links navigate independently of the disclosure arrows. All branches are initially open.

The icon switch retains the classic category list. Configure `category_view.mode` as `cards` (default) or `classic`, and `category_view.switchable` as `true` or `false`. When switching is enabled, the visitor's saved choice takes precedence over the default. When disabled, controls are hidden and saved choices are ignored. The configured view also renders without JavaScript. Page refresh initializes the component and aborts listeners from the previous PJAX page. View labels are localized in the five theme languages.

Implementation: `layout/_partials/category-directory.pug`, `source/css/_common/components/pages/category-directory.styl`, and `source/js/_app/components/category-directory.ts`.
