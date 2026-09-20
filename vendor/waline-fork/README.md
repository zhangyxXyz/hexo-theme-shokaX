# Seiun Waline client snapshot

- Repository: https://github.com/zhangyxXyz/waline (customizations on `dev`).
- Built 2026-09-20 from Waline commit `7e278572` using `pnpm --filter @waline/client build`.
- SHA-256: `65e6d3d82b8861ab7ac9406cf8396f4decf2555a98d46bead91bd9bdf529ed36`.
- Client version: 3.15.2. Includes the signed-in user's top-level private-message control. Visibility and submission rules belong to Waline; the theme only consumes this bundle.
- License: MIT, see LICENSE. Bundled dependency notices are retained in the asset.

Enable with `waline.client: seiun` only against the matching fork server. The default remains `official`. This local snapshot avoids fetching executable code during each build and keeps private submission, account switching, permission flags and draft handling in the fork client. Theme build adapters retain relative dates and emoji-preview readiness. Refresh this snapshot deliberately after verifying both adapters and server compatibility.
