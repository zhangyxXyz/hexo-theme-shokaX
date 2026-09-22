# Seiun Waline client snapshot

- Repository: https://github.com/zhangyxXyz/waline (customizations on `dev`).
- Downloaded 2026-09-22 from release `v1.41.6-seiun`, source Waline `526d86b4`. Includes dashboard level colors, native exclusive-label colors and author website tooltips.
- SHA-256: `37053d7739dcbe7f4cdaf3a5370737b34e96a6025708d6f329d8012952c5043f`.
- Optional `levelColors` and `labelColors` accept light/dark text, background and border palettes. Client fields override server level/label colors; unset fields preserve server colors or default styling.
- The `notify(message)` callback routes plain-text editor notices to the theme's copy-style toast. Without a callback, the client retains its browser-alert fallback.
- Edit controls fetch directional visibility permissions and explain denied actions. Draft visibility is local until submission; the server revalidates the revision, audience, ownership and reply tree. Requires the matching server and `assets/migrations/002-visibility-edit.mysql.sql`; old servers disable visibility changes while retaining content editing.
- Administrators can create private top-level comments visible only to administrators, or privately reply to account-owned comments. Server authorization determines the audience; anonymous comments still cannot receive private replies.
- Upload controls follow the public `comment?type=image-upload` server policy. The client disables the upload button, paste and drop uploads until the policy allows them; private comments still cannot upload images.
- Client version: 3.15.2. Includes the signed-in user's top-level private-message control. Visibility and submission rules belong to Waline; the theme only consumes this bundle.
- License: MIT, see LICENSE. Bundled dependency notices are retained in the asset.

Enable with `waline.client: seiun` only against the matching fork server. The default remains `official`. This local snapshot avoids fetching executable code during each build and keeps private submission, account switching, permission flags and draft handling in the fork client. Theme build adapters retain relative dates and emoji-preview readiness. Refresh this snapshot deliberately after verifying both adapters and server compatibility.
