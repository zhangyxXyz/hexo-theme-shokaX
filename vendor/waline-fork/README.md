# Seiun Waline client snapshot

- Repository: https://github.com/zhangyxXyz/waline (customizations on `dev`).
- Built 2026-09-21 from Waline commit `49f1d4d9`, using Node 24.20.0, `pnpm --filter @waline/api build` and `pnpm --filter @waline/client build`.
- SHA-256: `5d8fb5075d9fdb66b4d54f1dbf279707493ee662010fe5b41ae6c0f11d18c097`.
- Edit controls fetch directional visibility permissions and explain denied actions. Draft visibility is local until submission; the server revalidates the revision, audience, ownership and reply tree. Requires the matching server and `assets/migrations/002-visibility-edit.mysql.sql`; old servers disable visibility changes while retaining content editing.
- Administrators can create private top-level comments visible only to administrators, or privately reply to account-owned comments. Server authorization determines the audience; anonymous comments still cannot receive private replies.
- Upload controls follow the public `comment?type=image-upload` server policy. The client disables the upload button, paste and drop uploads until the policy allows them; private comments still cannot upload images.
- Client version: 3.15.2. Includes the signed-in user's top-level private-message control. Visibility and submission rules belong to Waline; the theme only consumes this bundle.
- License: MIT, see LICENSE. Bundled dependency notices are retained in the asset.

Enable with `waline.client: seiun` only against the matching fork server. The default remains `official`. This local snapshot avoids fetching executable code during each build and keeps private submission, account switching, permission flags and draft handling in the fork client. Theme build adapters retain relative dates and emoji-preview readiness. Refresh this snapshot deliberately after verifying both adapters and server compatibility.
