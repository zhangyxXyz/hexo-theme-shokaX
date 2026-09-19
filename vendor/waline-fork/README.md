# Seiun Waline client snapshot

- Repository: https://github.com/zhangyxXyz/waline (customizations on `dev`).
- Retrieved 2026-09-20 from https://blog-comments.onlyzyx.com/assets/fork/waline.js.
- SHA-256: `09f6c4354bc7cf93f614134f0d06c52fa983c65b04470ff01bc3d65aae553341`.
- Client version: 3.15.2. The deployed asset does not expose its source commit; this snapshot is identified by its hash.
- License: MIT, see LICENSE. Bundled dependency notices are retained in the asset.

Enable with `waline.client: seiun` only against the matching fork server. The default remains `official`. This local snapshot avoids fetching executable code during each build and keeps private submission, account switching, permission flags and draft handling in the fork client. Theme build adapters retain relative dates and emoji-preview readiness. Refresh this snapshot deliberately after verifying both adapters and server compatibility.
