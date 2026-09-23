# Private messages

Set `waline.client: seiun` to use the bundled Seiun fork client. It requires the matching fork server and its MySQL privacy schema. Enabling the theme setting alone does not create server-side privacy protection.

Logged-in visitors can send a private message to the site owner. For replies, the server's `canPrivateReply` flag determines whether the switch appears; legacy comments without account ownership cannot receive private replies. Replies to private messages inherit their private status and cannot be made public. Private records show a lock badge. Private input keeps the fork's in-memory draft handling and disables public image upload/GIF search. Account switching and logout use the fork's list invalidation.

The switch says “私密” (localized) with a tooltip explaining that both accounts and administrators can read it. Its native checkbox state and disabled behavior are preserved; the theme only supplies capsule styling. Preview and submit controls are 30px high with labels intact.

Vendor source and SHA-256 are recorded in `vendor/waline@seiun/README.md`. No database writes or production test comments are needed for theme visual testing.
