# Seiun Waline client snapshot

- Repository: https://github.com/zhangyxXyz/waline (customizations on `dev`).
- Verified build 2026-09-26: `v1.41.6-seiun`, source `cc9b2b5b0de431e19309d04b3467cee55f125b84`, Actions run `36158871918`. Extracted from the checksum-verified client archive. Admin assets are published independently; the matching server supports a persistent admin override with bundled fallback.
- After submission or deletion, visible pages reload their authoritative counts and levels. Deleting the active reply/edit target restores the root editor and preserves its draft; failed deletion keeps the current editor and reports an error.
- SHA-256: `81ab80b3871a76ba3b033fc5b9f6efd8bff0500967a3d8ca04691fedc8c3d026`.
- Edit/reply drafts and visibility choices are retained separately per comment in page memory. Successful submission clears that draft; account/page changes clear all operation drafts. Top-level public/private modes share one draft; only public mode persists it. hideAdminLevel optionally hides administrator level badges while preserving exclusive labels.
- Editing restores recognized `@waline/emojis` images to emoji tokens, ignoring package version and mirror origin. Unknown images and code examples remain untouched; submission still serializes emoji images for server rendering.
- Optional `levelColors` and `labelColors` accept light/dark text, background and border palettes. Client fields override server level/label colors; unset fields preserve server colors or default styling.
- The `notify(message)` callback routes plain-text editor notices to the theme's copy-style toast. Without a callback, the client retains its browser-alert fallback.
- Edit controls fetch directional visibility permissions and explain denied actions. Draft visibility is local until submission; the server revalidates the revision, audience, ownership and reply tree. Requires the matching server and `assets/migrations/002-visibility-edit.mysql.sql`; old servers disable visibility changes while retaining content editing.
- Administrators can create private top-level comments visible only to administrators, or privately reply to account-owned comments. Server authorization determines the audience; anonymous comments still cannot receive private replies.
- Upload controls follow the public `comment?type=image-upload` server policy. The client disables the upload button, paste and drop uploads until the policy allows them; private comments still cannot upload images.
- Client version: 3.15.2. Includes the signed-in user's top-level private-message control. Visibility and submission rules belong to Waline; the theme only consumes this bundle.
- Existing client MIT notice is retained in LICENSE. The published release archive also contains a GPL-2.0 license, preserved separately in RELEASE-LICENSE; these are distinct upstream files. Bundled dependency notices are retained in the asset.

Enable with `waline.client: seiun` only against the matching fork server. The default remains `official`. This local snapshot avoids fetching executable code during each build and keeps private submission, account switching, permission flags and draft handling in the fork client. Theme build adapters retain relative dates and emoji-preview readiness. Refresh this snapshot deliberately after verifying both adapters and server compatibility.

This customized snapshot is intentionally excluded from the blog's `toolbox/resource-localization` downloader. Keep using this local client in normal theme builds; update it separately as part of the Waline customization workflow. Recorded release metadata remains in `version.json` for provenance.
