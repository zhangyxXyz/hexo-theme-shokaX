# Bookmark search

Pages with `type: bookmarks` get an inline search field above the existing cards and category timeline. Both views share the same cards, filter, counts and links. Empty categories are hidden; clearing the field or pressing Escape restores all cards. Navigating to a hidden heading from the table of contents also clears the filter. The component supports PJAX re-entry and Chinese input composition; without JavaScript the original Markdown remains available.

The search field uses the article search's 2.75rem height. The category timeline is the default on entry; its button is on the left, followed by classic cards. View buttons retain accessible names without hover tooltips. View choice is no longer persisted in `bookmark-view` storage.

Search covers title, description, URL, parent category, subgroup and optional aliases. The primary engine is Pagefind, using a separate `/pagefind-bookmarks/` bundle and a `page` filter. The host blog must build one custom record per card after HTML generation: see `toolbox/search/build-bookmarks.mjs` in StarryNightsStudio, called by `search:build` after the article index. This reads rendered HTML, including linksfile entries, rather than maintaining a second bookmark dataset. Each record includes the external URL, searchable text, metadata and category/page filters.

Pagefind performs tokenization (including Chinese segmentation) and indexed multi-word retrieval. Its results select the existing cards while preserving category layout. Full-width queries are normalized. If the engine has no results, a local matcher supplements partial strings and Latin misspellings: words of four or more letters tolerate one edit (including transposition), or two edits for eight or more letters. Index load failures use this local matcher with an explicit status message. Pending searches are invalidated on clearing, newer queries and PJAX cleanup.

Add optional `keywords` to a `{% links %}` or `{% linksfile %}` entry as text or a YAML list. These aliases stay in the page metadata and are not displayed on the card:

```yaml
- site: Unsplash
  url: https://unsplash.com/
  desc: Beautiful Free Images & Pictures
  keywords: [壁纸, 照片, wallpaper]
```

This is indexed full-text search with fuzzy and alias assistance, not model-based semantic retrieval. Aliases are maintained with each site's content; new bookmarks are automatically indexed from the existing fields even without aliases. The article Pagefind search remains independent because its results represent pages rather than individual external bookmarks. No external website crawling or remote search service is involved.

Validation: `node toolbox/test-bookmark-search.mjs`, `pnpm test`, then build from the host blog with `pnpm run theme:build` (never the theme's own build command).
