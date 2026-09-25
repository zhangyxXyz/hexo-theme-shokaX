# Fireworks runtime

`renderer.js` is a source-controlled adaptation of mouse-firework 0.3.0 (MIT; full notice retained in the source and LICENSE). It preserves the upstream particle shapes, movement options and easing, while replacing its input handling and frame scheduling. Do not edit the installed package or the generated theme.

Only mouse primary-button PointerEvent clicks trigger effects. Touch, pen and keyboard clicks do not create a canvas. The canvas is created lazily; backing scale is capped at 2. All animation groups share one frame loop, cleared before drawing; no callbacks remain after completion. Hidden pages, pagehide and reduced-motion changes clear active effects. At most three batches coexist; a new eligible click replaces the oldest. Clicks less than 150ms apart are ignored. Current site configuration has 31 objects per batch (93 maximum); custom particle configurations retain their configured batch sizes.

Initialization is global in siteInit, outside PJAX refresh. Reinitialization removes prior listeners, animations, canvas and modal-layer observers. Run `node toolbox/test-fireworks.mjs` and `pnpm test` from the theme, then build from the blog using `pnpm run theme:build` or `pnpm run build:local`.
