# Holiday decorations

## Theme switch

```yaml
festival:
  enable: true
  theme: auto # auto | daily | spring | dragon_boat | mid_autumn | none
  mobile: false
```

`auto` selects a holiday within its display window; otherwise it selects `daily`.
An explicit theme bypasses the date window, but respects that entry's `enable`.
`none` or `enable: false` disables decorations. Mobile decorations are hidden below
992px unless `mobile` is enabled. All decorations ignore pointer events.

## Schedule table

Theme defaults live in `_festivals.yml`. The blog's `source/_data/festivals.yml`
deep-merges overrides, without changing the theme repository. For example:

```yaml
timezone: Asia/Shanghai
priority: [spring, dragon_boat, mid_autumn]
items:
  daily:
    enable: true
  spring:
    before: 7
    after: 14
    blossom: /images/decoration/plumblossom.png
    word1: ''
    word2: ''
  mid_autumn:
    before: 5
    after: 3
```

Dates have `calendar: lunar` (regular, not leap months) or `calendar: solar`,
plus numeric `month` and `day`. `before` and `after` include both boundary days
and are bounded to 0–30 days. Priority determines the winner of overlapping windows.
The defaults are lunar 1/1 (-7/+14), 5/5 (-3/+2), and 8/15 (-7/+3).
`daily` does not need a date and can be disabled independently.

The browser uses its built-in Chinese calendar support; no external date API or
new runtime dependency is required. It rechecks each minute and on visibility
changes, and cleans up its timer/listener during page refresh. Browsers without
Chinese calendar support fall back to the daily theme.

## Artwork and implementation

- `source/js/_app/components/festival/`: scheduling and lifecycle.
- `layout/_partials/third-party/festival.pug`: component shell.
- `layout/_partials/third-party/festival/`: original SVG templates for bamboo/moon,
  dumplings, and osmanthus/mooncake. No downloaded third-party artwork is used.
- `source/css/_common/components/third-party/festival/`: shared styles, legacy
  Spring Festival lanterns, and other artwork styling.

New artwork types require a template and a registered scene in `calendar.ts`;
adding a YAML key alone does not create artwork. The old `footer.lantern` setting
has been replaced by `festival` plus this table.

Run `node toolbox/test-festival.mjs` with Node 24 and `pnpm test` from the theme.
In the blog workspace use its safe `theme:build` command, not the theme's upstream
in-place compiler. Restart the local Hexo server after editing theme config.
