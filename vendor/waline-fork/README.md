# Seiun Waline client snapshot

- Repository: https://github.com/zhangyxXyz/waline (customizations on `dev`).
- Built 2026-09-20 from Waline commit `842d716b` using Node 24.20.0 and `pnpm --filter @waline/api build`, then `pnpm --filter @waline/client build`.
- SHA-256: `e8161609db6d6ded8c5a82dc4608a563cf39ccf22c5ba0f7d075985ce396334e`.
- Upload controls follow the public `comment?type=image-upload` server policy. The client disables the upload button, paste and drop uploads until the policy allows them; private comments still cannot upload images.
- Client version: 3.15.2. Includes the signed-in user's top-level private-message control. Visibility and submission rules belong to Waline; the theme only consumes this bundle.
- License: MIT, see LICENSE. Bundled dependency notices are retained in the asset.

Enable with `waline.client: seiun` only against the matching fork server. The default remains `official`. This local snapshot avoids fetching executable code during each build and keeps private submission, account switching, permission flags and draft handling in the fork client. Theme build adapters retain relative dates and emoji-preview readiness. Refresh this snapshot deliberately after verifying both adapters and server compatibility.
